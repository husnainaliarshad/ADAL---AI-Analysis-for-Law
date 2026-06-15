import json
import os
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.document_model import Document


CASE_FACTS_KEYS = {
    "case_overview": "",
    "parties": [],
    "court_or_forum": "",
    "important_dates": [],
    "events_timeline": [],
    "legal_issues": [],
    "important_facts": [],
    "relief_sought": [],
    "citations_or_statutes": [],
    "missing_information": [],
}


def _extract_json_object(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text or "", re.DOTALL)
    if not match:
        raise ValueError("LLM response did not contain a JSON object")
    return json.loads(match.group(0))


def _normalize_list(value: Any) -> list[Any]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    return [value]


def _normalize_case_facts(raw: dict[str, Any]) -> dict[str, Any]:
    normalized = {}
    for key, default in CASE_FACTS_KEYS.items():
        value = raw.get(key, default)
        normalized[key] = _normalize_list(value) if isinstance(default, list) else (value or "")
    return normalized


def _build_case_facts_prompt(document_text: str) -> str:
    clipped_text = document_text[:28000]
    return f"""Extract structured case facts from this Pakistani legal document.

Return JSON only. Do not include markdown, commentary, or legal advice.

Use this exact JSON shape:
{{
  "case_overview": "2-4 neutral sentences explaining what the matter is about",
  "parties": [
    {{"name": "party name", "role": "petitioner/plaintiff/appellant/respondent/defendant/other", "details": "brief details if available"}}
  ],
  "court_or_forum": "court, tribunal, police station, or forum if available",
  "important_dates": [
    {{"date": "date as written", "event": "what happened"}}
  ],
  "events_timeline": [
    {{"sequence": 1, "event": "chronological factual event", "source_hint": "short phrase from the document"}}
  ],
  "legal_issues": [
    "specific legal issue or question raised by the facts"
  ],
  "important_facts": [
    "material fact that affects the legal analysis"
  ],
  "relief_sought": [
    "order, remedy, bail, damages, declaration, injunction, or other relief requested"
  ],
  "citations_or_statutes": [
    "case citation, statutory section, rule, or legal authority mentioned"
  ],
  "missing_information": [
    "important fact that appears missing, unclear, or not stated"
  ]
}}

Rules:
- Prefer facts actually present in the document.
- If a field is not available, use an empty string or empty array.
- Keep each item concise and professional.
- Do not invent parties, dates, statutes, or outcomes.

Document text:
{clipped_text}"""


def generate_case_facts(local_db: Session, document_id: int) -> dict[str, Any]:
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    text = (document.ocr_text or "").strip()
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Document has no OCR text. Extract text first, then retry case facts.",
        )

    api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("LLM_API_KEY")
    model = os.getenv("CASE_FACTS_MODEL") or os.getenv("LLM_MODEL_NAME", "deepseek-chat")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="LLM API key not configured. Set DEEPSEEK_API_KEY or LLM_API_KEY.",
        )

    try:
        import openai

        client = openai.OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract structured case facts from Pakistani legal documents. "
                        "You return strict JSON only."
                    ),
                },
                {"role": "user", "content": _build_case_facts_prompt(text)},
            ],
            temperature=0.2,
            max_tokens=2200,
        )
        content = response.choices[0].message.content.strip()
        facts = _normalize_case_facts(_extract_json_object(content))
        return {
            "document_id": document.id,
            "filename": document.filename,
            "case_facts": facts,
        }
    except HTTPException:
        raise
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"LLM dependency missing: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate case facts: {exc}")
