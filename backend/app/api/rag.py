"""RAG (Retrieval-Augmented Generation) API — chat, sessions, conversations."""

import json
import logging
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Conversation, ChatSession, KnowledgeBase
from app.schemas.schemas import (
    ChatRequest, ChatResponse, SearchRequest, SearchResponse,
    CreateSessionRequest, SessionResponse, ConversationResponse,
    AgentRequest,
)
from app.services.rag import RAGService
from app.core.config import get_settings
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/knowledge-bases", tags=["RAG"])


# ── helpers ──────────────────────────────────────────────────

async def _verify_kb_owner(kb_id: UUID, db: AsyncSession):
    kb = (await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == kb_id))).scalar_one_or_none()
    if not kb: raise HTTPException(404, "知识库不存在")
    return kb

async def _save_conversation(db: AsyncSession, kb_id: UUID, session_id: UUID,
                             role: str, content: str, sources: list = None):
    """Persist a single conversation turn."""
    msg = Conversation(
        kb_id=kb_id, session_id=session_id,
        role=role, content=content, sources=sources or [],
    )
    db.add(msg)
    # Touch session updated_at
    await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    await db.flush()


# ── Sessions ──────────────────────────────────────────────────

@router.get("/{kb_id}/sessions")
async def list_sessions(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    """List chat sessions for a knowledge base, newest first."""
    rows = (await db.execute(
        select(
            ChatSession.id, ChatSession.kb_id, ChatSession.title,
            ChatSession.created_at, ChatSession.updated_at,
            func.count(Conversation.id).label("msg_count"),
        )
        .outerjoin(Conversation, Conversation.session_id == ChatSession.id)
        .where(ChatSession.kb_id == kb_id)
        .group_by(ChatSession.id)
        .order_by(ChatSession.updated_at.desc())
    )).all()

    return [
        {
            "id": str(r[0]), "kb_id": str(r[1]), "title": r[2],
            "message_count": r[5],
            "created_at": r[3].isoformat(), "updated_at": r[4].isoformat(),
        }
        for r in rows
    ]


@router.post("/{kb_id}/sessions")
async def create_session(kb_id: UUID, req: CreateSessionRequest,
                         db: AsyncSession = Depends(get_db)):
    """Create a new chat session."""
    title = req.title if req.title else "新会话"
    session = ChatSession(kb_id=kb_id, title=title[:200])
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return {
        "id": str(session.id), "kb_id": str(session.kb_id),
        "title": session.title, "message_count": 0,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat(),
    }


@router.patch("/{kb_id}/sessions/{session_id}")
async def rename_session(kb_id: UUID, session_id: UUID, req: CreateSessionRequest,
                         db: AsyncSession = Depends(get_db)):
    """Rename a chat session."""
    session = (await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.kb_id == kb_id)
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    if req.title:
        session.title = req.title[:200]
        session.updated_at = datetime.utcnow()
    await db.flush()
    return {"ok": True}


@router.delete("/{kb_id}/sessions/{session_id}")
async def delete_session(kb_id: UUID, session_id: UUID,
                         db: AsyncSession = Depends(get_db)):
    """Delete a session and all its messages."""
    session = (await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.kb_id == kb_id)
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await db.delete(session)
    await db.flush()
    return {"ok": True}


# ── Conversations ─────────────────────────────────────────────

@router.get("/{kb_id}/conversations")
async def get_conversations(kb_id: UUID, session_id: UUID = None,
                            db: AsyncSession = Depends(get_db)):
    """Get conversation history, optionally filtered by session."""
    q = select(Conversation).where(Conversation.kb_id == kb_id)
    if session_id:
        q = q.where(Conversation.session_id == session_id)
    q = q.order_by(Conversation.created_at.asc()).limit(200)

    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": str(c.id), "kb_id": str(c.kb_id),
            "session_id": str(c.session_id) if c.session_id else None,
            "role": c.role, "content": c.content,
            "sources": c.sources or [], "liked": c.liked or False,
            "created_at": c.created_at.isoformat(),
        }
        for c in rows
    ]


@router.delete("/{kb_id}/conversations/{conv_id}")
async def delete_conversation(kb_id: UUID, conv_id: UUID,
                              db: AsyncSession = Depends(get_db)):
    """Delete a single conversation message."""
    msg = (await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.kb_id == kb_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
    await db.delete(msg)
    await db.flush()
    return {"ok": True}


@router.patch("/{kb_id}/conversations/{conv_id}/like")
async def toggle_like(kb_id: UUID, conv_id: UUID,
                      db: AsyncSession = Depends(get_db)):
    """Toggle the liked status of a conversation message."""
    msg = (await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.kb_id == kb_id)
    )).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
    msg.liked = not (msg.liked or False)
    await db.flush()
    await db.commit()
    return {"liked": msg.liked}


