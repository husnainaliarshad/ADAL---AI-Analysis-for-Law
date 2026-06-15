# ADAL Backend Schema Documentation

## Overview

ADAL uses a dual-database architecture:
- **Supabase (Neon PostgreSQL)**: Primary user management, document metadata, and collaborative features
- **Local PostgreSQL**: AI/ML processing, heavy data storage, embeddings, and legal analysis

---

## Database Architecture

### Supabase Database (Primary)
- **Purpose**: User authentication, document metadata, collaborations, audit trails
- **ID Type**: UUID (gen_random_uuid())
- **Location**: Cloud-hosted via Supabase

### Local Database (Processing)
- **Purpose**: AI/ML processing, embeddings, legal analysis, citations, claims
- **ID Type**: Integer (SERIAL) for compatibility
- **Location**: Local PostgreSQL instance
- **Linking**: UUID references to Supabase records

---

## Supabase Schema Tables

### users
Primary user management table
```sql
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  username character varying,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  role character varying NOT NULL DEFAULT 'user',
  organization_id uuid,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  profile_image_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  password_reset_token character varying,
  password_reset_expires timestamp with time zone,
  verification_token character varying
);
```

### organizations
Law firms and legal organizations
```sql
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  type character varying NOT NULL,
  address text,
  phone character varying,
  email character varying,
  website character varying,
  license_number character varying,
  is_active boolean DEFAULT true,
  subscription_plan character varying DEFAULT 'basic',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### documents_metadata
Document metadata and file information
```sql
CREATE TABLE public.documents_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  organization_id uuid,
  title character varying NOT NULL,
  description text,
  document_type character varying NOT NULL,
  language character varying DEFAULT 'english',
  file_name character varying NOT NULL,
  file_size bigint NOT NULL,
  mime_type character varying NOT NULL,
  file_hash character varying NOT NULL,
  storage_provider character varying DEFAULT 'local',
  is_processed boolean DEFAULT false,
  processing_status character varying DEFAULT 'pending',
  is_public boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  folder_id uuid,
  tags ARRAY,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  version_number integer DEFAULT 1
);
```

### document_folders
Hierarchical folder organization
```sql
CREATE TABLE public.document_folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  name character varying NOT NULL,
  description text,
  parent_folder_id uuid,
  path text,
  is_shared boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### document_versions
Version control for documents
```sql
CREATE TABLE public.document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  version_number integer NOT NULL,
  file_path text NOT NULL,
  file_hash character varying NOT NULL,
  changes_summary text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
```

### document_comments
Collaborative comments and annotations
```sql
CREATE TABLE public.document_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  position_start integer,
  position_end integer,
  page_number integer,
  thread_id uuid,
  is_resolved boolean DEFAULT false,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### document_edits
Edit tracking and history
```sql
CREATE TABLE public.document_edits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  edit_type character varying NOT NULL,
  position_start integer,
  position_end integer,
  old_content_hash character varying,
  new_content_hash character varying,
  timestamp timestamp with time zone DEFAULT now(),
  session_id character varying
);
```

### collaborations
Document sharing and permissions
```sql
CREATE TABLE public.collaborations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  collaborator_id uuid NOT NULL,
  permission_level character varying NOT NULL,
  invited_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone,
  status character varying DEFAULT 'pending',
  invitation_token character varying,
  expires_at timestamp with time zone
);
```

### citations_metadata
Legal citation information
```sql
CREATE TABLE public.citations_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_citation_id uuid NOT NULL,
  document_id uuid NOT NULL,
  citation_text_preview character varying,
  citation_type character varying NOT NULL,
  case_name character varying,
  court character varying,
  year integer,
  volume character varying,
  reporter character varying,
  page character varying,
  jurisdiction character varying,
  is_validated boolean DEFAULT false,
  validation_status character varying DEFAULT 'pending',
  confidence_score numeric,
  created_at timestamp with time zone DEFAULT now(),
  validated_at timestamp with time zone
);
```

### precedents_metadata
Legal precedents and case law
```sql
CREATE TABLE public.precedents_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  local_precedent_id uuid,
  case_name character varying NOT NULL,
  case_number character varying,
  court character varying NOT NULL,
  judge_names ARRAY,
  decision_date date,
  jurisdiction character varying,
  case_type character varying,
  legal_areas ARRAY,
  keywords ARRAY,
  summary text,
  citation character varying,
  parties_plaintiff ARRAY,
  parties_defendant ARRAY,
  outcome character varying,
  language character varying DEFAULT 'english',
  source_database character varying,
  external_id character varying,
  is_landmark boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### judges
