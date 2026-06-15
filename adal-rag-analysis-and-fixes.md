# ADAL RAG System Analysis & Fix Plan

## Executive Summary

Your RAG system has **critical quality issues** that are likely causing poor retrieval results. The most severe problem is an **embedding model mismatch** - your chat service queries with 384-dimensional vectors, but your legal_library table may contain 384, 768, or 1024-dimensional embeddings depending on which ingestion script was used. This causes silent retrieval failures.

---

## Critical Issues Found

### 1. EMBEDDING MODEL MISMATCH (CRITICAL)

**The Problem:**
Different components use different embedding models with incompatible dimensions:

| Component | Model | Dimensions | File |
|-----------|-------|------------|------|
| Chat RAG | all-MiniLM-L6-v2 | **384** | `chat_service.py` |
| JSONL Ingestion | BAAI/bge-m3 | **1024** | `legal-content-of-pakistan.jsonl/ingest.py` |
| Statutes Ingestion | all-MiniLM-L6-v2 | **384** | `Dataset/scripts/ingest_statutes.py` |
| Embedding Service | BAAI/bge-base-en-v1.5 | **768** | `embedding_service.py` |

**Impact:**
- If legal_library has 1024-dim embeddings (from JSONL), your 384-dim queries will return garbage results
- If legal_library has 768-dim embeddings, your 384-dim queries will fail or return wrong matches
- pgvector does NOT error on dimension mismatch - it silently computes wrong similarities

**Evidence:**
```python
# chat_service.py - always uses 384-dim MiniLM
def _get_retrieval_model():
    global _retrieval_model
    if _retrieval_model is None:
        _retrieval_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _retrieval_model

# ingest.py - uses 1024-dim BGE-M3
model = SentenceTransformer('BAAI/bge-m3')  # 1024 dimensions!

# embedding_service.py - uses 768-dim BGE-base
BGE_MODEL_NAME = "BAAI/bge-base-en-v1.5"  # 768 dimensions
```

---

### 2. POOR LEGAL DOCUMENT CHUNKING (HIGH)

**The Problem:**
Current chunking uses character-based splitting that breaks legal sections mid-sentence:

```python
# ingest_statutes.py
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,  # Characters, not tokens!
    chunk_overlap=150,
    separators=["\n\n", "\n", " ", ""]  # No legal structure awareness
)
```

**Impact:**
- Legal sections get split mid-definition
- Section numbers lost in chunks
- Context continuity broken at boundaries
- 150 char overlap insufficient for legal text

**Example:**
A section like:
```
Section 302. Murder. (1) Whoever commits murder shall be punished with death...
```
Could be split after "Murder. (1) Whoever commits" - losing the critical legal definition.

---

### 3. CONTEXT WINDOW LIMITATIONS (HIGH)

**The Problem:**
No token counting before LLM calls. The system sends:
- Up to 5 full retrieved chunks (unlimited length each)
- Full conversation history (up to 50 messages)
- System prompt with formatting instructions

**Impact:**
- Could exceed DeepSeek's context window (4K-32K tokens)
- Silent truncation of critical legal sources
- API errors or incomplete responses
- Wasted tokens on irrelevant content

**Evidence:**
```python
# chat_service.py - no token counting
context_lines = [
    f"[Source {i}] {chunk['law_title']}\n"
    f"URL: {chunk['url']}\n"
    f"Similarity: {chunk['similarity']}\n"  # Wasted tokens
    f"Content:\n{chunk['content']}\n"  # Unlimited length!
]
```

---

### 4. PROMPT ENGINEERING ISSUES (MEDIUM)

**The Problem:**
The prompts have several suboptimal patterns:

1. **Similarity scores exposed to LLM** - irrelevant metadata that wastes tokens
2. **No few-shot examples** - inconsistent output formatting
3. **No citation format specified** - inconsistent legal citations
4. **Weak casual query fallback** - uses same prompt structure

**Current Context Format:**
```
[Source 1] Pakistan Penal Code
URL: /static/statutes/ppc.txt
Similarity: 0.89  <-- REMOVE THIS
Content:
[Full unbounded text here...]
```

