import logging
import os
import json
import threading
from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy import create_engine, text

from app.services.embedding_service import load_bge_model

logger = logging.getLogger(__name__)

_vector_engine = None
_retrieval_model = None
_model_lock = threading.Lock()
_status_lock = threading.Lock()
_warmup_thread = None

_model_status = {
    "state": "idle",
    "is_loaded": False,
    "model_name": os.getenv("BGE_MODEL_NAME", "BAAI/bge-m3"),
    "started_at": None,
    "ready_at": None,
    "last_error": None,
}

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def get_vector_model_status() -> Dict:
    with _status_lock:
        return dict(_model_status)


def _get_vector_engine():
    """Return a SQLAlchemy engine pointed at the pgvector database."""
    global _vector_engine
    if _vector_engine is None:
        url = os.getenv("LOCAL_DATABASE_URL")
        if not url:
            # Fallback for local development if not in .env
            url = "postgresql://admin:password@localhost:5433/adalbot"
        _vector_engine = create_engine(url, pool_size=5, pool_pre_ping=True)
    return _vector_engine

def _get_retrieval_model():
    """Lazy-load the sentence-transformer used for embeddings."""
    global _retrieval_model
    if _retrieval_model is None:
        with _model_lock:
            if _retrieval_model is None:
                from sentence_transformers import SentenceTransformer
                
                model_name = os.getenv("BGE_MODEL_NAME", "BAAI/bge-m3")
                local_files_only = os.getenv("CLAIM_MODEL_LOCAL_FILES_ONLY", "false").strip().lower() in {"1", "true", "yes", "on"}
                
                with _status_lock:
                    _model_status["state"] = "loading"
                    _model_status["started_at"] = _utc_now_iso()
                
                logger.info(f"Loading retrieval model: {model_name} (local_files_only={local_files_only})")
                try:
                    _retrieval_model = SentenceTransformer(
                        model_name,
                        local_files_only=local_files_only
                    )
                    with _status_lock:
                        _model_status["state"] = "ready"
                        _model_status["is_loaded"] = True
                        _model_status["ready_at"] = _utc_now_iso()
                except Exception as e:
                    with _status_lock:
                        _model_status["state"] = "error"
                        _model_status["last_error"] = str(e)
                    raise e
    return _retrieval_model

def start_vector_model_warmup():
    """Start background warmup of the vector model."""
    global _warmup_thread
    
    with _status_lock:
        if _model_status["is_loaded"] or _model_status["state"] == "loading":
            return
            
    def _warmup():
        try:
            _get_retrieval_model()
            logger.info("Vector retrieval model warmed up successfully")
        except Exception as e:
            logger.error(f"Vector model warmup failed: {e}")
            
    _warmup_thread = threading.Thread(target=_warmup, daemon=True)
    _warmup_thread.start()
    return get_vector_model_status()


def search_legal_library(
    query_text: str,
    k: int = 10,
    threshold: float = 0.4,
    doc_type_filter: Optional[str] = None
) -> List[Dict]:
    """
    Search the legal_library table using pgvector cosine similarity.
    
    Args:
        query_text: The search query
        k: Number of results to return
        threshold: Minimum similarity threshold (0.0 to 1.0)
        doc_type_filter: Optional filter for metadata->>'doc_type'
        
    Returns:
        List of result dictionaries
    """
    model = _get_retrieval_model()
    engine = _get_vector_engine()
    
    try:
        # Generate embedding
        embedding = model.encode(query_text).tolist()
        vec_literal = "[" + ",".join(str(x) for x in embedding) + "]"
        
        # Build query
        where_clause = "WHERE 1 - (embedding <=> :qvec ::vector) > :threshold"
        if doc_type_filter:
            where_clause += " AND metadata->>'doc_type' = :doc_type"
            
        sql = text(f"""
            SELECT 
                id, 
                law_title, 
                content, 
                metadata,
                1 - (embedding <=> :qvec ::vector) AS similarity
            FROM legal_library
            {where_clause}
            ORDER BY embedding <=> :qvec ::vector
            LIMIT :k
        """)
        
        params = {"qvec": vec_literal, "threshold": threshold, "k": k}
        if doc_type_filter:
            params["doc_type"] = doc_type_filter
            
        results = []
        with engine.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
            
        for i, row in enumerate(rows):
            # Row mapping: id, law_title, content, metadata, similarity
            metadata = row[3]
            if isinstance(metadata, str):
                metadata = json.loads(metadata)
                
            results.append({
                "id": row[0],
                "law_title": row[1],
                "content": row[2],
                "metadata": metadata,
                "similarity": float(row[4]),
                "rank": i + 1
            })
            
        return results
        
    except Exception as e:
        logger.error(f"pgvector search failed: {e}")
        return []
