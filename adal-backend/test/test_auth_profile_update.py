import asyncio

from fastapi import HTTPException
from starlette.requests import Request

from app.models.auth_models import UpdateProfileRequest
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

    def refresh(self, _obj):
        pass

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
            "method": "PUT",
            "path": "/api/auth/profile",
            "headers": [(b"authorization", b"Bearer test-token")],
        }
    )


def test_profile_update_success_and_supabase_sync(monkeypatch):
    user = type(
        "UserObj",
        (),
        {
            "id": 1,
            "email": "old@example.com",
            "username": "olduser",
            "first_name": "Old",
            "last_name": "Name",
            "is_active": True,
            "created_at": None,
            "last_login_at": None,
            "supabase_user_id": "11111111-1111-1111-1111-111111111111",
        },
    )()
    local_db = _FakeLocalDB([user, None])
    supabase_db = _FakeSupabaseDB()
    payload = UpdateProfileRequest(email="new@example.com", first_name="New", last_name="User")

    monkeypatch.setattr(auth_service, "verify_token", lambda _token: {"sub": "old@example.com"})

    response = asyncio.run(
        auth_service.handle_update_profile(_request(), payload, local_db, supabase_db)
    )

    assert response["message"] == "Profile updated successfully"
    assert response["user"]["email"] == "new@example.com"
    assert local_db.commit_called == 1
    assert supabase_db.execute_called == 1


def test_profile_update_rejects_duplicate_email(monkeypatch):
    user = type(
        "UserObj",
        (),
        {
            "id": 1,
            "email": "old@example.com",
            "username": "olduser",
            "first_name": "Old",
            "last_name": "Name",
            "is_active": True,
            "created_at": None,
            "last_login_at": None,
            "supabase_user_id": None,
        },
    )()
    duplicate_user = object()
    local_db = _FakeLocalDB([user, duplicate_user])
    payload = UpdateProfileRequest(email="taken@example.com")

    monkeypatch.setattr(auth_service, "verify_token", lambda _token: {"sub": "old@example.com"})

    try:
        asyncio.run(auth_service.handle_update_profile(_request(), payload, local_db, None))
        assert False, "Expected duplicate email error"
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Email already in use"
