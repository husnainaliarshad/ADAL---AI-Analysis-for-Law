from fastapi import HTTPException

from app.services.auth_service import register_user


class _FakeQuery:
    def __init__(self, first_result=None):
        self._first_result = first_result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._first_result


class _FakeLocalDB:
    def __init__(self):
        self.rollback_called = 0
        self.commit_called = 0
        self.flush_called = 0

    def query(self, *_args, **_kwargs):
        return _FakeQuery(first_result=None)

    def add(self, _obj):
        pass

    def flush(self):
        self.flush_called += 1

    def rollback(self):
        self.rollback_called += 1

    def commit(self):
        self.commit_called += 1

    def refresh(self, _obj):
        pass


class _FailingSupabaseDB:
    def __init__(self):
        self.rollback_called = 0

    def execute(self, *_args, **_kwargs):
        raise RuntimeError("supabase insert failed")

    def commit(self):
        pass

    def rollback(self):
        self.rollback_called += 1


def test_register_rolls_back_local_when_supabase_insert_fails():
    local_db = _FakeLocalDB()
    supabase_db = _FailingSupabaseDB()

    try:
        register_user(
            local_db=local_db,
            username="newuser",
            email="new@example.com",
            password="Password123",
            supabase_db=supabase_db,
            first_name="New",
            last_name="User",
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 502

    assert local_db.flush_called == 1
    assert local_db.commit_called == 0
    assert local_db.rollback_called == 1
    assert supabase_db.rollback_called == 1