---

### 5. RETRIEVAL LIMITATIONS (MEDIUM)

**The Problem:**
- Only retrieves top 5 results
- Fixed similarity threshold of 0.5 (may be too high/low)
- No reranking of results
- No fallback when retrieval fails
- Simple hash-based deduplication (first 200 chars only)

---

### 6. DATA QUALITY GAPS (MEDIUM)

**The Problem:**
No validation for:
- Empty or null embeddings
- Zero-vector embeddings
- Embedding dimension consistency
- Chunk content quality (min/max length)
- Duplicate content detection

---

## Data Flow Analysis

### What Data Actually Goes to Frontend

**Chat Response Structure:**
```json
{
  "conversation_id": 123,
  "message_id": 456,
  "response": "### ⚖️ Assessing the Inquiry\n...",
  "role": "assistant",
  "metadata": {
    "model": "deepseek-chat",
    "prompt_tokens": 1234,
    "completion_tokens": 567,
    "total_tokens": 1801,
    "status_steps": [
      "Analyzing legal intent",
      "Retrieving from Legal Library",
      "Found 3 relevant sources",
      "Drafting legal response"
    ],
    "sources_found": [
      {
        "title": "Pakistan Penal Code Section 302",
        "link": "https://...",
        "similarity": 0.89
      }
    ]
  }
}
```

**Frontend Display:**
- AI response rendered with ReactMarkdown
- Sources displayed as Material-UI Chips
- Processing status shown in LegalProcessCard
- No actual verification that sources were used in the response

---

## How Your FYP Shows Data Usage

**Current State:**
1. ✅ Frontend shows "Sources" chips below AI responses
2. ✅ Metadata includes similarity scores
3. ✅ Status steps show retrieval happened
4. ❌ No verification that sources were actually cited in the response
5. ❌ No quality metrics (precision/recall) for retrieval
6. ❌ No ground truth comparison

**What's Missing for FYP:**
- Evidence that retrieved sources are actually used by the LLM
- Relevance scores for retrieved sources
- Comparison against ground truth
- Retrieval quality metrics

---

## Recommended Fixes (Prioritized)

### Phase 1: Critical Fixes (Do First - No Re-embedding Required)

#### 1.1 Verify Current Embedding Dimensions

**Action:** Check what embedding dimensions exist in your database BEFORE making changes.

**Verification:**
```sql
-- Check current embedding dimensions
SELECT DISTINCT array_length(embedding, 1) as dim, COUNT(*) 
FROM legal_library 
GROUP BY dim;
```

**Decision Tree:**
- If ALL embeddings are **384-dim**: Keep using `all-MiniLM-L6-v2` in chat_service (no change needed)
- If ALL embeddings are **768-dim**: Update chat_service to use `BAAI/bge-base-en-v1.5`
- If ALL embeddings are **1024-dim**: Update chat_service to use `BAAI/bge-m3`
- If MIXED dimensions: See Phase 5 (Optional Re-embedding)

#### 1.2 Match Chat Service to Existing Embeddings

**Action:** Update ONLY the chat service to match your existing embedding dimensions.

**Files to Modify:**
- `adal-backend/app/services/chat_service.py` - Change model to match your embeddings

**Example:** If your DB has 384-dim embeddings:
```python
# chat_service.py - keep or change based on your DB
def _get_retrieval_model():
    global _retrieval_model
    if _retrieval_model is None:
        _retrieval_model = SentenceTransformer("all-MiniLM-L6-v2")  # 384-dim
    return _retrieval_model
```

#### 1.3 Add Data Validation Script

