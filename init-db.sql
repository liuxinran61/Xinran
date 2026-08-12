-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index support (pgvector 0.5+)
-- Will be used later for vector indexes
