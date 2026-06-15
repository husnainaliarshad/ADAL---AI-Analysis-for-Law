import asyncio
import importlib
import sys
import types


def _import_claim_router_with_stubbed_service():
    module_name = "app.services.claim_service"
    if module_name not in sys.modules:
        stub = types.ModuleType(module_name)
        stub.segment_claims_with_citations = lambda *_args, **_kwargs: []
        stub.get_all_claims = lambda *_args, **_kwargs: []
        stub.get_claims_by_document = lambda *_args, **_kwargs: []
        stub.get_claim_by_id = lambda *_args, **_kwargs: None
        stub.delete_claims_by_document = lambda *_args, **_kwargs: 0
        stub.get_claim_citation_mappings = lambda *_args, **_kwargs: []
        sys.modules[module_name] = stub
    return importlib.import_module("app.routes.claim_router")


def test_segment_claims_body_precedence_over_query(monkeypatch):
    claim_router = _import_claim_router_with_stubbed_service()
    captured = {}

    def _fake_segment(local_db, document_id, use_citation_guidance):
        captured["use_citation_guidance"] = use_citation_guidance
        return []

    monkeypatch.setattr(claim_router, "segment_claims_with_citations", _fake_segment)

    response = asyncio.run(
        claim_router.segment_claims(
            document_id=1,
            payload=claim_router.SegmentClaimsRequest(use_citation_guidance=False),
            use_citation_guidance=True,
            local_db=object(),
        )
    )

    assert response.document_id == 1
    assert captured["use_citation_guidance"] is False


def test_segment_claims_query_fallback_when_body_absent(monkeypatch):
    claim_router = _import_claim_router_with_stubbed_service()
    captured = {}

    def _fake_segment(local_db, document_id, use_citation_guidance):
        captured["use_citation_guidance"] = use_citation_guidance
        return []

    monkeypatch.setattr(claim_router, "segment_claims_with_citations", _fake_segment)

    asyncio.run(
        claim_router.segment_claims(
            document_id=2,
            payload=None,
            use_citation_guidance=False,
            local_db=object(),
        )
    )

    assert captured["use_citation_guidance"] is False
