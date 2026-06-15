from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index, Text
from datetime import datetime
from app.database.database_main import Base


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    case_number = Column(String, nullable=True)
    case_type = Column(String, nullable=True, default="civil")  # criminal, civil, constitutional
    status = Column(String, nullable=False, default="open")  # open, closed, archived
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_cases_user_status", "user_id", "status"),
        Index("idx_cases_updated_desc", "updated_at"),
    )
