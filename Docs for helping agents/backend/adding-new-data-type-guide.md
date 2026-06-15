# Guide to Adding New Data Types in ADAL Backend

## Overview

The ADAL backend uses a multi-database architecture with three distinct PostgreSQL databases:
- **Local PostgreSQL** - AI/ML processing, heavy data storage, embeddings
- **Supabase** - Enterprise features, collaboration, multi-tenant
- **Neon** - Legacy/backup (read-only, minimal sync)

This guide explains how to add new data types following the established patterns.

## Database Architecture

### Local PostgreSQL Tables
**Purpose**: AI/ML processing, embeddings, claims, citations, evidence, verification reports

**Tables**:
- `documents` - Full document storage with OCR text and summaries
- `users` - Basic user accounts for local processing context
- `claims` - Legal claims extracted using InLegalBERT
- `citations` - Citation detection and parsing with position tracking
- `claim_citation_mappings` - Relationships between claims and citations
- `embeddings` - FAISS embedding metadata (vectors stored in FAISS)
- `evidence` - Evidence paragraphs for RAG retrieval
- `verification_reports` - LLM verification results

**ID Type**: Integer (SERIAL) for compatibility with existing Neon schema

### Supabase Tables
**Purpose**: Enterprise features, collaboration, multi-tenant

**Tables**:
- `users` - Primary user management
- `documents_metadata` - Document metadata and file information
- `citations_metadata` - Citation metadata
- `organizations` - Multi-tenant organizations
- `collaborations` - Document sharing and permissions
- `audit_logs` - Audit trail
- `document_folders` - Folder organization
- `document_versions` - Document versioning
- `document_comments` - Document annotations
- `document_edits` - Edit tracking
- `precedents_metadata` - Legal precedents
- `judges` - Judge information
- `case_analytics` - Case analytics
- `search_queries` - Search history
- `user_sessions` - Session management
- `system_settings` - Configuration

**ID Type**: UUID (gen_random_uuid())

### Cross-Database Linking
Local tables include UUID columns to link to Supabase:
- `documents.supabase_document_id` → `documents_metadata.id`
- `users.supabase_user_id` → `users.id`
- `citations.supabase_citation_id` → `citations_metadata.id`

## Schema Creation Process

### 1. SQL Schema Definition
**File**: `app/database/local_schema.sql`

**Pattern**:
```sql
-- =============================================================================
-- Table: table_name
-- Purpose: Brief description
-- =============================================================================
CREATE TABLE table_name (
    id SERIAL PRIMARY KEY,
    local_table_uuid UUID NOT NULL,
    -- Other columns...
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Link to Supabase if applicable
    supabase_table_id UUID
);

-- Indexes
CREATE UNIQUE INDEX idx_table_local_uuid ON table_name(local_table_uuid);
CREATE INDEX idx_table_created_at ON table_name(created_at DESC);
CREATE INDEX idx_table_supabase_id ON table_name(supabase_table_id) WHERE supabase_table_id IS NOT NULL;

-- Comments
COMMENT ON TABLE table_name IS 'Description';
```

### 2. SQLAlchemy Model
**File**: `app/models/[model_name]_model.py`

**Pattern**:
```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, UUID
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database.database_main import Base
import uuid

class TableName(Base):
    __tablename__ = "table_name"

    id = Column(Integer, primary_key=True, index=True)
    local_table_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True, index=True)
    # Other columns...
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    supabase_table_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Composite index for common query patterns
    __table_args__ = (
        Index('idx_created_at_desc', 'created_at'),
    )
```

### 3. Pydantic Schemas
**File**: `app/database/schemas.py`

**Pattern**:
```python
# Base schema with common fields
class TableNameBase(BaseModel):
    field1: str
    field2: Optional[str] = None
    # Other fields...

# Create schema (for POST requests)
class TableNameCreate(TableNameBase):
    parent_id: int  # Foreign key if applicable

# Response schema (for API responses)
class TableNameResponse(TableNameBase):
    id: int
    parent_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Aggregated response schema (if needed)
class ParentTableNamesResponse(BaseModel):
    parent_id: int
    total_items: int
    items: list[TableNameResponse]
```

### 4. Database Initialization
**Script**: `scripts/create_local_schema.py`

The script:
1. Creates the database if it doesn't exist
2. Runs the SQL schema file to create all tables
3. Verifies the schema was created successfully

**Usage**:
```bash
python scripts/create_local_schema.py
```

## Step-by-Step Guide for Adding New Data Types

### Step 1: Determine Database Location
**Ask yourself**:
- Is this for AI/ML processing, embeddings, or heavy data storage? → **Local PostgreSQL**
- Is this for user management, collaboration, or enterprise features? → **Supabase**
- Is this for analytics or read-only reporting? → **Neon**

### Step 2: Add SQL Table Definition
**File**: `app/database/local_schema.sql` (for local tables)

