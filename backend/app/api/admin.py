"""Admin management API."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import KnowledgeBase, Document, Chunk, Entity, Relation
from app.schemas.schemas import SystemStats, SystemConfig

router = APIRouter(prefix="/api/admin", tags=["Admin"])
settings = get_settings()


@router.get("/stats", response_model=SystemStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get system-wide statistics."""
    kb_count = (await db.execute(select(func.count(KnowledgeBase.id)))).scalar() or 0
    doc_count = (await db.execute(select(func.count(Document.id)))).scalar() or 0
    chunk_count = (await db.execute(select(func.count(Chunk.id)))).scalar() or 0
    entity_count = (await db.execute(select(func.count(Entity.id)))).scalar() or 0
    relation_count = (await db.execute(select(func.count(Relation.id)))).scalar() or 0

    total_size = (await db.execute(select(func.sum(Document.file_size)))).scalar() or 0

    return SystemStats(
        kb_count=kb_count,
        document_count=doc_count,
        chunk_count=chunk_count,
        entity_count=entity_count,
        relation_count=relation_count,
        total_storage_bytes=total_size,
    )


@router.get("/config", response_model=SystemConfig)
async def get_config():
    """Get current system configuration."""
    return SystemConfig(
        llm_api_base=settings.llm_api_base,
        llm_model=settings.llm_model,
        embedding_model=settings.embedding_model,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        rag_top_k=settings.rag_top_k,
        rag_similarity_threshold=settings.rag_similarity_threshold,
        rag_enable_query_expansion=settings.rag_enable_query_expansion,
        rag_enable_reranker=settings.rag_enable_reranker,
    )
