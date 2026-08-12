"""Smart KB - AI-powered knowledge base with RAG and knowledge graph."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import get_settings
from app.core.database import init_db
from app.api import kb, documents, rag, graph_api, admin, folders, faq

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: create tables
    await init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Smart KB",
    description="AI-powered knowledge base with RAG and knowledge graph",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads for file serving
os.makedirs(settings.upload_dir, exist_ok=True)

# Register routers
app.include_router(kb.router)
app.include_router(documents.router)
app.include_router(rag.router)
app.include_router(graph_api.router)
app.include_router(admin.router)
app.include_router(folders.router)
app.include_router(faq.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.0.0"}
