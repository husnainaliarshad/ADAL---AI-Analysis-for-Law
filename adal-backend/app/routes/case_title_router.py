"""Endpoint to generate a case title from an uploaded document using DeepSeek."""

import os
import re
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth
from app.models.document_model import Document

router = APIRouter(prefix="/cases", tags=["Cases"])


class GenerateTitleRequest(BaseModel):
    document_id: int


@router.post("/generate-title")
def generate_case_title(body: GenerateTitleRequest, db: Session = Depends(get_local_db), _auth=Depends(require_auth)):
    """Generate a meaningful case title from a document's OCR text."""
    doc = db.query(Document).filter(Document.id == body.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    text = (doc.ocr_text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Document has no OCR text yet. Wait for extraction to complete.")

    api_key = os.getenv("DEEPSEEK_API_KEY")
    model = os.getenv("LLM_MODEL_NAME", "deepseek-chat")
    if not api_key:
        raise HTTPException(status_code=500, detail="DeepSeek API key not configured")

    # Take first 4000 chars for title generation
    snippet = text[:4000]

    prompt = f"""You are a Pakistani legal assistant. Given the OCR text from a legal document, generate a short, professional case title.

Rules:
- Return ONLY the title, no quotes, no markdown, no explanation
- Format: "Party A vs Party B — Matter" or "In re: Subject Matter"
- Keep it under 100 characters
- Use proper Pakistani legal terminology
- If parties are unclear, use the document type (e.g., "Application for Bail", "Civil Suit for Recovery")

OCR text excerpt:
{snippet}

Title:"""

    try:
        import openai
        client = openai.OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=60,
        )
        title = resp.choices[0].message.content.strip()
        title = re.sub(r'^["\']|["\']$', '', title)
        title = title[:100]
        return {"title": title, "document_id": body.document_id}
    except ImportError:
        raise HTTPException(status_code=500, detail="openai package not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Title generation failed: {e}")
