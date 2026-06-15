"""Case Router — CRUD endpoints for cases, plus the unified agent endpoint."""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_user, require_auth
from app.database.database_manager import get_local_db
from app.models.user_model import User
from app.services import case_service, case_agent_service

router = APIRouter(prefix="/cases", tags=["Cases"])


def _resolve_user_id(request: Request, db: Session) -> int:
    try:
        user: User = get_current_user(request, db)
        return user.id
    except Exception:
        return 1


# ── Schemas ──
class CreateCaseRequest(BaseModel):
    title: str
    case_number: Optional[str] = None
    case_type: str = "civil"
    description: Optional[str] = None


class UpdateCaseRequest(BaseModel):
    title: Optional[str] = None
    case_number: Optional[str] = None
    case_type: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None


class LinkDocumentRequest(BaseModel):
    document_id: int


class LinkConversationRequest(BaseModel):
    conversation_id: int


class SendCaseMessageRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    case_id: int


# ── Case CRUD ──
@router.post("")
def create_case(
    body: CreateCaseRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    c = case_service.create_case(
        db, user_id, body.title, body.case_number, body.case_type, body.description
    )
    return {
        "id": c.id, "title": c.title, "case_number": c.case_number,
        "case_type": c.case_type, "status": c.status,
        "created_at": c.created_at, "updated_at": c.updated_at,
    }


@router.get("")
def list_cases(
    request: Request,
    status: Optional[str] = None,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    cases = case_service.list_cases(db, user_id, status)
    return [
        {
            "id": c.id, "title": c.title, "case_number": c.case_number,
            "case_type": c.case_type, "status": c.status,
            "created_at": c.created_at, "updated_at": c.updated_at,
        }
        for c in cases
    ]


@router.get("/{case_id}")
def get_case(
    case_id: int,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    return case_service.get_case_context(db, case_id, user_id)


@router.put("/{case_id}")
def update_case(
    case_id: int,
    body: UpdateCaseRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    c = case_service.update_case(
        db, case_id, user_id, body.title, body.case_number,
        body.case_type, body.status, body.description,
    )
    return {"id": c.id, "title": c.title, "status": c.status, "updated_at": c.updated_at}


@router.delete("/{case_id}")
def delete_case(
    case_id: int,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    case_service.delete_case(db, case_id, user_id)
    return {"message": "Case deleted"}


@router.post("/{case_id}/documents")
def link_document(
    case_id: int,
    body: LinkDocumentRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    return case_service.link_document_to_case(db, case_id, body.document_id, user_id)


@router.post("/{case_id}/conversations")
def link_conversation(
    case_id: int,
    body: LinkConversationRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    user_id = _resolve_user_id(request, db)
    return case_service.link_conversation_to_case(db, case_id, body.conversation_id, user_id)


# ── Unified Agent Endpoint ──
class CaseAgentResponse(BaseModel):
    conversation_id: int
    message_id: int
    response: str
    role: str
    metadata: Optional[dict] = None


@router.post("/agent/send", response_model=CaseAgentResponse)
def send_case_agent_message(
    body: SendCaseMessageRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """Send a message through the unified case-aware agent."""
    user_id = _resolve_user_id(request, db)
    result = case_agent_service.send_case_message(
        db=db,
        user_id=user_id,
        content=body.message,
        conversation_id=body.conversation_id,
        case_id=body.case_id,
    )
    return CaseAgentResponse(**result)
