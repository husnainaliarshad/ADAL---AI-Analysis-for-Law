from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from datetime import datetime
from app.database.database_main import Base


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    claim_text = Column(Text, nullable=False)  # The actual claim text
    claim_type = Column(String, nullable=True)  # e.g., "criminal", "civil", "constitutional", "general"
    position_start = Column(Integer, nullable=False)  # Character position in document
    position_end = Column(Integer, nullable=False)  # End position
    confidence_score = Column(Float, nullable=True)  # Confidence score from InLegalBERT (0.0-1.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClaimCitationMapping(Base):
    __tablename__ = "claim_citation_mappings"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False, index=True)
    citation_id = Column(Integer, ForeignKey("citations.id"), nullable=False, index=True)
    relationship_type = Column(String, nullable=True)  # e.g., "supports", "contradicts", "references"
    confidence_score = Column(Float, nullable=True)  # Confidence in the mapping (0.0-1.0)
    created_at = Column(DateTime, default=datetime.utcnow)


