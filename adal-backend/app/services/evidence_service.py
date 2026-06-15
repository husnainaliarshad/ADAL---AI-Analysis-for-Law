"""
Evidence Service
Extracts and stores evidence paragraphs from retrieved embeddings
"""
from pathlib import Path
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.evidence_model import Evidence
from app.models.claim_model import Claim
from app.models.document_model import Document
from app.services.vector_retrieval_service import search_legal_library
from app.services.embedding_service import generate_embedding_for_query

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the current directory (adal-backend)
load_dotenv()

# 1. Get the Raw Dataset Path from the environment
# We use .resolve() to make sure ".." actually points to the right place
DATASET_DIR = Path(os.getenv("ADAL_DATASET_DIR", "../Dataset/Supreme_court_Of_Pakistan_judgments")).resolve()

# 2. Check if it exists (Very important for huge legal datasets!)
if not DATASET_DIR.exists():
    print(f"[WARNING] Dataset not found at {DATASET_DIR}")
else:
    print(f"[OK] Supreme Court Dataset loaded from: {DATASET_DIR}")

def extract_evidence_from_retrieval_results(
    retrieval_results: List[Dict],
    index_name: str = "supreme_court_judgments"
) -> List[Dict]:
    """
    Extract full paragraph text from retrieval results.
    
    Args:
        retrieval_results: Results from FAISS search
        index_name: Name of the FAISS index
    
    Returns:
        List of evidence dictionaries with full text
    """
    evidence_list = []
    
    for result in retrieval_results:
        metadata = result.get("metadata", {})
        similarity = result.get("similarity", 0.0)
        rank = result.get("rank", 0)
        
        # In pgvector, the content is in the 'content' field
        chunk_text = result.get("content", "")
        
        # Get source document filename from metadata 'source'
        filename = metadata.get("source") or metadata.get("document_filename", "")
        
        # Create evidence entry
        evidence = {
            "paragraph_text": chunk_text,
            "relevance_score": similarity,
            "source_document_filename": filename,
            "source_index_name": index_name,
            "source_chunk_index": metadata.get("chunk_index", 0),
            "retrieval_rank": rank,
            "metadata": metadata
        }
        
        evidence_list.append(evidence)
    
    return evidence_list


def retrieve_evidence_for_claim(
    local_db: Session,
    claim_id: int,
    k: int = 10,
    threshold: float = 0.3,
    index_name: str = "supreme_court_judgments"
) -> List[Evidence]:
    """
    Retrieve evidence paragraphs for a claim using FAISS search.
    
    Evidence is stored in Local PostgreSQL only (RAG retrieval data).
    
    Args:
        local_db: Local PostgreSQL database session
        claim_id: ID of the claim
        k: Number of results to retrieve
        threshold: Minimum similarity threshold
        index_name: Name of the FAISS index to search
    
    Returns:
        List of Evidence objects
    """
    # Get the claim from Local PostgreSQL
    claim = local_db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Search for similar paragraphs in pgvector legal_library
    search_results = search_legal_library(
        claim.claim_text,
        k=k,
        threshold=threshold,
        doc_type_filter="judgement"
    )
    
    if not search_results:
        return []
    
    # Extract evidence from results
    evidence_data = extract_evidence_from_retrieval_results(search_results, index_name)
    
    # Create Evidence objects
    evidence_objects = []
    for ev_data in evidence_data:
        evidence = Evidence(
            document_id=claim.document_id,  # Link to the claim's document
            claim_id=claim_id,
            paragraph_text=ev_data["paragraph_text"],
            relevance_score=ev_data["relevance_score"],
            source_document_filename=ev_data["source_document_filename"],
            source_index_name=ev_data["source_index_name"],
            source_chunk_index=ev_data["source_chunk_index"],
            retrieval_rank=ev_data["retrieval_rank"]
        )
        evidence_objects.append(evidence)
    
    # Save to Local PostgreSQL
    local_db.add_all(evidence_objects)
    local_db.commit()
    
    # Refresh to get IDs
    for ev in evidence_objects:
        local_db.refresh(ev)
    
    return evidence_objects


def retrieve_evidence_for_query(
    local_db: Session,
    query_text: str,
    document_id: int,
    k: int = 10,
    threshold: float = 0.3,
    index_name: str = "supreme_court_judgments"
) -> List[Evidence]:
    """
    Retrieve evidence paragraphs for a custom query (not tied to a specific claim).
    
    Evidence is stored in Local PostgreSQL only (RAG retrieval data).
    
    Args:
        local_db: Local PostgreSQL database session
        query_text: Query text to search for
        document_id: Document ID to link evidence to
        k: Number of results to retrieve
        threshold: Minimum similarity threshold
        index_name: Name of the FAISS index to search
    
    Returns:
        List of Evidence objects
    """
    # Search for similar paragraphs in pgvector legal_library
    search_results = search_legal_library(
        query_text,
        k=k,
        threshold=threshold,
        doc_type_filter="judgement"
    )
    
    if not search_results:
        return []
    
    # Extract evidence from results
    evidence_data = extract_evidence_from_retrieval_results(search_results, index_name)
    
    # Create Evidence objects
    evidence_objects = []
    for ev_data in evidence_data:
        evidence = Evidence(
            document_id=document_id,
            claim_id=None,  # Not tied to a specific claim
            paragraph_text=ev_data["paragraph_text"],
            relevance_score=ev_data["relevance_score"],
            source_document_filename=ev_data["source_document_filename"],
            source_index_name=ev_data["source_index_name"],
            source_chunk_index=ev_data["source_chunk_index"],
            retrieval_rank=ev_data["retrieval_rank"]
        )
        evidence_objects.append(evidence)
    
    # Save to Local PostgreSQL
    local_db.add_all(evidence_objects)
    local_db.commit()
    
    # Refresh to get IDs
    for ev in evidence_objects:
        local_db.refresh(ev)
    
    return evidence_objects


def get_evidence_by_claim(local_db: Session, claim_id: int) -> List[Evidence]:
    """Get all evidence for a specific claim from Local PostgreSQL."""
    return local_db.query(Evidence).filter(Evidence.claim_id == claim_id).order_by(Evidence.relevance_score.desc()).all()


def get_evidence_by_document(local_db: Session, document_id: int) -> List[Evidence]:
    """Get all evidence for a document from Local PostgreSQL."""
    return local_db.query(Evidence).filter(Evidence.document_id == document_id).order_by(Evidence.relevance_score.desc()).all()


def get_evidence_by_id(local_db: Session, evidence_id: int) -> Evidence:
    """Get a specific evidence by ID from Local PostgreSQL."""
    evidence = local_db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


def delete_evidence_by_claim(local_db: Session, claim_id: int) -> int:
    """Delete all evidence for a claim from Local PostgreSQL."""
    deleted_count = local_db.query(Evidence).filter(Evidence.claim_id == claim_id).delete()
    local_db.commit()
    return deleted_count


def delete_evidence_by_document(local_db: Session, document_id: int) -> int:
    """Delete all evidence for a document from Local PostgreSQL."""
    deleted_count = local_db.query(Evidence).filter(Evidence.document_id == document_id).delete()
    local_db.commit()
    return deleted_count

