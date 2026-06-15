from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth
from app.services.summary_service import summarize_document


class SummaryRequest(BaseModel):
    document_id: int
    short: bool = False


router = APIRouter(prefix="/summary", tags=["Summary"], dependencies=[Depends(require_auth)])


@router.post("/")
async def create_summary(payload: SummaryRequest, local_db: Session = Depends(get_local_db)):
    """
    Generate a summary for a document's OCR text.
    
    Documents are stored in Local PostgreSQL only.
    Returns 404 if the document does not exist, 400 if OCR text is missing.
    """
    return summarize_document(local_db, document_id=payload.document_id, short=payload.short)

