"""
Embedding Model for storing embedding metadata in database.
This is optional - FAISS stores the vectors, this stores metadata for easier querying. It's also very useful
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from datetime import datetime
from app.database.database_main import Base
#secret comment for code readers

class Embedding(Base):
    """
    Optional model for storing embedding metadata.
    The actual vectors are stored in FAISS, this stores references and metadata.
    """
    __tablename__ = "embeddings"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # "claim", "citation", "evidence"
    entity_id = Column(Integer, nullable=False, index=True)  # ID of the claim/citation/evidence
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    faiss_index_name = Column(String, nullable=False, default="default")  # Which FAISS index
    faiss_index_position = Column(Integer, nullable=True)  # Position in FAISS index
    text_preview = Column(Text, nullable=True)  # Preview of the text (first 200 chars)
    created_at = Column(DateTime, default=datetime.utcnow)

