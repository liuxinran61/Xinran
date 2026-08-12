"""Keyword search using jieba + pg_trgm for Chinese text."""

import jieba
import logging
from typing import List, Dict
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class KeywordSearchService:
    """Full-text keyword search with Chinese word segmentation."""

    @staticmethod
    def _segment(query: str) -> List[str]:
        """Segment Chinese query into keywords, filtering noise."""
        words = jieba.lcut(query)
        # Keep meaningful words (length >= 2 or alphanumeric)
        keywords = [w.strip() for w in words if len(w.strip()) >= 2 or w.isalnum()]
        return keywords[:20]  # Cap at 20 keywords

    @staticmethod
    async def search(
        db: AsyncSession, kb_id: UUID, query: str, top_k: int = 10,
        doc_id: UUID = None, folder_id: UUID = None,
    ) -> List[Dict]:
        """Keyword search using trigram similarity + ILIKE."""

        keywords = KeywordSearchService._segment(query)
        if not keywords:
            return []

        # Build a combined search: for each keyword, check trigram similarity
        # and ILIKE matching against chunks
        # Use pg_trgm similarity() function + word ILIKE
        conditions = []
        params: dict = {"kb_id": str(kb_id)}

        for i, kw in enumerate(keywords):
            param_name = f"kw_{i}"
            conditions.append(
                f"(c.content ILIKE '%' || :{param_name} || '%' "
                f"OR similarity(c.content, :{param_name}) > 0.15)"
            )
            params[param_name] = kw

        where_clause = " OR ".join(conditions)

        doc_filter = "AND c.doc_id = CAST(:doc_id AS uuid)" if doc_id else ""
        folder_filter = "AND d.folder_id = CAST(:folder_id AS uuid)" if folder_id else ""

        sql = text(f"""
            SELECT DISTINCT ON (c.id)
                c.id, c.content, c.doc_id, d.filename, d.version,
                GREATEST(
                    similarity(c.content, :query_text),
                    CASE WHEN c.content ILIKE '%' || :query_text || '%' THEN 0.5 ELSE 0 END
                ) AS score
            FROM chunks c
            JOIN documents d ON c.doc_id = d.id
            WHERE c.kb_id = CAST(:kb_id AS uuid)
              {doc_filter}
              {folder_filter}
              AND d.parse_status NOT IN ('replaced', 'failed')
              AND ({where_clause})
            ORDER BY c.id, score DESC
            LIMIT :top_k
        """)

        params["query_text"] = query
        params["top_k"] = top_k
        if doc_id:
            params["doc_id"] = str(doc_id)
        if folder_id:
            params["folder_id"] = str(folder_id)

        try:
            result = await db.execute(sql, params)
            rows = result.fetchall()

            return [
                {
                    "chunk_id": str(row[0]),
                    "content": row[1],
                    "doc_id": str(row[2]),
                    "document_name": f"{row[3]} (v{row[4] or 1})",
                    "score": round(float(row[5]), 4),
                    "source": "keyword",
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Keyword search failed: {e}")
            return []
