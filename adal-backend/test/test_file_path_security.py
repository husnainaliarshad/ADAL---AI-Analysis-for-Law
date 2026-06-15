from fastapi import HTTPException

from app.services.file_service import UPLOAD_DIR, resolve_upload_path, sanitize_filename


def test_sanitize_filename_rejects_traversal_names():
    for raw in ("../secret.txt", "..\\secret.txt", "nested/path.txt", "nested\\path.txt"):
        try:
            sanitize_filename(raw)
            assert False, f"Expected HTTPException for {raw}"
        except HTTPException as exc:
            assert exc.status_code == 400


def test_resolve_upload_path_stays_within_upload_dir():
    safe_name = sanitize_filename("evidence_file.pdf")
    resolved = resolve_upload_path(safe_name)
    assert resolved.parent == UPLOAD_DIR.resolve()
    assert resolved.name == safe_name
