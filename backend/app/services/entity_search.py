"""Entity-based search using the knowledge graph."""

import logging
from typing import List, Dict
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class EntitySearchService:
    """Search for relevant chunks via knowledge-graph entities."""

    @staticmethod
    async def search(
        db: AsyncSession, kb_id: UUID, query: str, top_k: int = 5,
        doc_id: UUID = None, folder_id: UUID = None,
    ) -> List[Dict]:
        """
        Find entities matching query keywords, then retrieve chunks
        from the documents those entities belong to.
        """

        doc_filter = "AND c.doc_id = CAST(:doc_id AS uuid)" if doc_id else ""
        folder_filter = "AND d.folder_id = CAST(:folder_id AS uuid)" if folder_id else ""

        sql = text(f"""
            WITH matched_entities AS (
                SELECT e.id, e.name, e.type,
                       similarity(e.name, :query) AS name_sim
                FROM entities e
                WHERE e.kb_id = CAST(:kb_id AS uuid)
                  AND (e.name ILIKE '%' || :query || '%'
                       OR similarity(e.name, :query) > 0.2)
                ORDER BY name_sim DESC
                LIMIT 10
            ),
            entity_chunks AS (
                SELECT DISTINCT c.id, c.content, c.doc_id,
                       d.filename, d.version,
                       me.name AS entity_name, me.type AS entity_type,
                       me.name_sim
                FROM matched_entities me
                JOIN entity_documents ed ON ed.entity_id = me.id
                JOIN chunks c ON c.doc_id = ed.doc_id
                JOIN documents d ON c.doc_id = d.id
                WHERE c.kb_id = CAST(:kb_id AS uuid)
                  {doc_filter}
                  {folder_filter}
                  AND d.parse_status NOT IN ('replaced', 'failed')
            )
            SELECT id, content, doc_id, filename, version,
                   entity_name, entity_type, name_sim
            FROM entity_chunks
            ORDER BY name_sim DESC
            LIMIT :top_k
        """)

        params: dict = {
            "kb_id": str(kb_id),
            "query": query,
            "top_k": top_k,
        }
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
                    "entity": row[5],
                    "entity_type": row[6],
                    "score": round(float(row[7]), 4),
                    "source": "entity",
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Entity search failed: {e}")
            return []