Create `adal-backend/scripts/validate_embeddings.py`:
```python
"""Validate legal_library data quality."""
import psycopg2
from psycopg2.extras import register_vector

def validate_embeddings():
    conn = psycopg2.connect("postgresql://...")
    register_vector(conn)
    cur = conn.cursor()
    
    # Check for empty embeddings
    cur.execute("SELECT COUNT(*) FROM legal_library WHERE embedding IS NULL")
    empty_count = cur.fetchone()[0]
    
    # Check embedding dimensions
    cur.execute("SELECT DISTINCT array_length(embedding, 1) FROM legal_library")
    dimensions = cur.fetchall()
    
    # Check for short content
    cur.execute("SELECT COUNT(*) FROM legal_library WHERE LENGTH(content) < 200")
    short_count = cur.fetchone()[0]
    
    print(f"Empty embeddings: {empty_count}")
    print(f"Dimensions found: {dimensions}")
    print(f"Short chunks (<200 chars): {short_count}")
```

---

### Phase 2: High Priority Fixes

#### 2.1 Implement Legal-Aware Chunking (For Future Ingestion)

Replace character-based splitting with legal structure awareness. **Apply this to NEW ingestion only** - don't re-chunk existing data:

```python
# New chunking strategy for future ingestion
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,  # Tokens, not characters
    chunk_overlap=50,
    separators=[
        "\n\nSection",      # Pakistani law sections
        "\n\nArticle",      # Constitutional articles
        "\n\nRegulation",   # Regulations
        "\n\nSchedule",     # Schedules
        "\n\n",            # Paragraphs
        "\n",              # Lines
        ". ",               # Sentences
        " "                 # Words
    ],
    length_function=lambda x: len(x.split())  # Token count
)
```

**Add section metadata:**
```python
import re

def extract_section_number(text):
    """Extract section/article number from legal text."""
    patterns = [
        r"Section\s+(\d+[A-Z]?)",
        r"Article\s+(\d+)",
        r"Regulation\s+(\d+)"
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None
```

#### 2.2 Add Token Counting & Context Management

Implement token budget management:

```python
import tiktoken

def count_tokens(text, model="deepseek-chat"):
    """Count tokens in text."""
    encoder = tiktoken.encoding_for_model("gpt-4")  # Approximation
    return len(encoder.encode(text))

def build_context_block(context_chunks, max_tokens=4000):
    """Build context block within token budget."""
    context_lines = []
    total_tokens = 0
    
    for i, chunk in enumerate(context_chunks, 1):
        chunk_text = f"[Source {i}] {chunk['law_title']}\n{chunk['content'][:1000]}\n\n"
        chunk_tokens = count_tokens(chunk_text)
        
        if total_tokens + chunk_tokens > max_tokens:
            break
            
        context_lines.append(chunk_text)
        total_tokens += chunk_tokens
    
    return "\n".join(context_lines), len(context_lines)
```

#### 2.3 Improve Prompt Engineering

**New LEGAL_DRAFTER_PROMPT:**
```python
LEGAL_DRAFTER_PROMPT = """\
You are ADAL, an AI legal assistant specializing in Pakistani law.

INSTRUCTIONS:
- Use ONLY the legal sources provided below
- Cite sources inline using [Source X] format
- If no relevant sources are found, state this clearly
- Be precise, professional, and concise

LEGAL SOURCES:
{context_block}

FORMAT YOUR RESPONSE WITH THESE HEADERS:

### ⚖️ Assessing the Inquiry
[Brief assessment of the legal question]

### 🔍 Analysis & Framework
[Legal analysis with inline citations like [Source 1]]

### 📚 Legal Precedents & Citations
[Relevant laws and cases with proper citations]

### 💡 Practitioner Application
[Practical advice for legal practitioners]

EXAMPLE CITATION: "Under Section 302 of the Pakistan Penal Code [Source 1], murder is defined as..."
"""
```

---

### Phase 3: Medium Priority Improvements

#### 3.1 Add Retrieval Quality Metrics

