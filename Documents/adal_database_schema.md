# ADAL Database Schema Design
## AI-Driven Analysis for Law

### Version: 1.0
### Date: September 2025
### Authors: Abdullah Azeem, Hussnain Ali Arshad, Hassan Ali

---

## Table of Contents
1. [Overview](#overview)
2. [Database Technology Stack](#database-technology-stack)
3. [Schema Architecture](#schema-architecture)
4. [Core Tables](#core-tables)
5. [Relationships & Constraints](#relationships--constraints)
6. [Indexing Strategy](#indexing-strategy)
7. [Migration Strategy](#migration-strategy)
8. [Security Considerations](#security-considerations)
9. [Performance Optimization](#performance-optimization)

---

## Overview

The ADAL database schema is designed to support a comprehensive legal intelligence platform with the following key functionalities:
- User authentication and role-based access control
- Document storage and processing
- OCR results and text extraction
- Legal citation detection and validation
- Precedent search and relevance ranking
- Real-time collaboration
- Judge analytics and case insights

### Design Principles
- **Scalability**: Schema designed to handle growing legal document repositories
- **Performance**: Optimized for fast search and retrieval operations
- **Security**: Encrypted sensitive data with proper access controls
- **Flexibility**: Extensible design for future feature additions
- **Compliance**: Adheres to legal data retention and privacy requirements

---

## Database Technology Stack

### Primary Database: PostgreSQL 14+
- **Rationale**: ACID compliance, JSON support, full-text search, robust indexing
- **Extensions**: pg_trgm (trigram matching), pg_stat_statements (performance monitoring)

### Search Engine: ElasticSearch 8.0+
- **Purpose**: Full-text search, semantic search, legal precedent ranking
- **Integration**: Synchronized with PostgreSQL via background jobs

### Caching Layer: Redis 7.0+
- **Purpose**: Session storage, query result caching, real-time collaboration
- **Data Types**: Strings, Hashes, Sets, Sorted Sets, Streams

---

## Schema Architecture

### Database Structure
```
ADAL_DB
├── Core Authentication & Users
├── Document Management
├── OCR & Text Processing
├── Legal Intelligence
├── Collaboration & Workflow
├── Analytics & Reporting
└── System Configuration
```

---

## Core Tables

### 1. Authentication & User Management

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'user',
    organization_id UUID REFERENCES organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(255)
);

CREATE TYPE user_role_enum AS ENUM ('admin', 'lawyer', 'researcher', 'student', 'user');
```

#### organizations
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type org_type_enum NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    license_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    subscription_plan plan_enum DEFAULT 'basic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE org_type_enum AS ENUM ('law_firm', 'court', 'university', 'government', 'individual');
CREATE TYPE plan_enum AS ENUM ('basic', 'professional', 'enterprise');
```

#### user_sessions
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Document Management

#### documents
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    document_type doc_type_enum NOT NULL,
    language language_enum NOT NULL DEFAULT 'english',
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity
    storage_provider storage_enum DEFAULT 'aws_s3',
    is_processed BOOLEAN DEFAULT FALSE,
    processing_status status_enum DEFAULT 'pending',
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    folder_id UUID REFERENCES document_folders(id),
    tags TEXT[],
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version_number INTEGER DEFAULT 1
);

CREATE TYPE doc_type_enum AS ENUM (
    'contract', 'judgment', 'petition', 'appeal', 'ordinance', 
    'constitution', 'regulation', 'case_law', 'legal_opinion', 
    'brief', 'memo', 'agreement', 'other'
);

CREATE TYPE language_enum AS ENUM ('english', 'urdu', 'mixed');
CREATE TYPE storage_enum AS ENUM ('aws_s3', 'azure_blob', 'local');
CREATE TYPE status_enum AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
```

#### document_folders
```sql
CREATE TABLE document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_folder_id UUID REFERENCES document_folders(id),
    path TEXT, -- Materialized path for efficient querying
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### document_versions
```sql
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    changes_summary TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);
```

### 3. OCR & Text Processing

#### ocr_results
```sql
CREATE TABLE ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    extracted_text TEXT NOT NULL,
    confidence_score DECIMAL(5,4), -- Overall confidence (0.0000 to 1.0000)
    language_detected language_enum,
    processing_time_ms INTEGER,
    bounding_boxes JSONB, -- Store word/line level bounding boxes
    preprocessing_applied TEXT[], -- List of preprocessing steps
    ocr_engine VARCHAR(50) DEFAULT 'tesseract',
    engine_version VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### text_corrections
```sql
CREATE TABLE text_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_result_id UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    correction_type correction_type_enum NOT NULL,
    confidence_score DECIMAL(5,4),
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL,
    corrected_by UUID REFERENCES users(id),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE correction_type_enum AS ENUM ('manual', 'auto_spell', 'auto_grammar', 'ai_suggestion');
```

### 4. Document Structure & Parsing

#### document_structures
```sql
CREATE TABLE document_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    structure_type structure_type_enum NOT NULL,
    section_number VARCHAR(50),
    title VARCHAR(500),
    content TEXT NOT NULL,
    parent_section_id UUID REFERENCES document_structures(id),
    level INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL,
    start_page INTEGER,
    end_page INTEGER,
    confidence_score DECIMAL(5,4),
    parsing_method VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE structure_type_enum AS ENUM (
    'title', 'chapter', 'section', 'subsection', 'article', 
    'clause', 'paragraph', 'list_item', 'footnote', 'header', 'footer'
);
```

### 5. Legal Citations

#### citations
```sql
CREATE TABLE citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    citation_text TEXT NOT NULL,
    citation_type citation_type_enum NOT NULL,
    case_name VARCHAR(500),
    court VARCHAR(255),
    year INTEGER,
    volume VARCHAR(50),
    reporter VARCHAR(100),
    page VARCHAR(50),
    jurisdiction VARCHAR(100),
    citation_format citation_format_enum,
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL,
    context_before TEXT,
    context_after TEXT,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_status validation_status_enum DEFAULT 'pending',
    validation_source VARCHAR(255),
    confidence_score DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE
);

CREATE TYPE citation_type_enum AS ENUM (
    'case_law', 'statute', 'regulation', 'constitutional', 
    'international', 'journal', 'book', 'other'
);

CREATE TYPE citation_format_enum AS ENUM ('pakistani', 'indian', 'uk', 'us', 'international');
CREATE TYPE validation_status_enum AS ENUM ('pending', 'valid', 'invalid', 'uncertain', 'manual_review');
```

#### legal_databases
```sql
CREATE TABLE legal_databases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    jurisdiction VARCHAR(100),
    data_source VARCHAR(255),
    api_endpoint TEXT,
    last_updated TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    access_credentials JSONB, -- Encrypted API keys/credentials
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 6. Legal Precedents & Search

#### precedents
```sql
CREATE TABLE precedents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_name VARCHAR(500) NOT NULL,
    case_number VARCHAR(100),
    court VARCHAR(255) NOT NULL,
    judge_names TEXT[],
    decision_date DATE,
    jurisdiction VARCHAR(100),
    case_type VARCHAR(100),
    legal_areas TEXT[], -- Areas of law (contract, criminal, etc.)
    keywords TEXT[],
    summary TEXT,
    full_text TEXT,
    citation VARCHAR(500),
    parties_plaintiff TEXT[],
    parties_defendant TEXT[],
    outcome VARCHAR(100),
    precedent_value precedent_value_enum,
    language language_enum DEFAULT 'english',
    source_database VARCHAR(100),
    external_id VARCHAR(255),
    embedding_vector VECTOR(384), -- For semantic search
    is_landmark BOOLEAN DEFAULT FALSE,
    relevance_score DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE precedent_value_enum AS ENUM ('binding', 'persuasive', 'informative');
```

#### search_queries
```sql
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    query_text TEXT NOT NULL,
    search_type search_type_enum NOT NULL,
    filters JSONB,
    results_count INTEGER,
    search_time_ms INTEGER,
    clicked_results UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE search_type_enum AS ENUM ('keyword', 'semantic', 'citation', 'similar_cases');
```

### 7. Collaboration & Real-time Features

#### collaborations
```sql
CREATE TABLE collaborations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id),
    collaborator_id UUID NOT NULL REFERENCES users(id),
    permission_level permission_enum NOT NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    status collab_status_enum DEFAULT 'pending',
    invitation_token VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(document_id, collaborator_id)
);

CREATE TYPE permission_enum AS ENUM ('read', 'comment', 'edit', 'admin');
CREATE TYPE collab_status_enum AS ENUM ('pending', 'accepted', 'declined', 'revoked');
```

#### document_comments
```sql
CREATE TABLE document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    position_start INTEGER,
    position_end INTEGER,
    page_number INTEGER,
    thread_id UUID REFERENCES document_comments(id),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### document_edits
```sql
CREATE TABLE document_edits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    edit_type edit_type_enum NOT NULL,
    position_start INTEGER,
    position_end INTEGER,
    old_content TEXT,
    new_content TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id VARCHAR(255)
);

CREATE TYPE edit_type_enum AS ENUM ('insert', 'delete', 'replace', 'format');
```

### 8. Analytics & Reporting

#### judges
```sql
CREATE TABLE judges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(100),
    court VARCHAR(255),
    jurisdiction VARCHAR(100),
    appointment_date DATE,
    retirement_date DATE,
    specializations TEXT[],
    bio TEXT,
    photo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### case_analytics
```sql
CREATE TABLE case_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    precedent_id UUID NOT NULL REFERENCES precedents(id),
    judge_id UUID REFERENCES judges(id),
    case_duration_days INTEGER,
    case_complexity_score DECIMAL(5,2),
    decision_type decision_type_enum,
    appeal_outcome appeal_outcome_enum,
    legal_principles TEXT[],
    cited_precedents UUID[],
    statistical_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE decision_type_enum AS ENUM ('unanimous', 'majority', 'split', 'dissent');
CREATE TYPE appeal_outcome_enum AS ENUM ('upheld', 'overturned', 'remanded', 'modified');
```

### 9. System Configuration

#### system_settings
```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    last_modified_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Relationships & Constraints

### Primary Relationships

1. **Users ↔ Organizations**: Many-to-One (users belong to organizations)
2. **Users ↔ Documents**: One-to-Many (users can own multiple documents)
3. **Documents ↔ OCR Results**: One-to-Many (documents can have multiple pages)
4. **Documents ↔ Citations**: One-to-Many (documents contain multiple citations)
5. **Documents ↔ Collaborations**: One-to-Many (documents can have multiple collaborators)
6. **Precedents ↔ Judges**: Many-to-Many (cases can have multiple judges)

### Constraint Definitions

```sql
-- Ensure valid email formats
ALTER TABLE users ADD CONSTRAINT valid_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure positive file sizes
ALTER TABLE documents ADD CONSTRAINT positive_file_size 
    CHECK (file_size > 0);

-- Ensure valid confidence scores
ALTER TABLE ocr_results ADD CONSTRAINT valid_confidence 
    CHECK (confidence_score >= 0 AND confidence_score <= 1);

-- Ensure valid year ranges for cases
ALTER TABLE precedents ADD CONSTRAINT valid_year 
    CHECK (EXTRACT(YEAR FROM decision_date) >= 1850 AND 
           EXTRACT(YEAR FROM decision_date) <= EXTRACT(YEAR FROM NOW()));

-- Ensure document structure hierarchy
ALTER TABLE document_structures ADD CONSTRAINT valid_hierarchy 
    CHECK (level > 0 AND level <= 10);
```

---

## Indexing Strategy

### Primary Indexes

```sql
-- User authentication & lookup
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, expires_at);

-- Document management
CREATE INDEX idx_documents_user ON documents(user_id, created_at DESC);
CREATE INDEX idx_documents_type ON documents(document_type, is_archived);
CREATE INDEX idx_documents_processing ON documents(processing_status, processing_started_at);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);

-- Full-text search
CREATE INDEX idx_documents_title_search ON documents USING GIN(to_tsvector('english', title));
CREATE INDEX idx_ocr_text_search ON ocr_results USING GIN(to_tsvector('english', extracted_text));

-- OCR and text processing
CREATE INDEX idx_ocr_document_page ON ocr_results(document_id, page_number);
CREATE INDEX idx_ocr_confidence ON ocr_results(confidence_score DESC);

-- Citations and legal references
CREATE INDEX idx_citations_document ON citations(document_id, citation_type);
CREATE INDEX idx_citations_validation ON citations(validation_status, is_validated);
CREATE INDEX idx_citations_case_name ON citations USING GIN(to_tsvector('english', case_name));

-- Precedent search
CREATE INDEX idx_precedents_court_date ON precedents(court, decision_date DESC);
CREATE INDEX idx_precedents_keywords ON precedents USING GIN(keywords);
CREATE INDEX idx_precedents_legal_areas ON precedents USING GIN(legal_areas);
CREATE INDEX idx_precedents_fulltext ON precedents USING GIN(to_tsvector('english', full_text));

-- Collaboration
CREATE INDEX idx_collaborations_user ON collaborations(collaborator_id, status);
CREATE INDEX idx_collaborations_document ON collaborations(document_id, permission_level);
CREATE INDEX idx_comments_document ON document_comments(document_id, created_at DESC);

-- Analytics and performance
CREATE INDEX idx_search_queries_user ON search_queries(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, timestamp DESC);
```

### Composite Indexes for Complex Queries

```sql
-- Document search with filters
CREATE INDEX idx_documents_complex_search ON documents(
    user_id, document_type, language, is_archived, created_at DESC
);

-- Citation validation workflow
CREATE INDEX idx_citations_validation_workflow ON citations(
    document_id, validation_status, citation_type, created_at
);

-- Precedent relevance ranking
CREATE INDEX idx_precedents_relevance ON precedents(
    jurisdiction, case_type, precedent_value, decision_date DESC
);
```

---

## Migration Strategy

### Phase 1: Core Schema (Weeks 1-2)
1. User authentication and basic document management
2. Essential tables: users, organizations, user_sessions, documents
3. Basic indexing for authentication and document operations

### Phase 2: Document Processing (Weeks 3-4)
1. OCR and text processing tables
2. Document structure and parsing
3. Full-text search indexes

### Phase 3: Legal Intelligence (Weeks 5-8)
1. Citations and legal databases
2. Precedent management
3. Search and analytics tables

### Phase 4: Collaboration (Weeks 9-10)
1. Real-time collaboration features
2. Comments and edit tracking
3. Advanced analytics

### Phase 5: Optimization (Weeks 11-14)
1. Performance tuning
2. Additional indexes based on usage patterns
3. Data archival strategies

### Migration Scripts Structure
```sql
-- migrations/001_initial_schema.sql
-- migrations/002_add_ocr_tables.sql
-- migrations/003_add_citations.sql
-- migrations/004_add_collaboration.sql
-- migrations/005_add_analytics.sql
```

---

## Security Considerations

### Data Encryption
- **At Rest**: Sensitive fields encrypted using PostgreSQL's pgcrypto extension
- **In Transit**: All connections use TLS 1.3
- **Application Level**: Additional encryption for PII and legal content

### Access Control
```sql
-- Row-level security for multi-tenancy
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_access_policy ON documents
    FOR ALL TO authenticated_users
    USING (user_id = current_user_id() OR 
           id IN (SELECT document_id FROM collaborations 
                  WHERE collaborator_id = current_user_id() 
                  AND status = 'accepted'));

-- Similar policies for other sensitive tables
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborations ENABLE ROW LEVEL SECURITY;
```

### Audit Trail
- All modifications logged in audit_logs table
- Automatic triggers for sensitive operations
- Retention policy for compliance requirements

### Data Anonymization
```sql
-- Function to anonymize user data for development/testing
CREATE OR REPLACE FUNCTION anonymize_user_data()
RETURNS void AS $$
BEGIN
    UPDATE users SET
        email = 'user_' || id || '@example.com',
        first_name = 'Test',
        last_name = 'User' || substring(id::text, 1, 8)
    WHERE role != 'admin';
END;
$$ LANGUAGE plpgsql;
```

---

## Performance Optimization

### Query Optimization Strategies

1. **Partition Large Tables**
```sql
-- Partition audit logs by month
CREATE TABLE audit_logs_y2025m01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

2. **Materialized Views for Analytics**
```sql
CREATE MATERIALIZED VIEW user_document_stats AS
SELECT 
    u.id as user_id,
    u.first_name || ' ' || u.last_name as full_name,
    COUNT(d.id) as document_count,
    AVG(o.confidence_score) as avg_ocr_confidence,
    COUNT(c.id) as citation_count
FROM users u
LEFT JOIN documents d ON u.id = d.user_id
LEFT JOIN ocr_results o ON d.id = o.document_id
LEFT JOIN citations c ON d.id = c.document_id
GROUP BY u.id, u.first_name, u.last_name;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_document_stats;
END;
$$ LANGUAGE plpgsql;
```

3. **Database Connection Pooling**
- Use PgBouncer for connection pooling
- Configure appropriate pool sizes for different environments

### Monitoring Queries
```sql
-- Query performance monitoring
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Index usage analysis
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

---

This database schema provides a robust foundation for the ADAL legal intelligence platform, supporting all planned features while maintaining performance, security, and scalability requirements.