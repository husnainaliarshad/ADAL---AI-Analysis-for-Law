from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, DisconnectionError
from typing import List, Optional
from pydantic import BaseModel
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth
from app.core.realtime import documents_realtime_manager
from app.database.schemas import (
    ClaimResponse, 
    DocumentClaimsResponse,
    ClaimCitationMappingResponse
)
from app.services.claim_service import (
    segment_claims_with_citations,
    get_all_claims,
    get_claims_by_document,
    get_claim_by_id,
    delete_claims_by_document,
    get_claim_citation_mappings,
    get_claim_model_status,
    start_claim_model_warmup,
)

router = APIRouter(prefix="/claims", tags=["Claims"], dependencies=[Depends(require_auth)])


class SegmentClaimsRequest(BaseModel):
    use_citation_guidance: Optional[bool] = None


@router.get("/warmup/status")
async def get_claim_model_warmup_status():
    """Get the current warmup/loading state of the claim segmentation model."""
    return get_claim_model_status()


@router.post("/warmup")
async def warm_claim_model():
    """Trigger background warmup for the claim segmentation model."""
    return start_claim_model_warmup()


@router.get("", response_model=DocumentClaimsResponse)
async def get_all_claims_endpoint(
    skip: int = Query(0, ge=0, description="Number of claims to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of claims to return"),
    local_db: Session = Depends(get_local_db)
):
    """
    Get all claims across all documents from Local PostgreSQL.
    
    Useful for browsing all claims and their IDs.
    """
    claims = get_all_claims(local_db, skip=skip, limit=limit)
    
    return DocumentClaimsResponse(
        document_id=0,  # 0 indicates "all documents"
        total_claims=len(claims),
        claims=[ClaimResponse.model_validate(c) for c in claims]
    )


@router.post("/documents/{document_id}/segment", response_model=DocumentClaimsResponse)
async def segment_claims(
    document_id: int,
    payload: Optional[SegmentClaimsRequest] = Body(default=None),
    use_citation_guidance: Optional[bool] = Query(default=None),
    local_db: Session = Depends(get_local_db)
):
    """
    Segment claims from a document using InLegalBERT.
    
    Claims are stored in Local PostgreSQL only (AI/ML processing data).
    
    This endpoint will:
    1. Retrieve the document's OCR text from Local PostgreSQL
    2. Optionally use existing citations to guide segmentation
    3. Use InLegalBERT to identify claim boundaries
    4. Map claims to citations
    5. Save claims to Local PostgreSQL
    6. Return all detected claims
    
    Args:
        document_id: ID of the document
        use_citation_guidance: Whether to use citation positions for guidance (default: True)
    """
    try:
        resolved_use_citation_guidance = True
        if payload and payload.use_citation_guidance is not None:
            resolved_use_citation_guidance = payload.use_citation_guidance
        elif use_citation_guidance is not None:
            resolved_use_citation_guidance = use_citation_guidance

        claims = segment_claims_with_citations(
            local_db, 
            document_id, 
            use_citation_guidance=resolved_use_citation_guidance
        )
        
        # Convert SQLAlchemy objects to Pydantic models
        claim_responses = [ClaimResponse.model_validate(c) for c in claims]
        
        response = DocumentClaimsResponse(
            document_id=document_id,
            total_claims=len(claims),
            claims=claim_responses
        )
        await documents_realtime_manager.broadcast({
            "type": "documents.updated",
            "action": "claims_segmented",
            "document_id": document_id,
            "total_claims": len(claims),
        })
        return response
    except HTTPException:
        raise
    except (OperationalError, DisconnectionError) as e:
        # Database connection error - provide helpful message
        error_msg = (
            "Database connection error. This may be due to:\n"
            "1. Connection timeout (try again)\n"
            "2. Network issues\n"
            "3. Database server temporarily unavailable\n\n"
            f"Error: {str(e)}\n\n"
            "Please try again. If the problem persists, check your database connection."
        )
        raise HTTPException(status_code=503, detail=error_msg)
    except Exception as e:
        import traceback
        error_msg = f"Failed to segment claims: {str(e)}"
        # Don't expose full traceback in production
        error_detail = error_msg
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/documents/{document_id}", response_model=DocumentClaimsResponse)
async def get_document_claims(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get all claims for a specific document from Local PostgreSQL.
    """
    claims = get_claims_by_document(local_db, document_id)
    
    return DocumentClaimsResponse(
        document_id=document_id,
        total_claims=len(claims),
        claims=[ClaimResponse.model_validate(c) for c in claims]
    )


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get a specific claim by ID from Local PostgreSQL.
    """
    claim = get_claim_by_id(local_db, claim_id)
    return ClaimResponse.model_validate(claim)


@router.delete("/documents/{document_id}")
async def delete_document_claims(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Delete all claims for a document from Local PostgreSQL.
    Useful for re-segmenting claims.
    """
    deleted_count = delete_claims_by_document(local_db, document_id)
    await documents_realtime_manager.broadcast({
        "type": "documents.updated",
        "action": "claims_deleted",
        "document_id": document_id,
        "deleted_claims": deleted_count,
    })
    return {
        "message": f"Deleted {deleted_count} claims",
        "document_id": document_id
    }


@router.get("/{claim_id}/citations", response_model=List[ClaimCitationMappingResponse])
async def get_claim_citations(
    claim_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get all citations mapped to a specific claim from Local PostgreSQL.
    """
    mappings = get_claim_citation_mappings(local_db, claim_id)
    return [ClaimCitationMappingResponse.model_validate(m) for m in mappings]


