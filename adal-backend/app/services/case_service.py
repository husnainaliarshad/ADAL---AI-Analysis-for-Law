"""Case management service — CRUD operations for the Case model."""

from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.case_model import Case
from app.models.document_model import Document
from app.models.chat_model import Conversation
from app.models.draft_model import Draft


def create_case(
    db: Session,
    user_id: int,
    title: str,
    case_number: Optional[str] = None,
    case_type: str = "civil",
    description: Optional[str] = None,
) -> Case:
    case = Case(
        user_id=user_id,
        title=title,
        case_number=case_number,
        case_type=case_type,
        status="open",
        description=description,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def get_case(db: Session, case_id: int, user_id: int) -> Case:
    case = db.query(Case).filter(Case.id == case_id, Case.user_id == user_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


def list_cases(db: Session, user_id: int, status: Optional[str] = None) -> list[Case]:
    q = db.query(Case).filter(Case.user_id == user_id)
    if status:
        q = q.filter(Case.status == status)
    return q.order_by(Case.updated_at.desc()).all()


def update_case(
    db: Session,
    case_id: int,
    user_id: int,
    title: Optional[str] = None,
    case_number: Optional[str] = None,
    case_type: Optional[str] = None,
    status: Optional[str] = None,
    description: Optional[str] = None,
) -> Case:
    case = get_case(db, case_id, user_id)
    if title is not None:
        case.title = title
    if case_number is not None:
        case.case_number = case_number
    if case_type is not None:
        case.case_type = case_type
    if status is not None:
        case.status = status
    if description is not None:
        case.description = description
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    return case


def delete_case(db: Session, case_id: int, user_id: int) -> bool:
    case = get_case(db, case_id, user_id)
    # Unlink related records
    db.query(Document).filter(Document.case_id == case_id).update({Document.case_id: None})
    db.query(Conversation).filter(Conversation.case_id == case_id).update({Conversation.case_id: None})
    db.query(Draft).filter(Draft.case_id == case_id).update({Draft.case_id: None})
    db.delete(case)
    db.commit()
    return True


def link_document_to_case(db: Session, case_id: int, document_id: int, user_id: int) -> dict:
    get_case(db, case_id, user_id)
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.case_id = case_id
    db.commit()
    return {"document_id": doc.id, "case_id": case_id, "filename": doc.filename}


def link_conversation_to_case(db: Session, case_id: int, conversation_id: int, user_id: int) -> dict:
    get_case(db, case_id, user_id)
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.case_id = case_id
    db.commit()
    return {"conversation_id": conv.id, "case_id": case_id}


def get_case_context(db: Session, case_id: int, user_id: int) -> dict:
    """Return full case context for the frontend."""
    case = get_case(db, case_id, user_id)
    docs = db.query(Document).filter(Document.case_id == case_id).all()
    convs = db.query(Conversation).filter(Conversation.case_id == case_id, Conversation.user_id == user_id).all()
    drafts = db.query(Draft).filter(Draft.case_id == case_id).all()

    return {
        "case": {
            "id": case.id,
            "title": case.title,
            "case_number": case.case_number,
            "case_type": case.case_type,
            "status": case.status,
            "description": case.description,
            "created_at": case.created_at,
            "updated_at": case.updated_at,
        },
        "documents": [
            {"id": d.id, "filename": d.filename, "file_type": d.file_type}
            for d in docs
        ],
        "conversations": [
            {"id": c.id, "title": c.title, "total_messages": c.total_messages}
            for c in convs
        ],
        "drafts": [
            {"id": d.id, "title": d.title}
            for d in drafts
        ],
    }
