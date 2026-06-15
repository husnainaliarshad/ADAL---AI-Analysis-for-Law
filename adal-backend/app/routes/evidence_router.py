"""
Evidence API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth
from app.database.schemas import (
    EvidenceResponse,
    DocumentEvidenceResponse,
    ClaimEvidenceResponse
)
from app.services.evidence_service import (
    retrieve_evidence_for_claim,
    retrieve_evidence_for_query,
    get_evidence_by_claim,
    get_evidence_by_document,
    get_evidence_by_id,
    delete_evidence_by_claim,
    delete_evidence_by_document
)
from pydantic import BaseModel

router = APIRouter(prefix="/evidence", tags=["Evidence"], dependencies=[Depends(require_auth)])


# Request Models
class RetrieveEvidenceRequest(BaseModel):
    k: int = 10
    threshold: float = 0.3
    index_name: str = "supreme_court_judgments"


class QueryEvidenceRequest(BaseModel):
    query: str
    k: int = 10
    threshold: float = 0.3
    index_name: str = "supreme_court_judgments"


@router.post("/claims/{claim_id}/retrieve", response_model=ClaimEvidenceResponse)
async def retrieve_evidence_for_claim_endpoint(
    claim_id: int,
    request: RetrieveEvidenceRequest,
    local_db: Session = Depends(get_local_db)
):
    """
    Retrieve evidence paragraphs for a specific claim using FAISS search.
    
    Evidence is stored in Local PostgreSQL only (RAG retrieval data).
    """
    try:
        evidence = retrieve_evidence_for_claim(
            local_db,
            claim_id,
            k=request.k,
            threshold=request.threshold,
            index_name=request.index_name
        )
        
        return ClaimEvidenceResponse(
            claim_id=claim_id,
            total_evidence=len(evidence),
            evidence=[EvidenceResponse.model_validate(e) for e in evidence]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve evidence: {str(e)}")


@router.post("/documents/{document_id}/query", response_model=DocumentEvidenceResponse)
async def retrieve_evidence_for_query_endpoint(
    document_id: int,
    request: QueryEvidenceRequest,
    local_db: Session = Depends(get_local_db)
):
    """
    Retrieve evidence paragraphs for a custom query (not tied to a specific claim).
    
    Evidence is stored in Local PostgreSQL only (RAG retrieval data).
    """
    try:
        evidence = retrieve_evidence_for_query(
            local_db,
            request.query,
            document_id,
            k=request.k,
            threshold=request.threshold,
            index_name=request.index_name
        )
        
        return DocumentEvidenceResponse(
            document_id=document_id,
            total_evidence=len(evidence),
            evidence=[EvidenceResponse.model_validate(e) for e in evidence]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve evidence: {str(e)}")


@router.get("/claims/{claim_id}", response_model=ClaimEvidenceResponse)
async def get_claim_evidence(
    claim_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get all evidence previously retrieved for a claim from Local PostgreSQL.
    """
    evidence = get_evidence_by_claim(local_db, claim_id)
    
    return ClaimEvidenceResponse(
        claim_id=claim_id,
        total_evidence=len(evidence),
        evidence=[EvidenceResponse.model_validate(e) for e in evidence]
    )


@router.get("/documents/{document_id}", response_model=DocumentEvidenceResponse)
async def get_document_evidence(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get all evidence for a document from Local PostgreSQL.
    """
    evidence = get_evidence_by_document(local_db, document_id)
    
    return DocumentEvidenceResponse(
        document_id=document_id,
        total_evidence=len(evidence),
        evidence=[EvidenceResponse.model_validate(e) for e in evidence]
    )


@router.get("/{evidence_id}", response_model=EvidenceResponse)
async def get_evidence(
    evidence_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get a specific evidence by ID from Local PostgreSQL.
    """
    evidence = get_evidence_by_id(local_db, evidence_id)
    return EvidenceResponse.model_validate(evidence)


@router.delete("/claims/{claim_id}")
async def delete_claim_evidence(
    claim_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Delete all evidence for a claim from Local PostgreSQL.
    """
    deleted_count = delete_evidence_by_claim(local_db, claim_id)
    return {
        "message": f"Deleted {deleted_count} evidence entries",
        "claim_id": claim_id
    }


@router.delete("/documents/{document_id}")
async def delete_document_evidence(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Delete all evidence for a document from Local PostgreSQL.
    """
    deleted_count = delete_evidence_by_document(local_db, document_id)
    return {
        "message": f"Deleted {deleted_count} evidence entries",
        "document_id": document_id
    }

