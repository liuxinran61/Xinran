from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Smart KB"
    debug: bool = True

    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "smartkb"
    db_password: str = "smartkb123"
    db_name: str = "smart_kb"

    @property
    def database_url(self) -> str:
        return f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def database_url_sync(self) -> str:
        return f"postgresql+psycopg2://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    # LLM
    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = "sk-your-api-key"
    llm_model: str = "gpt-4o-mini"

    # Embedding
    embedding_model: str = "BAAI/bge-large-zh-v1.5"
    embedding_dim: int = 1024
    # Use local sentence-transformers by default (set to True for API-based)
    embedding_use_local: bool = True

    # Upload
    upload_dir: str = "./uploads"
    max_upload_size: int = 50 * 1024 * 1024  # 50MB

    # Chunking — larger chunks preserve article structure better
    chunk_size: int = 1024
    chunk_overlap: int = 100

    # RAG
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.5
    # Performance: disable heavy features for small KBs
    rag_enable_query_expansion: bool = False   # extra LLM call for query variants
    rag_enable_reranker: bool = False          # local CrossEncoder CPU inference

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