Judge information and profiles
```sql
CREATE TABLE public.judges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  title character varying,
  court character varying,
  jurisdiction character varying,
  appointment_date date,
  retirement_date date,
  specializations ARRAY,
  bio text,
  photo_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### case_analytics
Case analytics and statistics
```sql
CREATE TABLE public.case_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  precedent_id uuid NOT NULL,
  judge_id uuid,
  case_duration_days integer,
  case_complexity_score numeric,
  decision_type character varying,
  appeal_outcome character varying,
  legal_principles ARRAY,
  cited_precedents ARRAY,
  statistical_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);
```

### user_sessions
Authentication session management
```sql
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash character varying NOT NULL UNIQUE,
  device_info jsonb,
  ip_address inet,
  user_agent text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now()
);
```

### audit_logs
System audit trail
```sql
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action character varying NOT NULL,
  resource_type character varying NOT NULL,
  resource_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  session_id character varying,
  timestamp timestamp with time zone DEFAULT now()
);
```

### search_queries
Search analytics and history
```sql
CREATE TABLE public.search_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_text text NOT NULL,
  search_type character varying NOT NULL,
  filters jsonb,
  results_count integer,
  search_time_ms integer,
  clicked_results ARRAY,
  created_at timestamp with time zone DEFAULT now()
);
```

### system_settings
System configuration
```sql
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key character varying NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  is_encrypted boolean DEFAULT false,
  last_modified_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

---

## Local Database Tables (AI/ML Processing)

### documents
Full document storage with OCR text
```sql
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    local_document_uuid UUID NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    ocr_text TEXT,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    supabase_document_id UUID
);
```

### users
Local user context for processing
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    supabase_user_id UUID,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);
```

### claims
Legal claims extracted using InLegalBERT
```sql
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
```

### citations
Citation detection and parsing
```sql
CREATE TABLE citations (
    id SERIAL PRIMARY KEY,
    local_citation_uuid UUID NOT NULL UNIQUE,
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
    supabase_citation_id UUID
);
```

### claim_citation_mappings
Relationships between claims and citations
```sql
CREATE TABLE claim_citation_mappings (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    citation_id INTEGER NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50),
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### embeddings
FAISS embedding metadata
```sql
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
```

### evidence
Evidence paragraphs for RAG retrieval
```sql
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
```

### verification_reports
LLM verification results
```sql
CREATE TABLE verification_reports (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    report_data JSONB NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'completed',
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    evidence_count INTEGER,
    citations_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## SQLAlchemy Models

### User Model
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    supabase_user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
```

### Document Model
```python
class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    local_document_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True, index=True)
    filename = Column(String, index=True)
    path = Column(String)
    ocr_text = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    supabase_document_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    @property
    def file_type(self):
        # Derived file type based on filename extension
        if not self.filename:
            return None
        parts = self.filename.rsplit(".", 1)
        if len(parts) == 2 and parts[1]:
            return parts[1].lower()
        return None
    
    @property
    def file_size(self):
        # Derived file size from filesystem
        try:
            from pathlib import Path
            base_dir = Path(__file__).parent.parent.parent / "data" / "uploads"
            file_path = base_dir / self.filename
            return file_path.stat().st_size if file_path.exists() else None
        except Exception:
            return None
```

### Claim Model
```python
class Claim(Base):
    __tablename__ = "claims"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    claim_text = Column(Text, nullable=False)
    claim_type = Column(String, nullable=True)
    position_start = Column(Integer, nullable=False)
    position_end = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ClaimCitationMapping(Base):
    __tablename__ = "claim_citation_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False, index=True)
    citation_id = Column(Integer, ForeignKey("citations.id"), nullable=False, index=True)
    relationship_type = Column(String, nullable=True)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Citation Model
```python
class Citation(Base):
    __tablename__ = "citations"
    
    id = Column(Integer, primary_key=True, index=True)
    local_citation_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    citation_text = Column(Text, nullable=False)
    citation_type = Column(String, nullable=False)
    jurisdiction = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    court = Column(String, nullable=True)
    volume = Column(String, nullable=True)
    reporter = Column(String, nullable=True)
    page = Column(String, nullable=True)
    position_start = Column(Integer, nullable=False)
    position_end = Column(Integer, nullable=False)
    context = Column(Text, nullable=True)
    confidence_score = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    supabase_citation_id = Column(UUID(as_uuid=True), nullable=True, index=True)
