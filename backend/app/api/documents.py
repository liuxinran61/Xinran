"""Document management API - upload, list, delete, and process documents."""

import os
import uuid
import logging

logger = logging.getLogger(__name__)
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import KnowledgeBase, Document, Chunk, Entity, Relation, EntityDocument
from app.schemas.schemas import DocumentResponse, DocumentDetailResponse, DocumentUpdateRequest, ChunkResponse, URLImportRequest
from app.services.parser import DocumentParser
from app.services.chunker import TextChunker
from app.services.embedder import EmbeddingService
from app.services.extractor import KnowledgeExtractor
from app.services.graph import GraphService
from app.services.classifier import DocumentClassifier

router = APIRouter(prefix="/api", tags=["Documents"])
settings = get_settings()


async def _get_kb_or_404(kb_id: UUID, db: AsyncSession) -> KnowledgeBase:
    kb = (await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))).scalar_one_or_none()
    if not kb: raise HTTPException(status_code=404, detail="知识库不存在")
    return kb


async def _get_doc_or_404(doc_id: UUID, db: AsyncSession) -> Document:
    doc = (await db.execute(select(Document).where(Document.id == doc_id))).scalar_one_or_none()
    if not doc: raise HTTPException(status_code=404, detail="文档不存在")
    return doc


async def process_document_background(doc_id: UUID, kb_id: UUID, file_path: str, file_type: str, db_session_factory):
    """Background task: parse → chunk → embed → extract knowledge."""
    from app.core.database import async_session

    async with async_session() as db:
        try:
            # Update status to processing
            doc = (await db.execute(select(Document).where(Document.id == doc_id))).scalar_one()
            doc.parse_status = "processing"
            await db.commit()

            # 1. Parse document
            text = await DocumentParser.parse(file_path, file_type)

            # 1.2 AI title generation for uploaded files
            if file_type != "url":
                try:
                    from app.services.title_generator import TitleGenerator
                    title_gen = TitleGenerator()
                    ai_title = await title_gen.generate(text)
                    if ai_title:
                        # Preserve original extension
                        import os as _os
                        _orig_ext = _os.path.splitext(doc.filename)[1]
                        doc.filename = ai_title + _orig_ext
                        await db.commit()
                        logger.info(f"AI generated title for upload: {doc.filename}")
                except Exception as _te:
                    logger.warning(f"AI title generation skipped for upload: {_te}")

            # 1.5 Auto-classify into insurance CS scenario (rule-based fallback if LLM fails)
            try:
                classification = await DocumentClassifier.classify(text, doc.filename)
            except Exception:
                classification = DocumentClassifier.classify_rule_based(text, doc.filename)
            doc.classification = classification
            await db.commit()
            logger.info(f"Classified '{doc.filename}' as '{classification['scenario']}' ({classification['confidence']:.0%})")

            # 2. Chunk text
            chunker = TextChunker()
            chunks_data = chunker.split(text)

            # 3. Generate embeddings (best-effort)
            chunk_texts = [c["content"] for c in chunks_data]
            try:
                embeddings = await EmbeddingService.embed_texts(chunk_texts)
            except Exception:
                embeddings = []

            # 4. Save chunks (without embeddings if embedding failed)
            for i, chunk_data in enumerate(chunks_data):
                chunk = Chunk(
                    doc_id=doc_id,
                    kb_id=kb_id,
                    content=chunk_data["content"],
                    chunk_index=chunk_data["chunk_index"],
                    embedding=embeddings[i] if i < len(embeddings) else None,
                    metadata=chunk_data["metadata"],
                )
                db.add(chunk)

            # 5. Extract entities (best-effort)
            entity_count = 0
            try:
                extractor = KnowledgeExtractor()
                entities_data, relations_data = await extractor.extract_from_chunks(chunk_texts)
                entity_name_to_id = {}
                for e in entities_data:
                    existing = (await db.execute(
                        select(Entity).where(Entity.kb_id == kb_id, Entity.name == e["name"])
                    )).scalar_one_or_none()
                    if existing:
                        entity_name_to_id[e["name"]] = existing.id
                    else:
                        entity = Entity(kb_id=kb_id, name=e["name"], type=e.get("type", "concept"),
                                       aliases=e.get("aliases", []), properties=e.get("properties", {}))
                        db.add(entity)
                        await db.flush()
                        entity_name_to_id[e["name"]] = entity.id
                await GraphService.save_relations(db, kb_id, relations_data, entity_name_to_id, doc_id)
                entity_count = len(entity_name_to_id)
            except Exception as ee:
                logger.warning(f"Entity extraction skipped: {ee}")

            # 6. Mark complete
            doc.parse_status = "completed"
            doc.chunk_count = len(chunks_data)
            doc.entity_count = entity_count
            await db.commit()

        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            try:
                doc = (await db.execute(select(Document).where(Document.id == doc_id))).scalar_one()
                # Preserve classification even if processing fails
                if doc.classification:
                    doc.parse_status = "classified"  # classification worked, processing failed
                else:
                    doc.parse_status = "failed"
                await db.commit()
            except Exception:
                pass


