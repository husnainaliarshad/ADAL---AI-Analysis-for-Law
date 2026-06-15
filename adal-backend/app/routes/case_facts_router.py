from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth_dependencies import require_auth
from app.database.database_manager import get_local_db
from app.services.case_facts_service import generate_case_facts


router = APIRouter(prefix="/case-facts", tags=["Case Facts"], dependencies=[Depends(require_auth)])


@router.post("/{document_id}")
async def create_case_facts(document_id: int, local_db: Session = Depends(get_local_db)):
    """
    Generate structured case facts from a document's OCR text.

    This is intentionally stateless: no database rows are created. The endpoint
    reads OCR text, asks the configured LLM for structured JSON, and returns it.
    """
    return generate_case_facts(local_db, document_id)
