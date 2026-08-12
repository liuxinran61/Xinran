from pydantic import BaseModel, Field
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime

# ===== Knowledge Base =====
class KBCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    icon: str = "folder"
    visibility: str = "personal"
    join_mode: str = "direct"

class KBUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    join_mode: Optional[str] = None
    recommended_questions: Optional[List[str]] = None
    cover_image: Optional[str] = None

class KBResponse(BaseModel):
    id: UUID; name: str; description: str = ""; icon: str = "folder"
    visibility: str = "personal"; cover_image: Optional[str] = None
    join_mode: str = "direct"; recommended_questions: list = []
    document_count: int = 0; entity_count: int = 0
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True

# ===== Folder =====
class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[UUID] = None

class FolderResponse(BaseModel):
    id: UUID; kb_id: UUID; parent_id: Optional[UUID] = None
    name: str; created_at: datetime
    children: List["FolderResponse"] = []
    class Config: from_attributes = True

# ===== FAQ =====
class FAQCreate(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)

class FAQResponse(BaseModel):
    id: UUID; kb_id: UUID; question: str; answer: str
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True

# ===== Document =====
class URLImportRequest(BaseModel):
    url: str = Field(..., min_length=5); title: str = ""

class DocumentUpdateRequest(BaseModel):
    """Partial update supported: folder_id (move), filename (rename), tags, description."""
    folder_id: Optional[UUID] = None
    filename: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None

class DocumentResponse(BaseModel):
    id: UUID; kb_id: UUID; filename: str; file_type: str
    file_size: int; parse_status: str; chunk_count: int; entity_count: int
    classification: Optional[dict] = None; version: Optional[int] = None
    replaces_doc_id: Optional[UUID] = None; folder_id: Optional[UUID] = None
    tags: List[str] = []; description: Optional[str] = None
    created_at: datetime
    class Config: from_attributes = True

class ChunkResponse(BaseModel):
    id: UUID; doc_id: UUID; chunk_index: int; content: str; metadata: dict = {}
    class Config: from_attributes = True

class DocumentDetailResponse(DocumentResponse):
    chunks: List[ChunkResponse] = []

# ===== RAG =====
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int = 5
    session_id: Optional[UUID] = None
    doc_id: Optional[UUID] = None   # optional: scope to single document
    folder_id: Optional[UUID] = None  # optional: scope to documents in a folder

class SourceItem(BaseModel): chunk_id: str; content: str; score: float; document_name: str
class ChatResponse(BaseModel): answer: str; sources: List[SourceItem] = []
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = 5
    doc_id: Optional[UUID] = None
    folder_id: Optional[UUID] = None
class SearchResultItem(BaseModel): chunk_id: str; content: str; score: float; document_name: str
class SearchResponse(BaseModel): results: List[SearchResultItem] = []

# ===== Chat Sessions =====
class CreateSessionRequest(BaseModel):
    title: str = ""

class SessionResponse(BaseModel):
    id: UUID; kb_id: UUID; title: str
    message_count: int = 0
    created_at: datetime; updated_at: datetime
    class Config: from_attributes = True

class ConversationResponse(BaseModel):
    id: UUID; kb_id: UUID; session_id: Optional[UUID] = None
    role: str; content: str; sources: list = []
    created_at: datetime
    class Config: from_attributes = True

# ===== Knowledge Graph =====
class EntityResponse(BaseModel):
    id: UUID; kb_id: UUID; name: str; type: str; aliases: List[str] = []; properties: Optional[dict] = None
    class Config: from_attributes = True

class RelationResponse(BaseModel):
    id: UUID; kb_id: UUID; source_entity_id: UUID; target_entity_id: UUID
    relation_type: str; properties: Optional[dict] = None
    class Config: from_attributes = True
class GraphCategory(BaseModel): name: str; itemStyle: Optional[dict] = None
class GraphNode(BaseModel): id: str; name: str; type: str; symbolSize: int = 30; category: str = ""
class GraphEdge(BaseModel): source: str; target: str; label: str; relation_type: str
class GraphResponse(BaseModel): nodes: List[GraphNode] = []; edges: List[GraphEdge] = []; categories: List[GraphCategory] = []

# ===== Agent =====
class AgentRequest(BaseModel):
    messages: List[dict]  # [{role, content, tool_calls?, tool_call_id?}]
    tools: List[dict]     # OpenAI function calling tool definitions

# ===== Admin =====
class SystemStats(BaseModel):
    kb_count: int = 0; document_count: int = 0; chunk_count: int = 0
    entity_count: int = 0; relation_count: int = 0; total_storage_bytes: int = 0

class SystemConfig(BaseModel):
    llm_api_base: str; llm_model: str; embedding_model: str
    chunk_size: int; chunk_overlap: int; rag_top_k: int; rag_similarity_threshold: float
    rag_enable_query_expansion: bool = False; rag_enable_reranker: bool = False
