"""
Verification Report Model
Stores verification results for claims and documents
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from app.database.database_main import Base


class VerificationReport(Base):
    """
    Verification report storing LLM reasoning results.
    """
    __tablename__ = "verification_reports"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True, index=True)  # Null if verifying entire document
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Optional: who requested verification
    
    # Report data (stored as JSONB for PostgreSQL)
    report_data = Column(JSONB, nullable=False)  # Full verification result
    
    # Status
    verification_status = Column(String, nullable=False, default="completed")  # completed, failed, pending
    
    # Metadata
    llm_provider = Column(String, nullable=True)  # Which LLM was used
    llm_model = Column(String, nullable=True)  # Which model was used
    evidence_count = Column(Integer, nullable=True)  # Number of evidence paragraphs used
    citations_count = Column(Integer, nullable=True)  # Number of citations referenced
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