Create `adal-backend/scripts/evaluate_rag.py`:
```python
"""Evaluate RAG retrieval quality."""
import json
from chat_service import retrieve_legal_context

def evaluate_retrieval(test_queries, ground_truth):
    """
    Evaluate retrieval quality.
    
    Args:
        test_queries: List of query strings
        ground_truth: Dict mapping query -> list of relevant doc IDs
    """
    metrics = {
        "precision": [],
        "recall": [],
        "mrr": [],  # Mean Reciprocal Rank
    }
    
    for query in test_queries:
        retrieved = retrieve_legal_context(query, k=5)
        retrieved_ids = [r['id'] for r in retrieved]
        relevant_ids = ground_truth.get(query, [])
        
        # Calculate metrics
        tp = len(set(retrieved_ids) & set(relevant_ids))
        precision = tp / len(retrieved_ids) if retrieved_ids else 0
        recall = tp / len(relevant_ids) if relevant_ids else 0
        
        # MRR
        mrr = 0
        for i, doc_id in enumerate(retrieved_ids, 1):
            if doc_id in relevant_ids:
                mrr = 1 / i
                break
        
        metrics["precision"].append(precision)
        metrics["recall"].append(recall)
        metrics["mrr"].append(mrr)
    
    return {
        "avg_precision": sum(metrics["precision"]) / len(metrics["precision"]),
        "avg_recall": sum(metrics["recall"]) / len(metrics["recall"]),
        "avg_mrr": sum(metrics["mrr"]) / len(metrics["mrr"]),
    }
```

#### 3.2 Add Source Verification

Verify that retrieved sources are actually cited:

```python
def verify_source_usage(response, sources):
    """Check if sources are actually cited in the response."""
    cited_sources = []
    for i, source in enumerate(sources, 1):
        if f"[Source {i}]" in response or source['law_title'] in response:
            cited_sources.append(i)
    
    return {
        "total_sources": len(sources),
        "cited_sources": len(cited_sources),
        "citation_rate": len(cited_sources) / len(sources) if sources else 0,
        "uncited_sources": [s['law_title'] for i, s in enumerate(sources, 1) if i not in cited_sources]
    }
```

#### 3.3 Implement Query Expansion

Improve the intent analyst to generate better search queries:

```python
INTENT_ANALYST_PROMPT = """\
You are an intent classification engine for a Pakistani legal assistant.

Given the user's message, do TWO things:
1. Classify as casual (greeting/thanks) or legal query
2. If legal, generate 2-4 search queries covering:
   - Exact legal terms used
   - Broader legal concepts
   - Related statutes/sections
   - Alternative phrasings

Respond with JSON only:
{"is_casual": false, "queries": ["query1", "query2", "query3"]}

EXAMPLE:
User: "What is the punishment for murder under PPC?"
Response: {"is_casual": false, "queries": ["Pakistan Penal Code Section 302 murder punishment", "PPC 302 qisas diyat death penalty", "murder punishment Pakistani law"]}
"""
```

---

### Phase 4: Nice-to-Have Improvements

#### 4.1 Add Reranking

Use a cross-encoder to rerank retrieved results:

```python
from sentence_transformers import CrossEncoder

# Load reranker
reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

def rerank_results(query, results, top_k=3):
    """Rerank retrieved results using cross-encoder."""
    pairs = [(query, r['content']) for r in results]
    scores = reranker.predict(pairs)
    
    # Sort by reranker score
    scored_results = [(score, result) for score, result in zip(scores, results)]
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    return [r for _, r in scored_results[:top_k]]
```

#### 4.2 Add Hybrid Search

Combine vector search with keyword search:

```python
from rank_bm25 import BM25Okapi

def hybrid_search(query, vector_results, keyword_weight=0.3):
    """Combine vector and keyword search."""
    # Get keyword results
    tokenized_query = query.lower().split()
    keyword_scores = bm25.get_scores(tokenized_query)
    
    # Normalize scores
    vector_scores = [r['similarity'] for r in vector_results]
    
    # Combine
    combined = []
    for i, result in enumerate(vector_results):
        combined_score = (1 - keyword_weight) * vector_scores[i] + keyword_weight * keyword_scores[i]
        result['hybrid_score'] = combined_score
        combined.append(result)
    
    # Sort by combined score
    combined.sort(key=lambda x: x['hybrid_score'], reverse=True)
    return combined
```

---

### Phase 5: Optional - Re-embedding (Do Later)

