"""Advanced RAG pipeline — parallel retrieval, query expansion, rerank, merge."""

import asyncio
import logging
from typing import List, Dict
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from app.core.config import get_settings
from app.services.embedder import EmbeddingService
from app.services.keyword_search import KeywordSearchService
from app.services.entity_search import EntitySearchService

logger = logging.getLogger(__name__)

RAG_SYSTEM_PROMPT = """你是一名专业的知识管家，擅长将零散信息**提炼总结**并**结构化重组**。

## 你的工作方式
收到用户问题和知识库原文后，请按以下思维路径处理：

1. **抓骨骼**：快速识别原文的核心逻辑。它是时间顺序？流程步骤？并列要点？还是因果链条？
2. **立骨架**：根据逻辑，将散乱的信息点归纳为 2~4 个核心板块。每个板块提炼一个**概括性小标题（加粗）**。
3. **填血肉**：在每个板块下，用 **层级分点（- 或 1.）** 列出具体动作或原则。同类项必须合并，避免重复。
4. **点睛笔**：如果原文有贯穿始终的核心原则（如"不推诿"），在末尾用单独段落或引用块（>）高亮强调。

## 格式规范
- 使用 Markdown 风格：**加粗**标题、`-` 分点、`>` 引用。
- 禁止使用表格（易读性差），禁止写大段密集文字。
- 禁止照抄原文的序号（如直接复制"1. 2. 3."），必须按你的逻辑重新编号。

## 底线
- 必须基于【知识库上下文】，不捏造、不遗漏核心事实。
- 如果内容极少（如只有1个论点），则不强行分板块，直接简洁总结即可。

## 知识库内容
{context}"""


