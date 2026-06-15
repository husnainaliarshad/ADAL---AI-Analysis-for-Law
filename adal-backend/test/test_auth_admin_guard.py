from fastapi import HTTPException
from starlette.requests import Request

from app.core.auth_dependencies import require_admin


def _build_request(headers=None):
    headers = headers or []
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/admin/documents",
        "headers": headers,
    }
    return Request(scope)


def test_admin_guard_requires_valid_admin_key(monkeypatch):
    monkeypatch.setenv("ADMIN_AUTH_REQUIRED", "true")
    monkeypatch.setenv("ADMIN_API_KEY", "expected-key")

    for request in (
        _build_request(),
        _build_request(headers=[(b"x-admin-key", b"wrong-key")]),
    ):
        try:
            require_admin(request)
            assert False, "Expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 403

    ok_request = _build_request(headers=[(b"x-admin-key", b"expected-key")])
    assert require_admin(ok_request) is None
