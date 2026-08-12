"""FAQ management API."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import FAQItem
from app.schemas.schemas import FAQCreate

router = APIRouter(prefix="/api/knowledge-bases", tags=["FAQ"])

@router.get("/{kb_id}/faq")
async def list_faq(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FAQItem).where(FAQItem.kb_id == kb_id).order_by(FAQItem.created_at.desc()))
    items = result.scalars().all()
    return [{"id": str(f.id), "question": f.question, "answer": f.answer, "created_at": f.created_at.isoformat()} for f in items]

@router.post("/{kb_id}/faq", status_code=201)
async def create_faq(kb_id: UUID, data: FAQCreate, db: AsyncSession = Depends(get_db)):
    item = FAQItem(kb_id=kb_id, question=data.question, answer=data.answer)
    db.add(item); await db.flush(); await db.refresh(item)
    return {"id": str(item.id), "question": item.question, "answer": item.answer}

@router.delete("/{kb_id}/faq/{faq_id}", status_code=204)
async def delete_faq(kb_id: UUID, faq_id: UUID, db: AsyncSession = Depends(get_db)):
    item = (await db.execute(select(FAQItem).where(FAQItem.id == faq_id, FAQItem.kb_id == kb_id))).scalar_one_or_none()
    if not item: raise HTTPException(status_code=404)
    await db.delete(item)
