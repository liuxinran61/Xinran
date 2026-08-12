"""Knowledge graph API."""

from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Entity, Relation
from app.schemas.schemas import EntityResponse, RelationResponse, GraphResponse
from app.services.graph import GraphService

router = APIRouter(prefix="/api/knowledge-bases", tags=["Knowledge Graph"])


@router.get("/{kb_id}/graph", response_model=GraphResponse)
async def get_graph(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get full knowledge graph data for visualization."""
    data = await GraphService.get_graph_data(db, kb_id)
    return GraphResponse(**data)


@router.get("/{kb_id}/entities", response_model=List[EntityResponse])
async def get_entities(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all entities in a knowledge base."""
    result = await db.execute(
        select(Entity).where(Entity.kb_id == kb_id).order_by(Entity.name)
    )
    return result.scalars().all()


@router.get("/{kb_id}/relations", response_model=List[RelationResponse])
async def get_relations(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all relations in a knowledge base."""
    result = await db.execute(
        select(Relation).where(Relation.kb_id == kb_id)
    )
    return result.scalars().all()
