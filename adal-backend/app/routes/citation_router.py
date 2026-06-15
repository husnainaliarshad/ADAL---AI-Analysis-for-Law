from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth
from app.core.realtime import documents_realtime_manager
from app.database.schemas import CitationResponse, DocumentCitationsResponse
from app.services.citation_service import (
    extract_citations_from_document,
    get_citations_by_document,
    get_citation_by_id,
    delete_citations_by_document
)


def get_optional_supabase_db():
    """Get Supabase DB if available, otherwise return None."""
    try:
        from app.database.database_manager import SupabaseSessionLocal
        if SupabaseSessionLocal:
            db = SupabaseSessionLocal()
            try:
                yield db
            finally:
                db.close()
        else:
            yield None
    except Exception:
        yield None

router = APIRouter(prefix="/citations", tags=["Citations"], dependencies=[Depends(require_auth)])
logger = logging.getLogger(__name__)


@router.post("/documents/{document_id}/extract", response_model=DocumentCitationsResponse)
async def extract_citations(
    document_id: int,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Extract citations from a document's OCR text.
    
    This endpoint will:
    1. Retrieve the document's OCR text from Local PostgreSQL
    2. Detect legal citations using regex patterns
    3. Save citations to Local PostgreSQL (with position tracking)
    4. Create validation entries in Supabase (if available)
    5. Link records via supabase_citation_id
    6. Return all detected citations
    """
    try:
        citations = extract_citations_from_document(local_db, document_id, supabase_db)
        
        # Convert SQLAlchemy objects to Pydantic models
        # In Pydantic v2, model_validate works with from_attributes=True (now ConfigDict)
        citation_responses = [CitationResponse.model_validate(c) for c in citations]

        response = DocumentCitationsResponse(
            document_id=document_id,
            total_citations=len(citations),
            citations=citation_responses
        )
        await documents_realtime_manager.broadcast({
            "type": "documents.updated",
            "action": "citations_extracted",
            "document_id": document_id,
            "total_citations": len(citations),
        })
        return response
        
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to extract citations for document_id=%s", document_id)
        raise HTTPException(status_code=500, detail="Failed to extract citations")


@router.get("/documents/{document_id}", response_model=DocumentCitationsResponse)
async def get_document_citations(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get all citations for a specific document from Local PostgreSQL.
    """
    citations = get_citations_by_document(local_db, document_id)
    
    return DocumentCitationsResponse(
        document_id=document_id,
        total_citations=len(citations),
        citations=[CitationResponse.model_validate(c) for c in citations]
    )


@router.get("/{citation_id}", response_model=CitationResponse)
async def get_citation(
    citation_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get a specific citation by ID from Local PostgreSQL.
    """
    citation = get_citation_by_id(local_db, citation_id)
    return CitationResponse.model_validate(citation)


@router.delete("/documents/{document_id}")
async def delete_document_citations(
    document_id: int,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Delete all citations for a document from both databases.
    Useful for re-extracting citations.
    
    Deletes from:
    - Local PostgreSQL (citations with position tracking)
    - Supabase (citation validation entries, if linked)
    """
    deleted_count = delete_citations_by_document(local_db, document_id, supabase_db)
    await documents_realtime_manager.broadcast({
        "type": "documents.updated",
        "action": "citations_deleted",
        "document_id": document_id,
        "deleted_citations": deleted_count,
    })
    return {
        "message": f"Deleted {deleted_count} citations",
        "document_id": document_id
    }