class RAGService:
    """Advanced RAG pipeline with multi-path retrieval and rerank."""

    def __init__(self):
        settings = get_settings()
        self._client = None
        self._reranker = None
        self._settings = settings
        self.model = settings.llm_model
        self.top_k = settings.rag_top_k
        self.threshold = settings.rag_similarity_threshold
        # Source weights for merge
        self.source_weights = {"vector": 1.0, "keyword": 0.8, "entity": 0.9}

    @property
    def client(self):
        if self._client is None:
            self._client = AsyncOpenAI(
                base_url=self._settings.llm_api_base,
                api_key=self._settings.llm_api_key,
            )
        return self._client

    @property
    def reranker(self):
        """Lazy-load CrossEncoder for reranking."""
        if self._reranker is None:
            try:
                import os
                from sentence_transformers import CrossEncoder
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                self._reranker = CrossEncoder(
                    "BAAI/bge-reranker-v2-m3",
                    local_files_only=True,
                )
                logger.info("CrossEncoder reranker loaded")
            except Exception as e:
                logger.warning(f"Reranker not available, using fallback: {e}")
                self._reranker = False  # Mark as unavailable
        return self._reranker if self._reranker is not False else None

    # ── Vector retrieval ──────────────────────────────────

    async def _vector_search(
        self, db: AsyncSession, kb_id: UUID, query: str, top_k: int = None,
        doc_id: UUID = None, folder_id: UUID = None,
    ) -> List[Dict]:
        """pgvector cosine similarity search."""
        top_k = top_k or self.top_k
        try:
            query_embedding = await EmbeddingService.embed_query(query)
            embedding_literal = f"[{','.join(str(x) for x in query_embedding)}]"

            doc_filter = "AND c.doc_id = CAST(:doc_id AS uuid)" if doc_id else ""
            folder_filter = "AND d.folder_id = CAST(:folder_id AS uuid)" if folder_id else ""

            sql = text(f"""
                SELECT c.id, c.content, c.doc_id, d.filename, d.version,
                       1 - (c.embedding <=> CAST(:embedding AS vector)) AS similarity
                FROM chunks c
                JOIN documents d ON c.doc_id = d.id
                WHERE c.kb_id = CAST(:kb_id AS uuid)
                  {doc_filter}
                  {folder_filter}
                  AND c.embedding IS NOT NULL
                  AND d.parse_status NOT IN ('replaced', 'failed')
                  AND 1 - (c.embedding <=> CAST(:embedding AS vector)) > :threshold
                ORDER BY similarity DESC
                LIMIT :top_k
            """)
            params: dict = {
                "kb_id": str(kb_id),
                "embedding": embedding_literal,
                "threshold": self.threshold,
                "top_k": top_k,
            }
            if doc_id:
                params["doc_id"] = str(doc_id)
            if folder_id:
                params["folder_id"] = str(folder_id)
            result = await db.execute(sql, params)
            return [
                {
                    "chunk_id": str(row[0]),
                    "content": row[1],
                    "doc_id": str(row[2]),
                    "document_name": f"{row[3]} (v{row[4] or 1})",
                    "score": round(float(row[5]), 4),
                    "source": "vector",
                }
                for row in result.fetchall()
            ]
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    # ── Parallel retrieval ────────────────────────────────

    async def _multi_retrieve(
        self, db: AsyncSession, kb_id: UUID, query: str, top_k: int = None,
        doc_id: UUID = None, folder_id: UUID = None,
    ) -> List[Dict]:
        """Run vector + keyword + entity search in parallel."""
        k = top_k or self.top_k

        vector, keyword, entity = await asyncio.gather(
            self._vector_search(db, kb_id, query, k, doc_id, folder_id),
            KeywordSearchService.search(db, kb_id, query, k, doc_id, folder_id),
            EntitySearchService.search(db, kb_id, query, k, doc_id, folder_id),
            return_exceptions=True,
        )

        # Filter out exceptions
        if isinstance(vector, Exception):
            logger.warning(f"Vector search error: {vector}")
            vector = []
        if isinstance(keyword, Exception):
            logger.warning(f"Keyword search error: {keyword}")
            keyword = []
        if isinstance(entity, Exception):
            logger.warning(f"Entity search error: {entity}")
            entity = []

        logger.info(
            f"Multi-retrieve: vector={len(vector)}, keyword={len(keyword)}, entity={len(entity)}"
        )
        return vector + keyword + entity

    # ── Query expansion ───────────────────────────────────

    async def _expand_query(self, query: str) -> List[str]:
        """Use LLM to generate 2 variant queries for broader search."""
        prompt = (
            f"将以下用户问题改写成2个不同角度但意思相同的搜索查询。"
            f"每个查询一行，不要编号，不要额外解释。\n\n用户问题: {query}"
        )
        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=200,
            )
            text = resp.choices[0].message.content.strip()
            variants = [line.strip("- 1234567890. ") for line in text.split("\n") if line.strip()]
            variants = [v for v in variants if len(v) > 2]
            logger.info(f"Query expanded to {len(variants)} variants: {variants}")
            return variants[:2]  # Max 2 variants
        except Exception as e:
            logger.warning(f"Query expansion failed: {e}")
            return []

    # ── Rerank ────────────────────────────────────────────

    async def _rerank(
        self, query: str, candidates: List[Dict]
    ) -> List[Dict]:
        """Re-score candidates using CrossEncoder or embedding fallback."""
        if not candidates:
            return []

        reranker = self.reranker
        if reranker:
            # Use CrossEncoder
            try:
                loop = asyncio.get_running_loop()
                pairs = [(query, c["content"]) for c in candidates]
                scores = await loop.run_in_executor(
                    None,
                    lambda: reranker.predict(
                        pairs, show_progress_bar=False, batch_size=16,
                    ),
                )
                for c, s in zip(candidates, scores):
                    c["rerank_score"] = round(float(s), 4)
                candidates.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
                return candidates
            except Exception as e:
                logger.warning(f"CrossEncoder rerank failed: {e}")

        # Fallback: use batch embedding cosine similarity as rerank score
        try:
            from app.services.embedder import EmbeddingService
            texts = [c["content"] for c in candidates]
            query_emb, *chunk_embs = await EmbeddingService.embed_texts(
                [query] + texts
            )
            for c, chunk_emb in zip(candidates, chunk_embs):
                dot = sum(a * b for a, b in zip(query_emb, chunk_emb))
                c["rerank_score"] = round(float(dot), 4)
            candidates.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        except Exception as e:
            logger.warning(f"Fallback rerank failed: {e}")

        return candidates

    # ── Merge & dedup ─────────────────────────────────────

    def _merge_results(
        self, all_candidates: List[Dict], top_k: int
    ) -> List[Dict]:
        """Deduplicate by chunk_id, weight by source, take top_k."""
        seen = {}
        for c in all_candidates:
            cid = c["chunk_id"]
            weight = self.source_weights.get(c.get("source", "vector"), 0.7)
            combined = c.get("score", 0) * weight

            if cid not in seen or combined > seen[cid]["_combined"]:
                c["_combined"] = combined
                seen[cid] = c

        merged = sorted(seen.values(), key=lambda x: x["_combined"], reverse=True)
        for c in merged:
            c.pop("_combined", None)
        return merged[:top_k]

    # ── Full pipeline ─────────────────────────────────────

    async def retrieve(
        self, db: AsyncSession, kb_id: UUID, query: str, top_k: int = None,
        doc_id: UUID = None, folder_id: UUID = None,
    ) -> List[Dict]:
        """Advanced retrieval: multi-path → (expand) → merge → (rerank)."""
        k = top_k or self.top_k

        # Step 1: Parallel retrieval on original query
        original = await self._multi_retrieve(db, kb_id, query, k, doc_id, folder_id)

        # Step 2: Query expansion (optional — skip for small KBs)
        expanded_results = []
        if self._settings.rag_enable_query_expansion:
            variants = await self._expand_query(query)
            if variants:
                variant_tasks = [
                    self._multi_retrieve(db, kb_id, v, k // 2, doc_id, folder_id) for v in variants
                ]
                variant_lists = await asyncio.gather(*variant_tasks, return_exceptions=True)
                for vl in variant_lists:
                    if not isinstance(vl, Exception):
                        expanded_results.extend(vl)

        # Step 3: Combine all candidates
        all_candidates = original + expanded_results
        logger.info(f"Candidates before merge: {len(all_candidates)}")

        # Step 4: Merge & rerank (or simple sort)
        pre_merge = self._merge_results(all_candidates, k * 3 if self._settings.rag_enable_reranker else k)

        if self._settings.rag_enable_reranker:
            final = await self._rerank(query, pre_merge)
            final = final[:k]
        else:
            # Fast path: sort by weighted score, no CrossEncoder
            final = sorted(pre_merge, key=lambda x: x.get("score", 0), reverse=True)[:k]

        # Format output
        return [
            {
                "chunk_id": c["chunk_id"],
                "content": c["content"],
                "doc_id": c["doc_id"],
                "metadata": {},
                "document_name": c["document_name"],
                "score": c.get("rerank_score", c.get("score", 0)),
            }
            for c in final
        ]

    # ── Generate ──────────────────────────────────────────

    async def generate(
        self, query: str, sources: List[Dict],
        conversation_history: List[Dict] = None,
    ) -> str:
        """Generate answer from retrieved context."""
        if not sources:
            return "知识库中没有找到相关信息，请尝试上传更多文档或换个问题。"

        context_parts = []
        for i, src in enumerate(sources):
            context_parts.append(
                f"[来源{i+1}: {src['document_name']}]\n{src['content']}"
            )
        context = "\n\n---\n\n".join(context_parts)

        prompt = RAG_SYSTEM_PROMPT.format(context=context)
        messages = [{"role": "system", "content": prompt}]
        if conversation_history:
            messages.extend(conversation_history[-6:])
        messages.append({"role": "user", "content": query})

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
                max_tokens=2000,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"RAG generation failed: {e}")
            return f"生成回答时出错: {str(e)}"

    async def generate_stream(self, query: str, sources: list, history=None):
        """Stream answer generation token by token."""
        if not sources:
            yield "知识库中没有找到相关信息。"
            return

        context_parts = []
        for i, src in enumerate(sources):
            context_parts.append(
                f"[来源{i+1}: {src['document_name']}]\n{src['content']}"
            )
        context = "\n\n---\n\n".join(context_parts)
        prompt = RAG_SYSTEM_PROMPT.format(context=context)

        messages = [{"role": "system", "content": prompt}]
        if history:
            messages.extend(history[-6:])
        messages.append({"role": "user", "content": query})

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
                max_tokens=2000,
                stream=True,
            )
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"Stream generation failed: {e}")
            yield f"\n[生成出错: {str(e)}]"

    async def chat(
        self, db: AsyncSession, kb_id: UUID, question: str,
        top_k: int = None, history: List[Dict] = None,
        doc_id: UUID = None, folder_id: UUID = None,
    ) -> Dict:
        """Full advanced RAG pipeline."""
        sources = await self.retrieve(db, kb_id, question, top_k, doc_id, folder_id)
        answer = await self.generate(question, sources, history)
        return {
            "answer": answer,
            "sources": [
                {
                    "chunk_id": s["chunk_id"],
                    "content": s["content"][:300],
                    "score": s["score"],
                    "document_name": s["document_name"],
                }
                for s in sources
            ],
        }