@router.get("/knowledge-bases/{kb_id}/documents", response_model=List[DocumentResponse])
async def list_documents(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    """List all documents in a knowledge base."""
    await _get_kb_or_404(kb_id, db)
    result = await db.execute(
        select(Document).where(Document.kb_id == kb_id).order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.post("/knowledge-bases/{kb_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    kb_id: UUID,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload a document to a knowledge base. Processing happens in background."""
    await _get_kb_or_404(kb_id, db)

    # Validate file type
    file_type = DocumentParser.get_file_type(file.filename)
    supported = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".md", ".markdown",
                 ".pptx", ".ppt", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg",
                 ".mp3", ".wav", ".m4a", ".aac", ".mp4", ".mov"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext and ext not in supported:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    # Save file
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    save_path = os.path.join(settings.upload_dir, f"{file_id}{ext}")

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    # Create document record
    doc = Document(
        kb_id=kb_id,
        filename=file.filename,
        file_type=file_type,
        file_size=len(content),
        file_path=save_path,
        parse_status="pending",
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    await db.commit()

    # Trigger background processing
    bg = background_tasks or BackgroundTasks()
    bg.add_task(process_document_background, doc.id, kb_id, save_path, file_type, None)

    return DocumentResponse(
        id=doc.id,
        kb_id=doc.kb_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        parse_status=doc.parse_status,
        chunk_count=0,
        entity_count=0,
        created_at=doc.created_at,
    )


@router.post("/knowledge-bases/{kb_id}/import-url", response_model=DocumentResponse, status_code=201)
async def import_url(
    kb_id: UUID,
    req: URLImportRequest,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Import content from a URL into the knowledge base."""
    await _get_kb_or_404(kb_id, db)

    try:
        text = await DocumentParser.parse_url(req.url)
        if not text or len(text) < 50:
            raise HTTPException(status_code=400, detail=f"URL returned insufficient content ({len(text)} chars)")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"URL import failed for {req.url}: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch URL: {type(e).__name__}: {str(e) or repr(e)}",
        )

    # ── AI title generation ──
    title = req.title.strip() if req.title else ""
    if not title:
        try:
            from app.services.title_generator import TitleGenerator
            title_gen = TitleGenerator()
            ai_title = await title_gen.generate(text)
            if ai_title:
                title = ai_title
        except Exception as e:
            logger.warning(f"AI title generation skipped: {e}")

    if not title:
        title = req.url.split("/")[-1] or "webpage"

    # ── Save as markdown ──
    import os
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    filename = f"{title[:50]}.md"
    save_path = os.path.join(settings.upload_dir, f"{file_id}.md")

    with open(save_path, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n来源: {req.url}\n\n{text}")

    # Create document record
    doc = Document(
        kb_id=kb_id,
        filename=filename,
        file_type="url",
        file_size=len(text.encode("utf-8")),
        file_path=save_path,
        parse_status="pending",
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    await db.commit()

    # Trigger background processing
    bg = background_tasks or BackgroundTasks()
    bg.add_task(process_document_background, doc.id, kb_id, save_path, "md", None)

    return DocumentResponse(
        id=doc.id,
        kb_id=doc.kb_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        parse_status=doc.parse_status,
        chunk_count=0,
        entity_count=0,
        created_at=doc.created_at,
    )


@router.get("/documents/{doc_id}", response_model=DocumentDetailResponse)
async def get_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get document details with chunks."""
    doc = await _get_doc_or_404(doc_id, db)

    chunks_result = await db.execute(
        select(Chunk).where(Chunk.doc_id == doc_id).order_by(Chunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()

    return DocumentDetailResponse(
        id=doc.id,
        kb_id=doc.kb_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_size=doc.file_size,
        parse_status=doc.parse_status,
        chunk_count=doc.chunk_count,
        entity_count=doc.entity_count,
        created_at=doc.created_at,
        chunks=[
            ChunkResponse(
                id=c.id,
                doc_id=c.doc_id,
                chunk_index=c.chunk_index,
                content=c.content,
                metadata=c.chunk_metadata or {},
            )
            for c in chunks
        ],
    )


@router.patch("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: UUID, req: DocumentUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Update document metadata — move to folder, rename, edit tags/description."""
    doc = await _get_doc_or_404(doc_id, db)

    if req.folder_id is not None:
        doc.folder_id = req.folder_id

    if req.filename is not None:
        doc.filename = req.filename

    if req.tags is not None:
        doc.tags = req.tags

    if req.description is not None:
        doc.description = req.description

    await db.flush()
    await db.refresh(doc)
    return doc


@router.post("/documents/{doc_id}/copy", response_model=DocumentResponse, status_code=201)
async def copy_document(
    doc_id: UUID,
    target_folder_id: UUID | None = Query(None, description="Target folder ID to copy into"),
    db: AsyncSession = Depends(get_db),
):
    """Copy a document (and its chunks). Optional query: ?target_folder_id=<uuid>"""
    doc = await _get_doc_or_404(doc_id, db)

    # Create a new document record (copy metadata)
    import copy as _copy
    new_doc = Document(
        kb_id=doc.kb_id,
        filename=doc.filename + " (副本)",
        file_type=doc.file_type,
        file_size=doc.file_size,
        file_path=doc.file_path,
        parse_status=doc.parse_status,
        chunk_count=doc.chunk_count,
        entity_count=doc.entity_count,
        classification=_copy.deepcopy(doc.classification) if doc.classification else None,
        source_url=doc.source_url,
        folder_id=target_folder_id if target_folder_id is not None else doc.folder_id,
        tags=_copy.deepcopy(doc.tags) if doc.tags else [],
        description=doc.description,
    )
    db.add(new_doc)
    await db.flush()

    # Copy chunks
    chunks_result = await db.execute(
        select(Chunk).where(Chunk.doc_id == doc_id).order_by(Chunk.chunk_index)
    )
    for c in chunks_result.scalars().all():
        new_chunk = Chunk(
            doc_id=new_doc.id,
            kb_id=new_doc.kb_id,
            content=c.content,
            chunk_index=c.chunk_index,
            embedding=c.embedding,
            chunk_metadata=_copy.deepcopy(c.chunk_metadata) if c.chunk_metadata else {},
        )
        db.add(new_chunk)

    await db.commit()
    await db.refresh(new_doc)
    return new_doc


@router.get("/classified")
async def list_classified(db: AsyncSession = Depends(get_db)):
    """List all classified documents grouped by scenario/category.
    Used by the insurance CS knowledge page.
    """
    from sqlalchemy import and_

    result = await db.execute(
        select(Document)
        .where(Document.classification.isnot(None))
        .order_by(Document.created_at.desc())
        .limit(100)
    )
    docs = result.scalars().all()

    # Aggregate by category
    categories = {}
    for doc in docs:
        classification = doc.classification or {}
        cat = classification.get("category", "其他")
        if cat not in categories:
            categories[cat] = {"category": cat, "count": 0, "scenarios": {}}
        categories[cat]["count"] += 1

        scenario = classification.get("scenario", "未知")
        if scenario not in categories[cat]["scenarios"]:
            categories[cat]["scenarios"][scenario] = []
        categories[cat]["scenarios"][scenario].append({
            "id": str(doc.id),
            "filename": doc.filename,
            "scenario": scenario,
            "category": cat,
            "severity": classification.get("severity", "low"),
            "confidence": classification.get("confidence", 0),
            "keywords": classification.get("keywords", []),
            "reason": classification.get("reason", ""),
            "parse_status": doc.parse_status,
            "chunk_count": doc.chunk_count or 0,
            "entity_count": doc.entity_count or 0,
            "created_at": doc.created_at.isoformat() if doc.created_at else "",
        })

    return {
        "categories": [
            {
                "category": c["category"],
                "count": c["count"],
                "scenarios": [
                    {"name": name, "count": len(items), "items": items}
                    for name, items in c["scenarios"].items()
                ],
            }
            for c in sorted(categories.values(), key=lambda x: -x["count"])
        ],
        "total": len(docs),
    }


@router.put("/documents/{doc_id}/replace", response_model=DocumentResponse, status_code=201)
async def replace_document(
    doc_id: UUID,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Replace a document with a new version. Re-classifies and re-processes."""
    old = await _get_doc_or_404(doc_id, db)

    file_type = DocumentParser.get_file_type(file.filename)
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    save_path = os.path.join(settings.upload_dir, f"{file_id}{ext}")

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    new_version = (old.version or 1) + 1

    # Create new document, linked to old
    doc = Document(
        kb_id=old.kb_id,
        filename=file.filename or old.filename,
        file_type=file_type,
        file_size=len(content),
        file_path=save_path,
        parse_status="pending",
        version=new_version,
        replaces_doc_id=old.id,
        classification=old.classification,  # inherit classification, re-classify in bg
        source_url=old.source_url,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    # Mark old as "replaced"
    old.parse_status = "replaced"
    await db.commit()

    # Trigger background processing with re-classification
    bg = background_tasks or BackgroundTasks()
    bg.add_task(process_document_background, doc.id, old.kb_id, save_path, file_type, None)

    return DocumentResponse(
        id=doc.id, kb_id=doc.kb_id, filename=doc.filename,
        file_type=doc.file_type, file_size=doc.file_size,
        parse_status="pending", chunk_count=0, entity_count=0,
        created_at=doc.created_at,
    )


@router.get("/documents/{doc_id}/versions")
async def get_document_versions(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get version history for a document chain."""
    await _get_doc_or_404(doc_id, db)
    # Walk the chain backwards to find the original
    versions = []
    current_id = doc_id
    visited = set()

    while current_id and current_id not in visited:
        visited.add(current_id)
        result = await db.execute(select(Document).where(Document.id == current_id))
        doc = result.scalar_one_or_none()
        if not doc:
            break
        versions.append({
            "id": str(doc.id),
            "filename": doc.filename,
            "version": doc.version or 1,
            "file_size": doc.file_size,
            "parse_status": doc.parse_status,
            "classification": doc.classification,
            "created_at": doc.created_at.isoformat() if doc.created_at else "",
        })
        current_id = doc.replaces_doc_id

    return {"versions": sorted(versions, key=lambda v: v["version"], reverse=True)}


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a document and its chunks."""
    doc = await _get_doc_or_404(doc_id, db)

    # Delete file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    await db.delete(doc)

