import json
from pathlib import Path

from fastapi import HTTPException

from app.services import file_service


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result


class _FakeDB:
    def __init__(self, document):
        self._document = document
        self.rollback_called = 0

    def query(self, *_args, **_kwargs):
        return _FakeQuery(self._document)

    def rollback(self):
        self.rollback_called += 1

    def commit(self):
        pass

    def refresh(self, _obj):
        pass


def test_extract_and_save_text_rollback_uses_local_db(monkeypatch):
    filename = "rollback_test.txt"
    upload_path = file_service.UPLOAD_DIR / filename
    upload_path.write_text("dummy", encoding="utf-8")

    document = type("Doc", (), {"id": 1, "filename": filename, "path": "/data/uploads/rollback_test.txt", "created_at": None, "ocr_text": None})()
    fake_db = _FakeDB(document)

    def _raise_json_error(_path: Path):
        raise json.JSONDecodeError("bad json", "{}", 1)

    monkeypatch.setattr(file_service, "_extract_text_from_file", _raise_json_error)

    try:
        try:
            file_service.extract_and_save_text(fake_db, 1, filename)
            assert False, "Expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 400
            assert "Invalid JSON file" in exc.detail
        assert fake_db.rollback_called == 1
    finally:
        if upload_path.exists():
            upload_path.unlink()
