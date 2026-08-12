"""Embedding service for vectorizing text chunks."""

from typing import List
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generate embeddings for text using sentence-transformers or API."""

    _model = None

    @classmethod
    def _get_local_model(cls):
        if cls._model is None:
            import os
            from sentence_transformers import SentenceTransformer
            settings = get_settings()
            logger.info(f"Loading embedding model: {settings.embedding_model}")
            # Use HF_HUB_OFFLINE + local_files_only to avoid hanging on HuggingFace connection
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            cls._model = SentenceTransformer(
                settings.embedding_model,
                local_files_only=True,
            )
        return cls._model

    @classmethod
    async def embed_texts(cls, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        settings = get_settings()

        if settings.embedding_use_local:
            import asyncio
            model = cls._get_local_model()
            loop = asyncio.get_running_loop()
            embeddings = await loop.run_in_executor(
                None,
                lambda: model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            )
            return embeddings.tolist()
        else:
            # Use OpenAI-compatible API for embeddings
            from openai import AsyncOpenAI
            client = AsyncOpenAI(base_url=settings.llm_api_base, api_key=settings.llm_api_key)
            response = await client.embeddings.create(
                model="text-embedding-3-large",
                input=texts,
            )
            return [r.embedding for r in response.data]

    @classmethod
    async def embed_query(cls, query: str) -> List[float]:
        """Generate embedding for a single query."""
        results = await cls.embed_texts([query])
        return results[0]
