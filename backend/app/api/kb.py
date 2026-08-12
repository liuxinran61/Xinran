"""Knowledge base management API."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import KnowledgeBase, Document, Entity
from app.schemas.schemas import KBCreate, KBUpdate, KBResponse

router = APIRouter(prefix="/api/knowledge-bases", tags=["Knowledge Bases"])

async def _to_response(kb: KnowledgeBase, db) -> dict:
    doc_count = (await db.execute(select(func.count(Document.id)).where(Document.kb_id == kb.id))).scalar() or 0
    entity_count = (await db.execute(select(func.count(Entity.id)).where(Entity.kb_id == kb.id))).scalar() or 0
    return {
        "id": kb.id, "name": kb.name, "description": kb.description or "",
        "icon": kb.icon or "folder", "visibility": kb.visibility or "personal",
        "cover_image": kb.cover_image, "join_mode": kb.join_mode or "direct",
        "recommended_questions": kb.recommended_questions or [],
        "document_count": doc_count, "entity_count": entity_count,
        "created_at": kb.created_at, "updated_at": kb.updated_at,
    }

@router.get("")
async def list_kbs(visibility: str = None, db: AsyncSession = Depends(get_db)):
    q = select(KnowledgeBase).order_by(KnowledgeBase.updated_at.desc())
    if visibility: q = q.where(KnowledgeBase.visibility == visibility)
    result = await db.execute(q)
    kbs = result.scalars().all()
    return [await _to_response(kb, db) for kb in kbs]

@router.get("/{kb_id}")
async def get_kb(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    kb = (await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))).scalar_one_or_none()
    if not kb: raise HTTPException(status_code=404)
    return await _to_response(kb, db)

@router.post("", status_code=201)
async def create_kb(data: KBCreate, db: AsyncSession = Depends(get_db)):
    kb = KnowledgeBase(name=data.name, description=data.description, icon=data.icon,
                       visibility=data.visibility, join_mode=data.join_mode)
    db.add(kb); await db.flush(); await db.refresh(kb)
    return await _to_response(kb, db)

@router.patch("/{kb_id}")
async def update_kb(kb_id: UUID, data: KBUpdate, db: AsyncSession = Depends(get_db)):
    kb = (await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))).scalar_one_or_none()
    if not kb: raise HTTPException(status_code=404)
    if data.name is not None: kb.name = data.name
    if data.description is not None: kb.description = data.description
    if data.visibility is not None: kb.visibility = data.visibility
    if data.join_mode is not None: kb.join_mode = data.join_mode
    if data.recommended_questions is not None: kb.recommended_questions = data.recommended_questions
    if data.cover_image is not None: kb.cover_image = data.cover_image
    await db.flush()
    return await _to_response(kb, db)

@router.delete("/{kb_id}", status_code=204)
async def delete_kb(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    kb = (await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))).scalar_one_or_none()
    if not kb: raise HTTPException(status_code=404)
    await db.delete(kb)
