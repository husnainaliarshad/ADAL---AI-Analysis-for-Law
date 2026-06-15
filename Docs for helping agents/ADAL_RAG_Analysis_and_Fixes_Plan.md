# ADAL RAG Analysis & Fixes Plan

## Overview
Systematic fixes for the ADAL RAG pipeline. **NO RE-EMBEDDING in Phase 1-3** - validate and fix configuration first.

---

## CRITICAL: Embedding Model Mismatch Detected

| Component | Current Model | Dimensions | Issue |
|-----------|--------------|------------|-------|
| Chat RAG | all-MiniLM-L6-v2 | **384** | Querying with 384-dim |
| JSONL Ingestion | BAAI/bge-m3 | **1024** | Stored 1024-dim |
| Statutes Ingestion | all-MiniLM-L6-v2 | **384** | Matches chat (good) |
| Embedding Service | BAAI/bge-base-en-v1.5 | **768** | Different model |

**Problem:** If `legal_library` has 1024-dim embeddings but chat queries with 384-dim, retrieval will silently fail.

---

## Phase 1: VALIDATE (No Changes Yet)

### 1.1 Check Current Database State
```sql
-- Run this FIRST to see what we have
SELECT DISTINCT array_length(embedding, 1) as dim, COUNT(*) 
FROM legal_library 
GROUP BY dim;
```

### 1.2 Verify Table Contents
- [ ] Check `legal_library` dimensions
- [ ] Check `legal_docs` dimensions (if exists)
- [ ] Count NULL embeddings
- [ ] Check content quality (short chunks, empty text)

### 1.3 Document Findings
| Table | Dimension | Count | Status |
|-------|-----------|-------|--------|
| legal_library | ? | ? | TBD |
| legal_docs | ? | ? | TBD |

---

## Phase 2: FIX MISMATCH (Still No Re-embedding)

### 2.1 Decision Matrix

**IF legal_library has 384-dim embeddings:**
- ✅ JSONL ingestion used MiniLM (matches chat)
- ✅ No action needed for chat service
- ⚠️ Check if any 1024-dim got in there

**IF legal_library has 1024-dim embeddings:**
- ❌ JSONL ingestion used BGE-M3
- **FIX:** Change chat_service.py to use BAAI/bge-m3
- **NO re-embedding** - just fix the query model

**IF legal_library has MIXED dimensions:**
- ❌ Serious problem
- **FIX:** Truncate table, re-ingest statutes only (384-dim)
- **OR:** Create separate tables per dimension

**IF legal_library has 768-dim embeddings:**
- ❌ Embedding service was used
- **FIX:** Change chat_service.py to use BAAI/bge-base-en-v1.5

### 2.2 Standardize on ONE Model (No Re-embedding)

Based on validation results, update these files to match DB:

| File | Action |
|------|--------|
| `chat_service.py` | Change `_get_retrieval_model()` to match DB dimension |
| `embedding_service.py` | Ensure matches same model |
| `ingest_statutes.py` | Keep as-is (already 384-dim) |
| `ingest.py` (JSONL) | **DISABLE** or modify to skip embedding |

### 2.3 Create No-Embedding Ingestion Mode

Modify `ingest.py` to support `--text-only` flag:
```python
# Skip embedding generation, store NULL
if args.text_only:
    embedding = None  # Will be populated later
else:
    embedding = model.encode(chunk_text).tolist()
```

---

## Phase 3: Ingest New Datasets (No Embedding)

### 3.1 Supreme Court Judgments
- [ ] Check if pre-made embeddings match our dimension
- [ ] If yes: ingest with embeddings
- [ ] If no: ingest text-only (embedding=NULL)

### 3.2 Pakistan Laws Dataset (969 federal laws)
- [ ] Ingest as text-only initially
- [ ] Store in new table or with NULL embeddings
- [ ] Batch embed later if needed

