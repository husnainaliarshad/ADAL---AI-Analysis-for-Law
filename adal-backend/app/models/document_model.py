from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database.database_main import Base
import uuid

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    local_document_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    filename = Column(String, index=True)
    path = Column(String)
    ocr_text = Column(String, nullable=True)
    summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    supabase_document_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    __table_args__ = (
        Index('idx_created_at_desc', 'created_at'),
    )

    @property
    def file_type(self):
        if not self.filename:
            return None
        parts = self.filename.rsplit(".", 1)
        if len(parts) == 2 and parts[1]:
            return parts[1].lower()
        return None

    @property
    def file_size(self):
        try:
            from pathlib import Path
            base_dir = Path(__file__).parent.parent.parent / "data" / "uploads"
            file_path = base_dir / self.filename
            return file_path.stat().st_size if file_path.exists() else None
        except Exception:
            return None
