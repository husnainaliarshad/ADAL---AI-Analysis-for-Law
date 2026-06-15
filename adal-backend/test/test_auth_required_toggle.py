from fastapi import HTTPException
from starlette.requests import Request

from app.core import auth_dependencies


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _FakeDB:
    def __init__(self, user):
        self._user = user

    def query(self, *_args, **_kwargs):
        return _FakeQuery(self._user)


def _request_with_auth(token: str | None = None):
    headers = []
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode("utf-8")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/files",
        "headers": headers,
    }
    return Request(scope)


def test_auth_dependency_toggle(monkeypatch):
    fake_user = type("UserObj", (), {"email": "user@example.com"})()
    fake_db = _FakeDB(fake_user)

    monkeypatch.setenv("AUTH_REQUIRED", "false")
    assert auth_dependencies.require_auth(_request_with_auth(), fake_db) is None

    monkeypatch.setenv("AUTH_REQUIRED", "true")
    try:
        auth_dependencies.require_auth(_request_with_auth(), fake_db)
        assert False, "Expected HTTPException when token is missing"
    except HTTPException as exc:
        assert exc.status_code == 401

    monkeypatch.setattr(auth_dependencies, "verify_token", lambda _token: {"sub": "user@example.com"})
    result = auth_dependencies.require_auth(_request_with_auth("token123"), fake_db)
    assert result is fake_user
