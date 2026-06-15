from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.database_main import Base

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("DocumentVersion", back_populates="draft", cascade="all, delete")
    messages = relationship("DraftChatMessage", back_populates="draft", cascade="all, delete")

class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    content_html = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    draft = relationship("Draft", back_populates="versions")

class DraftChatMessage(Base):
    __tablename__ = "draft_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    draft = relationship("Draft", back_populates="messages")
