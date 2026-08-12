"""Folder management API."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import Folder, Document, KnowledgeBase
from app.schemas.schemas import FolderCreate
from pydantic import BaseModel

router = APIRouter(prefix="/api/knowledge-bases", tags=["Folders"])

def _build_tree(folders: list, parent_id=None) -> list:
    return [{"id": str(f.id), "kb_id": str(f.kb_id), "parent_id": str(f.parent_id) if f.parent_id else None,
             "name": f.name, "created_at": f.created_at.isoformat(),
             "children": _build_tree(folders, f.id)} for f in folders if f.parent_id == parent_id]


@router.get("/{kb_id}/folders")
async def list_folders(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Folder).where(Folder.kb_id == kb_id).order_by(Folder.name))
    folders = result.scalars().all()
    return _build_tree(folders)


@router.post("/{kb_id}/folders", status_code=201)
async def create_folder(kb_id: UUID, data: FolderCreate, db: AsyncSession = Depends(get_db)):
    folder = Folder(kb_id=kb_id, name=data.name, parent_id=data.parent_id)
    db.add(folder); await db.flush(); await db.refresh(folder)
    return {"id": str(folder.id), "kb_id": str(kb_id), "parent_id": str(folder.parent_id) if folder.parent_id else None, "name": folder.name}


@router.delete("/{kb_id}/folders/{folder_id}", status_code=204)
async def delete_folder(kb_id: UUID, folder_id: UUID, db: AsyncSession = Depends(get_db)):
    folder = (await db.execute(select(Folder).where(Folder.id == folder_id, Folder.kb_id == kb_id))).scalar_one_or_none()
    if not folder: raise HTTPException(status_code=404)
    await db.delete(folder)


class FolderRenameRequest(BaseModel):
    name: str


@router.patch("/{kb_id}/folders/{folder_id}")
async def rename_folder(kb_id: UUID, folder_id: UUID, data: FolderRenameRequest, db: AsyncSession = Depends(get_db)):
    folder = (await db.execute(select(Folder).where(Folder.id == folder_id, Folder.kb_id == kb_id))).scalar_one_or_none()
    if not folder: raise HTTPException(status_code=404)
    folder.name = data.name
    await db.flush()
    return {"id": str(folder.id), "name": folder.name}
