"""
Chat Router for ADAL Backend

Endpoints:
  POST   /api/chat/send                           - Send a message (core endpoint)
  POST   /api/chat/conversations                  - Start a new conversation
  GET    /api/chat/conversations                  - List user's conversations
  GET    /api/chat/conversations/{id}             - Get a single conversation
  PUT    /api/chat/conversations/{id}/title       - Rename a conversation
  DELETE /api/chat/conversations/{id}             - Delete a conversation + messages
  GET    /api/chat/conversations/{id}/messages    - Load message history
"""

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.auth_dependencies import get_current_user, require_auth
from app.database.database_manager import get_local_db
from app.models.user_model import User
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["Chat"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class SendMessageRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None   # None = start a new conversation


class SendMessageResponse(BaseModel):
    conversation_id: int
    message_id: int
    response: str
    role: str
    metadata: Optional[dict] = None


class CreateConversationRequest(BaseModel):
    title: Optional[str] = None


class UpdateTitleRequest(BaseModel):
    title: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_user_id(request: Request, db: Session) -> int:
    """
    Resolve the current user's ID from the Bearer token.
    Falls back gracefully when AUTH_REQUIRED=false (dev mode) — uses user_id=1.
    """
    try:
        user: User = get_current_user(request, db)
        return user.id
    except Exception:
        return 1


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/send", response_model=SendMessageResponse)
def send_message(
    body: SendMessageRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """
    Send a message and get an AI response from DeepSeek.
    Omit conversation_id to start a new conversation automatically.
    """
    user_id = _resolve_user_id(request, db)
    result = chat_service.send_message(
        db=db,
        user_id=user_id,
        content=body.message,
        conversation_id=body.conversation_id,
    )
    return SendMessageResponse(**result)


@router.post("/conversations")
def create_conversation(
    body: CreateConversationRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """Create a blank conversation (optional — /send creates one automatically)."""
    user_id = _resolve_user_id(request, db)
    c = chat_service.create_conversation(db=db, user_id=user_id, title=body.title)
    return {
        "id": c.id,
        "title": c.title,
        "model_used": c.model_used,
        "total_messages": c.total_messages,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.get("/conversations")
def list_conversations(
    request: Request,
    limit: int = 20,
    offset: int = 0,
    case_id: Optional[int] = None,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """Return the user's conversation list, optionally filtered by case, newest first."""
    user_id = _resolve_user_id(request, db)
    conversations = chat_service.get_user_conversations(
        db=db, user_id=user_id, limit=limit, offset=offset, case_id=case_id
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "model_used": c.model_used,
            "total_messages": c.total_messages,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """Get a single conversation by ID."""
    user_id = _resolve_user_id(request, db)
    c = chat_service.get_conversation(db=db, conversation_id=conversation_id, user_id=user_id)
    return {
        "id": c.id,
        "title": c.title,
        "model_used": c.model_used,
        "total_messages": c.total_messages,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


@router.put("/conversations/{conversation_id}/title")
def update_title(
    conversation_id: int,
    body: UpdateTitleRequest,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """Rename a conversation."""
    user_id = _resolve_user_id(request, db)
    c = chat_service.update_conversation_title(
        db=db, conversation_id=conversation_id, user_id=user_id, title=body.title
    )
    return {"id": c.id, "title": c.title, "updated_at": c.updated_at}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """Delete a conversation and all its messages."""
    user_id = _resolve_user_id(request, db)
    chat_service.delete_conversation(db=db, conversation_id=conversation_id, user_id=user_id)
    return {"message": "Conversation deleted successfully."}


@router.get("/conversations/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    request: Request,
    limit: int = 50,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth),
):
    """
    Return message history for a conversation in chronological order.
    Used to restore a chat when a user re-opens it.
    """
    user_id = _resolve_user_id(request, db)
    messages = chat_service.get_conversation_messages(
        db=db, conversation_id=conversation_id, user_id=user_id, limit=limit
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "metadata": m.msg_metadata,   # renamed column
            "created_at": m.created_at,
        }
        for m in messages
    ]
