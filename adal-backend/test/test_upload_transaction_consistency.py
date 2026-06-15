import asyncio
import uuid

from fastapi import HTTPException

from app.services import file_service


class _FakeQuery:
    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return None


class _FakeLocalDB:
    def __init__(self):
        self.commit_called = 0
        self.rollback_called = 0
        self.document = None

    def query(self, *_args, **_kwargs):
        return _FakeQuery()

    def add(self, obj):
        self.document = obj

    def flush(self):
        if self.document.id is None:
            self.document.id = 1
        if self.document.local_document_uuid is None:
            self.document.local_document_uuid = uuid.uuid4()

    def commit(self):
        self.commit_called += 1

    def rollback(self):
        self.rollback_called += 1

    def refresh(self, _obj):
        pass


class _FakeSupabaseDB:
    def __init__(self):
        self.rollback_called = 0

    def rollback(self):
        self.rollback_called += 1


class _FakeUploadFile:
    def __init__(self, filename: str, content: bytes, content_type: str = "text/plain"):
        self.filename = filename
        self._content = content
        self.content_type = content_type

    async def read(self):
        return self._content


def test_upload_metadata_failure_rolls_back_and_cleans_temp(monkeypatch):
    local_db = _FakeLocalDB()
    supabase_db = _FakeSupabaseDB()

    async def _run():
        upload = _FakeUploadFile(filename="contract.txt", content=b"hello world")

        before = set(file_service.UPLOAD_DIR.glob(".tmp_*_contract.txt"))

        def _fail_create_metadata(*_args, **_kwargs):
            raise RuntimeError("metadata insert failed")

        monkeypatch.setattr(file_service, "create_supabase_document_metadata", _fail_create_metadata)

        try:
            await file_service.upload_file(
                file=upload,
                local_db=local_db,
                supabase_db=supabase_db,
                user_id="11111111-1111-1111-1111-111111111111",
            )
            assert False, "Expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 502

        after = set(file_service.UPLOAD_DIR.glob(".tmp_*_contract.txt"))
        assert after == before

    asyncio.run(asyncio.wait_for(_run(), timeout=10))

    assert local_db.commit_called == 0
    assert local_db.rollback_called >= 1
    assert supabase_db.rollback_called >= 1
