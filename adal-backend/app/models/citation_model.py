from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.database.database_main import Base
import uuid

class Citation(Base):
    __tablename__ = "citations"

    id = Column(Integer, primary_key=True, index=True)
    # Stable UUID for cross-database linking (Local → Supabase)
    local_citation_uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    citation_text = Column(Text, nullable=False)  # Full citation text
    citation_type = Column(String, nullable=False)  # e.g., "case", "statute", "regulation", "other"
    jurisdiction = Column(String, nullable=True)  # e.g., "US", "UK", "CA", "Federal"
    year = Column(Integer, nullable=True)  # Year from citation
    court = Column(String, nullable=True)  # Court name if applicable
    volume = Column(String, nullable=True)  # Volume number for cases
    reporter = Column(String, nullable=True)  # Reporter abbreviation
    page = Column(String, nullable=True)  # Page number
    position_start = Column(Integer, nullable=False)  # Character position in document
    position_end = Column(Integer, nullable=False)  # End position
    context = Column(Text, nullable=True)  # Surrounding text for context
    confidence_score = Column(String, nullable=True)  # Confidence in detection (high/medium/low)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Link to Supabase citation metadata
    supabase_citation_id = Column(UUID(as_uuid=True), nullable=True, index=True)