```

### Evidence Model
```python
class Evidence(Base):
    __tablename__ = "evidence"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True, index=True)
    paragraph_text = Column(Text, nullable=False)
    position_start = Column(Integer, nullable=True)
    position_end = Column(Integer, nullable=True)
    relevance_score = Column(Float, nullable=True)
    source_citation_id = Column(Integer, ForeignKey("citations.id"), nullable=True, index=True)
    source_document_filename = Column(String, nullable=True)
    source_index_name = Column(String, nullable=True)
    source_chunk_index = Column(Integer, nullable=True)
    retrieval_rank = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Verification Report Model
```python
class VerificationReport(Base):
    __tablename__ = "verification_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    report_data = Column(JSONB, nullable=False)
    verification_status = Column(String, nullable=False, default="completed")
    llm_provider = Column(String, nullable=True)
    llm_model = Column(String, nullable=True)
    evidence_count = Column(Integer, nullable=True)
    citations_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Embedding Model
```python
class Embedding(Base):
    __tablename__ = "embeddings"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    faiss_index_name = Column(String, nullable=False, default="default")
    faiss_index_position = Column(Integer, nullable=True)
    text_preview = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## Pydantic Schemas

### Authentication Schemas
```python
class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None

class UpdateProfileRequest(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
```

### Citation Schemas
```python
class CitationBase(BaseModel):
    citation_text: str
    citation_type: str
    jurisdiction: Optional[str] = None
    year: Optional[int] = None
    court: Optional[str] = None
    volume: Optional[str] = None
    reporter: Optional[str] = None
    page: Optional[str] = None
    position_start: int
    position_end: int
    context: Optional[str] = None
    confidence_score: Optional[str] = None

class CitationCreate(CitationBase):
    document_id: int

class CitationResponse(CitationBase):
    id: int
    document_id: int
    created_at: datetime

class DocumentCitationsResponse(BaseModel):
    document_id: int
    total_citations: int
    citations: list[CitationResponse]
```

### Claim Schemas
```python
class ClaimBase(BaseModel):
    claim_text: str
    claim_type: Optional[str] = None
    position_start: int
    position_end: int
    confidence_score: Optional[float] = None

class ClaimCreate(ClaimBase):
    document_id: int

class ClaimResponse(ClaimBase):
    id: int
    document_id: int
    created_at: datetime

class DocumentClaimsResponse(BaseModel):
    document_id: int
    total_claims: int
    claims: list[ClaimResponse]
```

### Evidence Schemas
```python
class EvidenceBase(BaseModel):
    paragraph_text: str
    position_start: Optional[int] = None
    position_end: Optional[int] = None
    relevance_score: Optional[float] = None
    source_document_filename: Optional[str] = None
    source_index_name: Optional[str] = None
    source_chunk_index: Optional[int] = None
    retrieval_rank: Optional[int] = None

class EvidenceCreate(EvidenceBase):
    document_id: int
    claim_id: Optional[int] = None
    source_citation_id: Optional[int] = None

class EvidenceResponse(EvidenceBase):
    id: int
    document_id: int
    claim_id: Optional[int] = None
    source_citation_id: Optional[int] = None
    created_at: datetime

class DocumentEvidenceResponse(BaseModel):
    document_id: int
    total_evidence: int
    evidence: list[EvidenceResponse]

class ClaimEvidenceResponse(BaseModel):
    claim_id: int
    total_evidence: int
    evidence: list[EvidenceResponse]
```

### Verification Schemas
```python
class VerificationResult(BaseModel):
    claim_id: int
    claim_text: Optional[str] = None
    verdict: str  # supported, contradicted, insufficient_evidence, uncertain
    confidence: float  # 0.0-1.0
    reasoning: str
    supporting_evidence: List[str] = []
    contradicting_evidence: List[str] = []
    citations_used: List[str] = []
    evidence_count: int = 0
    citations_count: int = 0
    evidence_details: Optional[List[Dict]] = None

class ClaimVerificationResponse(BaseModel):
    claim_id: int
    verdict: str
    confidence: float
    reasoning: str
    supporting_evidence: List[str]
    contradicting_evidence: List[str]
    citations_used: List[str]
    evidence_count: int
    citations_count: int

class DocumentVerificationResponse(BaseModel):
    document_id: int
    total_claims: int
    verified_claims: int
    verdict_summary: Dict[str, int]
    results: List[VerificationResult]

class VerificationReportResponse(BaseModel):
    id: int
    document_id: int
    claim_id: Optional[int] = None
    report_data: Dict
    verification_status: str
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    evidence_count: Optional[int] = None
    citations_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime
```

---

## Database Relationships

