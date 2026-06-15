from pathlib import Path
import sys
from functools import lru_cache
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.document_model import Document

# Ensure the /sum directory is importable (contains summarizer modules).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
SUM_DIR = PROJECT_ROOT / "sum"
if SUM_DIR.exists():
    sys.path.append(str(SUM_DIR))


@lru_cache(maxsize=1)
def _get_summarizer():
    """
    Always use the DeepSeek-backed summarizer (via the OpenAI-compatible SDK).
    Requires the openai package installed and DEEPSEEK_API_KEY set.
    """
    try:
        from legal_summarizer import LegalSummarizer
        return LegalSummarizer()
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Summarizer dependency missing (install openai SDK): {exc}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to initialize summarizer: {exc}")


def summarize_document(local_db: Session, document_id: int, short: bool = False) -> dict:
    """
    Summarize the OCR text of a document.
    
    Documents are stored in Local PostgreSQL only.
    """
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    text = (document.ocr_text or "").strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Document has no OCR text. Extract text first, then retry summarization.",
        )

    try:
        summarizer = _get_summarizer()
        summary = summarizer.summarize(text, short=short)
        return {
            "document_id": document.id,
            "summary": summary,
            "short": short,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {exc}")

