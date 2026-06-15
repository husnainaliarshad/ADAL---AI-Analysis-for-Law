from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database.database_manager import get_local_db
from app.services.file_service import delete_document
from app.services.citation_service import delete_citations_by_document
from app.services.evidence_service import delete_evidence_by_claim, delete_evidence_by_document
from app.services.claim_service import delete_claims_by_document
from app.models.document_model import Document
from app.models.claim_model import Claim
from app.models.evidence_model import Evidence
from app.models.citation_model import Citation
from app.models.user_model import User
from fastapi import HTTPException
from app.core.auth_dependencies import require_admin


class DeleteDocumentRequest(BaseModel):
    document_id: int


router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


def get_optional_supabase_db():
    """Yield Supabase session if configured, else None."""
    from app.database.database_manager import SupabaseSessionLocal
    if not SupabaseSessionLocal:
        yield None
        return
    db = SupabaseSessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.delete("/documents", summary="Delete one document and all related data")
async def admin_delete_document(
    payload: DeleteDocumentRequest,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Delete a specific document and all related records (citations, claims, evidence, embeddings).
    """
    return delete_document(local_db, payload.document_id, supabase_db)


@router.delete("/documents/all", summary="Delete ALL documents and related data")
async def admin_delete_all_documents(
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Danger: deletes ALL documents and related records (citations, claims, evidence, embeddings).
    Use only in trusted/local environments.
    """
    doc_ids = [doc.id for doc in local_db.query(Document.id).all()]
    deleted = []
    for doc_id in doc_ids:
        deleted.append(delete_document(local_db, doc_id, supabase_db))
    return {"deleted_count": len(deleted), "details": deleted}


@router.delete("/documents/{document_id}", summary="Delete document by ID (and related data)")
async def admin_delete_document_by_id(
    document_id: int,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Delete a specific document by ID (path param) and all related data.
    """
    return delete_document(local_db, document_id, supabase_db)


@router.delete("/users/{user_id}", summary="Delete a user (local only)")
async def admin_delete_user(
    user_id: int,
    local_db: Session = Depends(get_local_db)
):
    user = local_db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    local_db.delete(user)
    local_db.commit()
    return {"message": f"Deleted user {user_id}"}


@router.delete("/claims/{claim_id}", summary="Delete a claim and its evidence")
async def admin_delete_claim(
    claim_id: int,
    local_db: Session = Depends(get_local_db)
):
    # Delete evidence tied to the claim
    delete_evidence_by_claim(local_db, claim_id)
    # Delete the claim
    claim = local_db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    local_db.delete(claim)
    local_db.commit()
    return {"message": f"Deleted claim {claim_id}"}


@router.delete("/evidence/{evidence_id}", summary="Delete a single evidence record")
async def admin_delete_evidence(
    evidence_id: int,
    local_db: Session = Depends(get_local_db)
):
    ev = local_db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    local_db.delete(ev)
    local_db.commit()
    return {"message": f"Deleted evidence {evidence_id}"}


@router.delete("/citations/{citation_id}", summary="Delete a citation (and Supabase metadata if linked)")
async def admin_delete_citation(
    citation_id: int,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    citation = local_db.query(Citation).filter(Citation.id == citation_id).first()
    if not citation:
        raise HTTPException(status_code=404, detail="Citation not found")

    # Delete Supabase citation metadata if linked
    if supabase_db and citation.supabase_citation_id:
        from sqlalchemy import text
        try:
            supabase_db.execute(
                text("DELETE FROM citations_metadata WHERE id = :id"),
                {"id": str(citation.supabase_citation_id)}
            )
            supabase_db.commit()
        except Exception:
            supabase_db.rollback()

    local_db.delete(citation)
    local_db.commit()
    return {"message": f"Deleted citation {citation_id}"}

