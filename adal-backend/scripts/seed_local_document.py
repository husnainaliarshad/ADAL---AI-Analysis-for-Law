"""
Quick helper to seed a Document row for a local file so citation/claim
extraction endpoints can be exercised in presentation/demo mode.

Usage (from backend repo root):
  python scripts/seed_local_document.py "C.A_supreme (1).txt"

Defaults to the local uploads path: data/uploads/<filename>
If a row already exists with that filename, it prints and exits.

Revert: delete the inserted row if no longer needed.
"""

import sys
from datetime import datetime
from pathlib import Path

from app.database.database_main import SessionLocal
from app.models.document_model import Document


def seed_document(filename: str, path_override: str | None = None) -> None:
    uploads_dir = Path(__file__).parent.parent / "data" / "uploads"
    file_path = Path(path_override) if path_override else uploads_dir / filename

    if not file_path.exists():
        print(f"[!] File not found on disk: {file_path}")
        return

    session = SessionLocal()
    try:
        existing = session.query(Document).filter(Document.filename == filename).first()
        if existing:
            print(f"[✓] Document already exists (id={existing.id}, filename={existing.filename})")
            return

        doc = Document(
            filename=filename,
            path=str(file_path),
            ocr_text=None,
            summary=None,
            created_at=datetime.utcnow(),
        )
        session.add(doc)
        session.commit()
        session.refresh(doc)
        print(f"[✓] Inserted document id={doc.id}, filename={doc.filename}")
    except Exception as e:
        session.rollback()
        print(f"[!] Failed to insert document: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_local_document.py <filename> [full_path_override]")
        sys.exit(1)

    filename = sys.argv[1]
    override = sys.argv[2] if len(sys.argv) > 2 else None
    seed_document(filename, override)