### 3.3 New Table Schema (for text-only ingestion)
```sql
CREATE TABLE legal_docs_pending (
    id SERIAL PRIMARY KEY,
    law_title VARCHAR(255),
    content TEXT,
    embedding VECTOR(1024),  -- NULL until embedded
    source VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Phase 4: Quality Fixes (No Re-embedding)

### 4.1 Legal-Aware Chunking
Replace character-based splitting:
```python
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,  # Tokens, not characters
    chunk_overlap=50,
    separators=[
        "\n\nSection",      # Pakistani law sections
        "\n\nArticle",      # Constitutional articles
        "\n\nRegulation",   # Regulations
        "\n\n",            # Paragraphs
        "\n",              # Lines
        ". ",               # Sentences
    ],
    length_function=lambda x: len(x.split())
)
```

### 4.2 Token Counting & Context Management
Add token budget to prevent overflow:
```python
def build_context_block(context_chunks, max_tokens=4000):
    """Build context within token budget."""
    context_lines = []
    total_tokens = 0
    
    for i, chunk in enumerate(context_chunks, 1):
        chunk_text = f"[Source {i}] {chunk['law_title']}\n{chunk['content'][:1000]}\n\n"
        chunk_tokens = count_tokens(chunk_text)
        
        if total_tokens + chunk_tokens > max_tokens:
            break
            
        context_lines.append(chunk_text)
        total_tokens += chunk_tokens
    
    return "\n".join(context_lines)
```

### 4.3 Improved Prompts
Remove similarity scores from context:
```python
# BEFORE (wastes tokens):
f"Similarity: {chunk['similarity']}\n"

# AFTER:
context_lines = [
    f"[Source {i}] {chunk['law_title']}\n"
    f"Content:\n{chunk['content']}\n"
]
```

---

## Phase 5: Testing & Validation

### 5.1 Test Queries
```
1. "What is Section 302 of Pakistan Penal Code?"
2. "Explain the punishment for murder under PPC"
3. "What are bail requirements in CrPC?"
```

### 5.2 Validation Checklist
- [ ] Query returns results (not empty)
- [ ] Results are relevant legal sources
- [ ] No dimension mismatch errors in logs
- [ ] Response time < 2 seconds

### 5.3 Metrics to Track
| Metric | Before | After |
|--------|--------|-------|
| Retrieval precision | ? | Target: 80%+ |
| Citation rate | ? | Target: 90%+ |
| Avg response time | ? | Target: <2s |

---

## Phase 6: OPTIONAL - Future Re-embedding

**ONLY after Phase 1-5 complete and if performance requires it:**

### 6.1 When to Re-embed
- Current dimension causing poor retrieval quality
- Need to consolidate to single model
- Adding GPU support for faster embedding

### 6.2 Re-embedding Strategy
| Approach | Time | Risk |
|----------|------|------|
| Batch re-embed all | 2-4 hours | High (downtime) |
| Incremental re-embed | Days | Low (gradual) |
| On-demand re-embed | Ongoing | Medium (complex) |

### 6.3 Recommended: Single Model
Standardize on **BAAI/bge-m3** (1024-dim) for best legal domain performance.

---

## Execution Order

1. **Phase 1**: Validate current DB state (30 min)
2. **Phase 2**: Fix model mismatch based on findings (1 hour)
3. **Phase 3**: Ingest new datasets text-only (30 min)
4. **Phase 4**: Quality fixes (2-3 hours)
5. **Phase 5**: Test and validate (1 hour)
6. **Phase 6**: Defer to future if needed

---

## Success Criteria

- [ ] Database dimensions validated and documented
- [ ] Chat service uses matching embedding model
- [ ] New datasets ingested (text-only acceptable)
- [ ] No re-embedding required for basic functionality
- [ ] Retrieval returns relevant results
- [ ] Response time < 2 seconds

---

## Notes

- **NO RE-EMBEDDING in Phase 1-5** - only fix configuration
- Re-embedding is Phase 6 (optional) only if validation shows it's necessary
- Focus on making current data work before regenerating embeddings
