import asyncio

from fastapi import HTTPException

from app.routes import citation_router


def test_citation_extraction_error_is_sanitized(monkeypatch):
    def _raise_error(*_args, **_kwargs):
        raise RuntimeError("internal traceback details")

    monkeypatch.setattr(citation_router, "extract_citations_from_document", _raise_error)

    try:
        asyncio.run(
            citation_router.extract_citations(
                document_id=10,
                local_db=object(),
                supabase_db=None,
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 500
        assert exc.detail == "Failed to extract citations"
        assert "traceback" not in exc.detail.lower()