**Add**:
```sql
-- =============================================================================
-- Table: your_table_name
-- Purpose: Brief description of purpose
-- =============================================================================
CREATE TABLE your_table_name (
    id SERIAL PRIMARY KEY,
    local_your_table_uuid UUID NOT NULL,
    parent_id INTEGER NOT NULL REFERENCES parent_table(id) ON DELETE CASCADE,
    field1 VARCHAR(255) NOT NULL,
    field2 TEXT,
    field3 FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Link to Supabase if applicable
    supabase_your_table_id UUID
);

-- Indexes
CREATE UNIQUE INDEX idx_your_table_local_uuid ON your_table_name(local_your_table_uuid);
CREATE INDEX idx_your_table_parent_id ON your_table_name(parent_id);
CREATE INDEX idx_your_table_created_at ON your_table_name(created_at DESC);
CREATE INDEX idx_your_table_supabase_id ON your_table_name(supabase_your_table_id) WHERE supabase_your_table_id IS NOT NULL;

-- Comments
COMMENT ON TABLE your_table_name IS 'Description of table purpose';
```

### Step 3: Create SQLAlchemy Model
**File**: `app/models/your_model_name.py`

**Create**:
```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database.database_main import Base
import uuid

class YourTableName(Base):
    __tablename__ = "your_table_name"

    id = Column(Integer, primary_key=True, index=True)
    local_your_table_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True, index=True)
    parent_id = Column(Integer, ForeignKey("parent_table.id"), nullable=False, index=True)
    field1 = Column(String, nullable=False)
    field2 = Column(Text, nullable=True)
    field3 = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    supabase_your_table_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Composite index for common query patterns
    __table_args__ = (
        Index('idx_created_at_desc', 'created_at'),
    )
```

### Step 4: Add Pydantic Schemas
**File**: `app/database/schemas.py`

**Add**:
```python
# Your Table Schemas
class YourTableNameBase(BaseModel):
    field1: str
    field2: Optional[str] = None
    field3: Optional[float] = None

class YourTableNameCreate(YourTableNameBase):
    parent_id: int

class YourTableNameResponse(YourTableNameBase):
    id: int
    parent_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Parent Table Response (if applicable)
class ParentYourTableNamesResponse(BaseModel):
    parent_id: int
    total_items: int
    items: list[YourTableNameResponse]
```

### Step 5: Update Schema Creation Script
**File**: `scripts/create_local_schema.py`

**Update** the `expected_tables` list:
```python
expected_tables = [
    'documents', 'users', 'claims', 'citations',
    'claim_citation_mappings', 'embeddings', 'evidence', 
    'verification_reports', 'your_table_name'  # Add your table here
]
```

### Step 6: Database Migration
**Run the schema creation script**:
```bash
python scripts/create_local_schema.py
```

### Step 7: Create API Routes (Optional)
If you need API endpoints, create:
- `app/routes/your_router.py` - FastAPI routes
- Follow existing patterns from other routers

## Best Practices

### 1. Naming Conventions
- **Table names**: snake_case, plural (e.g., `documents`, `claims`)
- **Column names**: snake_case (e.g., `created_at`, `supabase_document_id`)
- **Model classes**: PascalCase, singular (e.g., `Document`, `Claim`)
- **Schema classes**: PascalCase with suffix (e.g., `DocumentBase`, `DocumentCreate`)

### 2. UUID Columns
Every local table should have:
- `local_[table]_uuid` - Unique identifier for cross-database linking
- `supabase_[table]_id` - Reference to Supabase table (if applicable)

### 3. Indexing
- Always index foreign keys
- Always index UUID columns
- Always index `created_at` with DESC order
- Add composite indexes for common query patterns

### 4. Foreign Key Constraints
- Use `ON DELETE CASCADE` for dependent data
- Use `ON DELETE SET NULL` for optional references
- Always add indexes for foreign key columns

### 5. Timestamps
- Always include `created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
- Use `TIMESTAMP WITH TIME ZONE` for consistency
- Index timestamp columns for time-based queries

### 6. Comments
- Add table comments explaining purpose
- Add column comments for cross-database links
- Document any special business logic

## Chat Schema Implementation

For implementing chat functionality, consider:

### Database Choice
**Local PostgreSQL** - For chat messages, conversation history, AI processing

### Suggested Tables
```sql
-- conversations table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    local_conversation_uuid UUID NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    supabase_conversation_id UUID
);

-- messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    local_message_uuid UUID NOT NULL,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    supabase_message_id UUID
);
```

### Cross-Database Strategy
- Store conversation metadata in Supabase (for collaboration)
- Store full message history in Local PostgreSQL (for AI processing)
- Link via UUID columns

## Files to Modify Summary

1. **`app/database/local_schema.sql`** - Add table definition
2. **`app/models/[model_name].py`** - Create SQLAlchemy model
3. **`app/database/schemas.py`** - Add Pydantic schemas
4. **`scripts/create_local_schema.py`** - Update expected tables list
5. **`app/routes/[router_name].py`** - Create API routes (if needed)

## Testing

After implementing your new data type:

1. **Run schema creation**: `python scripts/create_local_schema.py`
2. **Verify table creation**: Check that all expected tables exist
3. **Test model operations**: Create, read, update, delete operations
4. **Test API endpoints**: If you created routes, test all endpoints
5. **Test cross-database linking**: Verify UUID references work correctly

## Troubleshooting

### Common Issues
1. **Foreign key errors** - Ensure referenced tables exist
2. **UUID errors** - Ensure uuid-ossp extension is enabled
3. **Index errors** - Check for duplicate index names
4. **Connection errors** - Verify database URL in .env file

### Debug Commands
```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'your_table_name';

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'your_table_name' 
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'your_table_name';
```

This guide provides a complete framework for adding new data types while maintaining consistency with the existing ADAL backend architecture.
