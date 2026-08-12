import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Integer, BigInteger, DateTime, ForeignKey, JSON, Index, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base
from app.core.config import get_settings

settings = get_settings()


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    icon = Column(String(50), default="folder")
    visibility = Column(String(20), default="personal")  # personal / shared
    cover_image = Column(String(500), nullable=True)
    join_mode = Column(String(20), default="direct")  # direct / approval
    recommended_questions = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship("Document", back_populates="knowledge_base", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="knowledge_base", cascade="all, delete-orphan")
    relations = relationship("Relation", back_populates="knowledge_base", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="knowledge_base", cascade="all, delete-orphan")
    sessions = relationship("ChatSession", back_populates="knowledge_base", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="knowledge_base", cascade="all, delete-orphan")
    faq_items = relationship("FAQItem", back_populates="knowledge_base", cascade="all, delete-orphan")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="folders")
    children = relationship("Folder", backref="parent", remote_side=[id])


class FAQItem(Base):
    __tablename__ = "faq_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="faq_items")


class KBMember(Base):
    __tablename__ = "kb_members"

    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(100), primary_key=True)
    role = Column(String(20), default="member")  # admin / member
    can_view = Column(Boolean, default=True)
    can_export = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, docx, txt, md, pptx
    file_size = Column(BigInteger, default=0)
    file_path = Column(String(500), nullable=False)
    parse_status = Column(String(50), default="pending")  # pending, processing, completed, failed
    chunk_count = Column(Integer, default=0)
    entity_count = Column(Integer, default=0)
    classification = Column(JSON, nullable=True)  # {scenario, category, severity, confidence, keywords}
    source_url = Column(String(1000), nullable=True)
    folder_id = Column(UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
    version = Column(Integer, default=1)
    replaces_doc_id = Column(UUID(as_uuid=True), nullable=True)  # points to old doc this replaces
    tags = Column(JSON, default=list)  # user-editable tags/labels: ["tag1", "tag2"]
    description = Column(Text, nullable=True)  # user-editable description shown in tooltip
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_documents_kb_id", "kb_id"),
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    embedding = Column(Vector(settings.embedding_dim), nullable=True)
    chunk_metadata = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("idx_chunks_doc_id", "doc_id"),
        Index("idx_chunks_kb_id", "kb_id"),
    )


class Entity(Base):
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    type = Column(String(100), nullable=False)  # person, organization, concept, technology, product, location, event
    aliases = Column(ARRAY(Text), default=[])
    properties = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="entities")

    __table_args__ = (
        Index("idx_entities_kb_id", "kb_id"),
        Index("idx_entities_type", "kb_id", "type"),
    )


class Relation(Base):
    __tablename__ = "relations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    source_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(100), nullable=False)
    properties = Column(JSON, default=dict)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="relations")

    __table_args__ = (
        Index("idx_relations_kb_id", "kb_id"),
    )


class EntityDocument(Base):
    __tablename__ = "entity_documents"

    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), primary_key=True)
    doc_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), default="新会话")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="sessions")
    conversations = relationship("Conversation", back_populates="session", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kb_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=[])  # list of {chunk_id, content, score}
    liked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_base = relationship("KnowledgeBase", back_populates="conversations")
    session = relationship("ChatSession", back_populates="conversations")

    __table_args__ = (
        Index("idx_conversations_kb_id", "kb_id", "created_at"),
        Index("idx_conversations_session_id", "session_id", "created_at"),
    )
