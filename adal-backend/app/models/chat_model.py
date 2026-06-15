from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from datetime import datetime
from app.database.database_main import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    title = Column(String, nullable=True)
    model_used = Column(String, nullable=True)
    total_messages = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_conversations_user_created', 'user_id', 'created_at'),
        Index('idx_conversations_updated_desc', 'updated_at'),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String, nullable=False, index=True)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    msg_metadata = Column(Text, nullable=True)  # renamed: 'metadata' is reserved by SQLAlchemy
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_messages_conversation_created', 'conversation_id', 'created_at'),
        Index('idx_messages_conversation_role', 'conversation_id', 'role'),
    )