### Supabase Relationships
- `users` → `organizations` (many-to-one)
- `users` → `documents_metadata` (one-to-many)
- `documents_metadata` → `document_folders` (many-to-one)
- `documents_metadata` → `document_versions` (one-to-many)
- `documents_metadata` → `document_comments` (one-to-many)
- `documents_metadata` → `document_edits` (one-to-many)
- `documents_metadata` → `citations_metadata` (one-to-many)
- `users` → `collaborations` (owner and collaborator)
- `precedents_metadata` → `case_analytics` (one-to-many)
- `judges` → `case_analytics` (one-to-many)

### Local Database Relationships
- `documents` → `claims` (one-to-many)
- `documents` → `citations` (one-to-many)
- `documents` → `evidence` (one-to-many)
- `documents` → `verification_reports` (one-to-many)
- `claims` → `claim_citation_mappings` (one-to-many)
- `citations` → `claim_citation_mappings` (one-to-many)
- `claims` → `evidence` (one-to-many, optional)
- `citations` → `evidence` (one-to-many, optional)

### Cross-Database Linking
- `documents.supabase_document_id` → `documents_metadata.id`
- `users.supabase_user_id` → `users.id`
- `citations.supabase_citation_id` → `citations_metadata.id`

---

## Indexes and Performance

### Supabase Indexes
- Primary keys on all id columns
- Unique constraints on email, username
- Foreign key indexes on all relationships
- Composite indexes for common query patterns

### Local Database Indexes
- Primary keys on all id columns
- Unique constraints on UUID fields
- Foreign key indexes with CASCADE/SET NULL
- Specialized indexes:
  - `idx_documents_created_at_desc` (created_at DESC)
  - `idx_documents_local_uuid` (local_document_uuid)
  - `idx_citations_local_uuid` (local_citation_uuid)
  - Entity-based indexes for embeddings

---

## Data Types and Constraints

### Common Data Types
- **UUID**: Primary keys and cross-database references
- **TEXT**: Large text content (OCR, summaries, descriptions)
- **JSONB**: Flexible metadata and report data
- **TIMESTAMP WITH TIME ZONE**: All datetime fields
- **ARRAY**: Tags, legal areas, keywords
- **BOOLEAN**: Status flags and toggles
- **INTEGER**: Local primary keys and positions
- **VARCHAR**: Short strings and identifiers

### Constraints
- **NOT NULL**: Required fields
- **UNIQUE**: Email, username, UUID references
- **DEFAULT**: Current timestamps, default values
- **CHECK**: Enum-like values for status fields
- **FOREIGN KEY**: Referential integrity
- **CASCADE**: Automatic cleanup on deletes

---

## Migration Strategy

### Schema Versioning
- Supabase: Managed through Supabase migrations
- Local: SQL files in `database/` directory
- Cross-database: UUID linking ensures consistency

### Data Flow
1. Documents uploaded to Supabase (metadata)
2. Processing triggers local database entry
3. AI/ML analysis stored in local database
4. Results synced back to Supabase via UUID references

---

## Security Considerations

### Sensitive Data
- Password hashes stored in both databases
- API tokens and sessions in Supabase
- Encrypted settings in system_settings

### Access Control
- Row-level security via Supabase RLS
- Organization-based data isolation
- User permissions through collaborations table

### Audit Trail
- All actions logged in audit_logs
- User sessions tracked for security
- Document edits and comments versioned

---

## Performance Optimization

### Caching Strategy
- Frequently accessed documents cached locally
- Embedding metadata for quick retrieval
- User sessions for fast authentication

### Query Optimization
- Indexed searches on document metadata
- Full-text search on OCR content
- Vector similarity search via FAISS

### Storage Optimization
- File storage separate from database
- Compressed text content where possible
- Efficient JSONB usage for metadata

---

## Backup and Recovery

### Supabase
- Point-in-time recovery available
- Daily automated backups
- Cross-region replication

### Local Database
- Regular pg_dump backups
- FAISS index backups
- Document file system backups

### Disaster Recovery
- UUID linking enables database reconstruction
- Separate backup strategies for each database
- Document files backed up independently

---

## API Integration

### REST Endpoints
- User management via Supabase Auth
- Document CRUD operations
- AI/ML processing endpoints
- Search and retrieval APIs

### WebSocket Support
- Real-time collaboration updates
- Processing status notifications
- Live search results

### Authentication Flow
- Supabase JWT tokens
- Session management
- Permission-based access control

---

*This schema documentation covers the complete ADAL backend database architecture, including both Supabase and local PostgreSQL databases, their relationships, and the models that interface with them.*