@router.get("/{kb_id}/conversations/liked")
async def get_liked_conversations(kb_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get all liked conversations for a knowledge base."""
    rows = (await db.execute(
        select(Conversation)
        .where(Conversation.kb_id == kb_id, Conversation.liked == True)
        .order_by(Conversation.created_at.desc())
        .limit(100)
    )).scalars().all()
    return [
        {
            "id": str(c.id), "kb_id": str(c.kb_id),
            "session_id": str(c.session_id) if c.session_id else None,
            "role": c.role, "content": c.content,
            "sources": c.sources or [], "liked": True,
            "created_at": c.created_at.isoformat(),
        }
        for c in rows
    ]


# ── Chat ──────────────────────────────────────────────────────

@router.post("/{kb_id}/chat/stream")
async def chat_stream(kb_id: UUID, req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """RAG chat with SSE streaming — now persists conversations."""
    await _verify_kb_owner(kb_id, db)
    rag = RAGService(user_api_key=None, user_model=None)
    sources = await rag.retrieve(db, kb_id, req.question, req.top_k, doc_id=req.doc_id, folder_id=req.folder_id)

    # Resolve or create session
    session_id = req.session_id
    if session_id:
        session = (await db.execute(
            select(ChatSession).where(ChatSession.id == session_id, ChatSession.kb_id == kb_id)
        )).scalar_one_or_none()
        if not session:
            session_id = None

    if not session_id:
        session = ChatSession(
            kb_id=kb_id,
            title=req.question[:40] + ("..." if len(req.question) > 40 else ""),
        )
        db.add(session)
        await db.flush()
        session_id = session.id

    # Save user message
    await _save_conversation(db, kb_id, session_id, "user", req.question)

    async def event_stream():
        full_answer = ""

        # Send session_id + sources first
        yield f"data: {json.dumps({'session_id': str(session_id), 'sources': [
            {'chunk_id': s['chunk_id'], 'content': s['content'][:300],
             'score': s['score'], 'document_name': s['document_name']}
            for s in sources
        ]}, ensure_ascii=False)}\n\n"

        # Stream tokens
        async for token in rag.generate_stream(req.question, sources):
            full_answer += token
            yield f"data: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"

        # Save assistant message
        await _save_conversation(db, kb_id, session_id, "assistant", full_answer, [
            {"chunk_id": s["chunk_id"], "content": s["content"][:300],
             "score": s["score"], "document_name": s["document_name"]}
            for s in sources
        ])
        await db.commit()

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{kb_id}/chat", response_model=ChatResponse)
async def chat(kb_id: UUID, req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """RAG chat (non-streaming) with persistence."""
    await _verify_kb_owner(kb_id, db)
    rag = RAGService(user_api_key=None, user_model=None)
    result = await rag.chat(db, kb_id, req.question, req.top_k, doc_id=req.doc_id, folder_id=req.folder_id)

    # Resolve/create session
    session_id = req.session_id
    if not session_id:
        session = ChatSession(
            kb_id=kb_id,
            title=req.question[:40] + ("..." if len(req.question) > 40 else ""),
        )
        db.add(session)
        await db.flush()
        session_id = session.id

    await _save_conversation(db, kb_id, session_id, "user", req.question)
    await _save_conversation(db, kb_id, session_id, "assistant", result["answer"], result["sources"])
    await db.flush()

    return ChatResponse(**result)


@router.post("/{kb_id}/search", response_model=SearchResponse)
async def search(kb_id: UUID, req: SearchRequest, db: AsyncSession = Depends(get_db)):
    """Vector search only — retrieve relevant chunks without generation."""
    await _verify_kb_owner(kb_id, db)
    rag = RAGService()
    sources = await rag.retrieve(db, kb_id, req.query, req.top_k, doc_id=req.doc_id, folder_id=req.folder_id)
    return SearchResponse(results=[
        {
            "chunk_id": s["chunk_id"],
            "content": s["content"][:500],
            "score": s["score"],
            "document_name": s["document_name"],
        }
        for s in sources
    ])


# ── Agent ──────────────────────────────────────────────────────

@router.post("/{kb_id}/agent/chat")
async def agent_chat(kb_id: UUID, req: AgentRequest, db: AsyncSession = Depends(get_db)):
    """Agent endpoint — proxies messages + tools to DeepSeek, returns raw response."""
    await _verify_kb_owner(kb_id, db)
    settings = get_settings()
    client = AsyncOpenAI(
        base_url=settings.llm_api_base,
        api_key=settings.llm_api_key,
    )

    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=req.messages,
        tools=req.tools,
        temperature=0.3,
        max_tokens=2000,
    )

    choice = resp.choices[0].message
    if choice.tool_calls:
        return {
            "type": "tool_calls",
            "tool_calls": [
                {
                    "id": tc.id,
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in choice.tool_calls
            ],
        }
    return {"type": "message", "content": choice.content}
