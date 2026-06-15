import asyncio

from fastapi import HTTPException
from starlette.requests import Request

from app.models.auth_models import ChangePasswordRequest
from app.services import auth_service


class _FakeQuery:
    def __init__(self, db):
        self._db = db

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        if self._db.first_results:
            return self._db.first_results.pop(0)
        return None


class _FakeLocalDB:
    def __init__(self, first_results):
        self.first_results = list(first_results)
        self.commit_called = 0
        self.rollback_called = 0

    def query(self, *_args, **_kwargs):
        return _FakeQuery(self)

    def commit(self):
        self.commit_called += 1

    def rollback(self):
        self.rollback_called += 1


class _FakeSupabaseDB:
    def __init__(self):
        self.execute_called = 0
        self.commit_called = 0
        self.rollback_called = 0

    def execute(self, *_args, **_kwargs):
        self.execute_called += 1

    def commit(self):
        self.commit_called += 1

    def rollback(self):
        self.rollback_called += 1


def _request():
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/auth/change-password",
            "headers": [(b"authorization", b"Bearer token")],
        }
    )


def test_change_password_wrong_current_password(monkeypatch):
    user = type(
        "UserObj",
        (),
        {
            "email": "user@example.com",
            "password_hash": auth_service.hash_password("OldPassword123"),
            "supabase_user_id": None,
        },
    )()
    local_db = _FakeLocalDB([user])
    payload = ChangePasswordRequest(currentPassword="WrongPassword", newPassword="NewPassword123")

    monkeypatch.setattr(auth_service, "verify_token", lambda _token: {"sub": "user@example.com"})

    try:
        asyncio.run(auth_service.handle_change_password(_request(), payload, local_db, None))
        assert False, "Expected current password validation error"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "Current password is incorrect" in exc.detail


def test_change_password_rejects_weak_new_password(monkeypatch):
    user = type(
        "UserObj",
        (),
        {
            "email": "user@example.com",
            "password_hash": auth_service.hash_password("OldPassword123"),
            "supabase_user_id": None,
        },
    )()
    local_db = _FakeLocalDB([user])
    payload = ChangePasswordRequest(currentPassword="OldPassword123", newPassword="short")

    monkeypatch.setattr(auth_service, "verify_token", lambda _token: {"sub": "user@example.com"})

    try:
        asyncio.run(auth_service.handle_change_password(_request(), payload, local_db, None))
        assert False, "Expected weak password validation error"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "at least 8 characters" in exc.detail


def test_change_password_success_local_and_supabase(monkeypatch):
    old_hash = auth_service.hash_password("OldPassword123")
    user = type(
        "UserObj",
        (),
        {
            "email": "user@example.com",
            "password_hash": old_hash,
            "supabase_user_id": "11111111-1111-1111-1111-111111111111",
        },
    )()
    local_db = _FakeLocalDB([user])
    supabase_db = _FakeSupabaseDB()
    payload = ChangePasswordRequest(currentPassword="OldPassword123", newPassword="NewPassword123")

    monkeypatch.setattr(auth_service, "verify_token", lambda _token: {"sub": "user@example.com"})

    response = asyncio.run(
        auth_service.handle_change_password(_request(), payload, local_db, supabase_db)
    )

    assert response["message"] == "Password changed successfully"
    assert local_db.commit_called == 1
    assert supabase_db.execute_called == 1
    assert user.password_hash != old_hash