**⚠️ WARNING: This step takes significant time. Only do this after completing Phases 1-4.**

#### 5.1 When to Re-embed

Re-embedding is ONLY needed if:
1. Validation shows **mixed embedding dimensions** in your database
2. You want to upgrade to a better model (e.g., BGE-M3 for legal domain)
3. You have significant data quality issues

#### 5.2 Re-ingest with Consistent Model

If you decide to re-embed:

```bash
# 1. Backup your data first
pg_dump -t legal_library > legal_library_backup.sql

# 2. Truncate the table
psql -c "TRUNCATE legal_library;"

# 3. Re-ingest with consistent model (choose ONE)
# Option A: Use BGE-M3 (1024-dim, best for legal)
python Dataset/scripts/ingest_statutes.py --model BAAI/bge-m3

# Option B: Use all-MiniLM-L6-v2 (384-dim, faster)
python Dataset/scripts/ingest_statutes.py --model all-MiniLM-L6-v2

# 4. Update chat_service.py to match the chosen model
```

#### 5.3 Update All Services to Match

After re-embedding, update these files to use the SAME model:
- `adal-backend/app/services/chat_service.py`
- `Dataset/scripts/ingest_statutes.py`
- `adal-backend/app/services/embedding_service.py`

**Time Estimate:** Re-embedding the entire legal corpus takes 2-6 hours depending on your hardware.

---

## Testing & Validation Plan

### 1. Embedding Validation
```bash
# Check embedding dimensions
python -c "
import psycopg2
from psycopg2.extras import register_vector
conn = psycopg2.connect('postgresql://...')
register_vector(conn)
cur = conn.cursor()
cur.execute('SELECT DISTINCT array_length(embedding, 1) FROM legal_library')
print('Dimensions:', cur.fetchall())
"
```

### 2. Retrieval Quality Test
```bash
# Run evaluation script
python adal-backend/scripts/evaluate_rag.py --test-queries test_queries.json --ground-truth ground_truth.json
```

### 3. End-to-End Test
```bash
# Test chat endpoint
python adal-backend/test_chat_endpoints.py --base-url http://localhost:9006
```

### 4. Manual Verification
Test these queries and verify sources are relevant:
- "What is the punishment for murder in Pakistan?"
- "Explain Section 302 of PPC"
- "What are the requirements for a valid contract?"

---

## Files to Modify Summary

| Priority | File | Changes |
|----------|------|---------|
| Critical | `chat_service.py` | Match embedding model to DB, add token counting |
| Critical | New file | `validate_embeddings.py` - data quality checks |
| High | `chat_service.py` | Improve prompts, add context truncation |
| High | `ingest_statutes.py` | Improve legal-aware chunking |
| Medium | New file | `evaluate_rag.py` - retrieval quality metrics |
| Medium | `chat_service.py` | Add source verification |
| Low | New file | `reranker.py` - cross-encoder reranking |
| Optional | All ingestion files | Re-embed with consistent model (Phase 5) |

---

## Expected Outcomes After Fixes

1. **Retrieval Accuracy**: 80%+ precision on legal queries (after matching embedding dimensions)
2. **Citation Rate**: 90%+ of retrieved sources cited in responses
3. **Response Quality**: Legal responses properly grounded in statutes
4. **Token Efficiency**: No context window overflows
5. **Data Quality**: Validation identifies any issues (re-embedding optional)

---

## For Your FYP Demo

**What to Show:**
1. Query → Retrieved Sources → AI Response flow
2. Source citations in AI response (with [Source X] markers)
3. Similarity scores for retrieved sources
4. Retrieval quality metrics (precision/recall)
5. Before/after comparison (if you implement fixes)

**What to Measure:**
- Precision: % of retrieved sources that are relevant
- Recall: % of relevant sources that were retrieved
- Citation Rate: % of retrieved sources actually cited
- Response Latency: Time from query to response

**Demo Queries:**
- "What is Section 302 of Pakistan Penal Code?"
- "Explain the requirements for a valid marriage under Muslim Family Laws"
- "What are the grounds for divorce in Pakistan?"
