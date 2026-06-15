"""
Evidence Model for storing evidence paragraphs retrieved from documents
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from datetime import datetime
from app.database.database_main import Base


class Evidence(Base):
    """
    Evidence paragraphs retrieved from documents to support/verify claims.
    """
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=True, index=True)  # Optional - can be general evidence
    paragraph_text = Column(Text, nullable=False)  # The actual evidence text
    position_start = Column(Integer, nullable=True)  # Character position in source document (if available)
    position_end = Column(Integer, nullable=True)  # End position
    relevance_score = Column(Float, nullable=True)  # Similarity/relevance score from retrieval (0.0-1.0)
    source_citation_id = Column(Integer, ForeignKey("citations.id"), nullable=True, index=True)  # Related citation if any
    source_document_filename = Column(String, nullable=True)  # Source document filename (for dataset documents)
    source_index_name = Column(String, nullable=True)  # Which FAISS index this came from
    source_chunk_index = Column(Integer, nullable=True)  # Chunk index in source document
    retrieval_rank = Column(Integer, nullable=True)  # Rank in retrieval results (1 = most relevant)
    created_at = Column(DateTime, default=datetime.utcnow)

