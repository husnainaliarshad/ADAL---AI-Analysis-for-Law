-- =============================================================================
-- Local PostgreSQL Schema for ADAL Backend
-- =============================================================================
-- Purpose: AI/ML processing, heavy data storage, embeddings
-- Database: adal_local
-- ID Type: Integer (SERIAL) for compatibility with existing Neon schema
-- =============================================================================

-- Enable UUID extension (for storing Supabase UUID references)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Table: documents
-- Purpose: Full document storage with OCR text and summaries
-- =============================================================================
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    local_document_uuid UUID NOT NULL,
    filename VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    ocr_text TEXT,  -- Can be very large
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Link to Supabase document metadata
    supabase_document_id UUID,
    -- Indexes
    CONSTRAINT idx_documents_filename UNIQUE (filename)
);

CREATE UNIQUE INDEX idx_documents_local_uuid ON documents(local_document_uuid);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_supabase_id ON documents(supabase_document_id) WHERE supabase_document_id IS NOT NULL;

-- =============================================================================
-- Table: users
-- Purpose: Basic user accounts for local processing context
-- Note: Primary user management is in Supabase
-- =============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    -- Link to Supabase user
    supabase_user_id UUID,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_supabase_id ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;

-- =============================================================================
-- Table: claims
-- Purpose: Legal claims extracted using InLegalBERT
-- =============================================================================
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,
    claim_type VARCHAR(50),
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL,
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_claims_document_id ON claims(document_id);

-- =============================================================================
-- Table: citations
-- Purpose: Citation detection and parsing with position tracking
-- =============================================================================
CREATE TABLE citations (
    id SERIAL PRIMARY KEY,
    local_citation_uuid UUID NOT NULL,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    citation_text TEXT NOT NULL,
    citation_type VARCHAR(50) NOT NULL,
    jurisdiction VARCHAR(50),
    year INTEGER,
    court VARCHAR(255),
    volume VARCHAR(50),
    reporter VARCHAR(100),
    page VARCHAR(50),
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL,
    context TEXT,
    confidence_score VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Link to Supabase citation metadata
    supabase_citation_id UUID
);

CREATE UNIQUE INDEX idx_citations_local_uuid ON citations(local_citation_uuid);
CREATE INDEX idx_citations_document_id ON citations(document_id);
CREATE INDEX idx_citations_supabase_id ON citations(supabase_citation_id) WHERE supabase_citation_id IS NOT NULL;

-- =============================================================================
-- Table: claim_citation_mappings
-- Purpose: Relationships between claims and citations
-- =============================================================================
CREATE TABLE claim_citation_mappings (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    citation_id INTEGER NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50),
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mappings_claim_id ON claim_citation_mappings(claim_id);
CREATE INDEX idx_mappings_citation_id ON claim_citation_mappings(citation_id);

-- =============================================================================
-- Table: embeddings
-- Purpose: FAISS embedding metadata
-- Note: Actual vectors stored in FAISS, this stores references and metadata
-- =============================================================================
CREATE TABLE embeddings (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    faiss_index_name VARCHAR(100) NOT NULL DEFAULT 'default',
    faiss_index_position INTEGER,
    text_preview TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_embeddings_entity_type ON embeddings(entity_type);
CREATE INDEX idx_embeddings_entity_id ON embeddings(entity_id);
CREATE INDEX idx_embeddings_document_id ON embeddings(document_id);

-- =============================================================================
-- Table: evidence
-- Purpose: Evidence paragraphs for RAG retrieval
-- =============================================================================
CREATE TABLE evidence (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
    paragraph_text TEXT NOT NULL,
    position_start INTEGER,
    position_end INTEGER,
    relevance_score FLOAT,
    source_citation_id INTEGER REFERENCES citations(id) ON DELETE SET NULL,
    source_document_filename VARCHAR(255),
    source_index_name VARCHAR(100),
    source_chunk_index INTEGER,
    retrieval_rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evidence_document_id ON evidence(document_id);
CREATE INDEX idx_evidence_claim_id ON evidence(claim_id);
CREATE INDEX idx_evidence_source_citation_id ON evidence(source_citation_id);

-- =============================================================================
-- Table: verification_reports
-- Purpose: LLM verification results
-- =============================================================================
CREATE TABLE verification_reports (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- Local reference, may link to Supabase user_id
    report_data JSONB NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'completed',
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    evidence_count INTEGER,
    citations_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_document_id ON verification_reports(document_id);
CREATE INDEX idx_reports_claim_id ON verification_reports(claim_id);
CREATE INDEX idx_reports_user_id ON verification_reports(user_id);

-- =============================================================================
-- Table: conversations
-- Purpose: Chat conversation sessions
-- =============================================================================
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    model_used VARCHAR(100),
    total_messages INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

-- =============================================================================
-- Table: messages
-- Purpose: Individual messages within conversations
-- =============================================================================
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB, -- token counts, model info, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);

-- =============================================================================
-- Comments for documentation
-- =============================================================================
COMMENT ON TABLE documents IS 'Full document storage with OCR text and summaries. Links to Supabase documents_metadata via supabase_document_id.';
COMMENT ON TABLE users IS 'Basic user accounts for local processing context. Primary user management is in Supabase. Links via supabase_user_id.';
COMMENT ON TABLE claims IS 'Legal claims extracted from documents using InLegalBERT.';
COMMENT ON TABLE citations IS 'Citation detection and parsing with position tracking. Links to Supabase citations_metadata via supabase_citation_id.';
COMMENT ON TABLE claim_citation_mappings IS 'Maps relationships between claims and citations.';
COMMENT ON TABLE embeddings IS 'FAISS embedding metadata. Actual vectors stored in FAISS indexes.';
COMMENT ON TABLE evidence IS 'Evidence paragraphs retrieved from documents to support/verify claims.';
COMMENT ON TABLE verification_reports IS 'LLM verification results for claims and documents.';
COMMENT ON TABLE conversations IS 'Chat conversation sessions for legal document assistance.';
COMMENT ON TABLE messages IS 'Individual messages within chat conversations.';

COMMENT ON COLUMN documents.supabase_document_id IS 'UUID reference to documents_metadata table in Supabase';
COMMENT ON COLUMN users.supabase_user_id IS 'UUID reference to users table in Supabase';
COMMENT ON COLUMN citations.supabase_citation_id IS 'UUID reference to citations_metadata table in Supabase';
