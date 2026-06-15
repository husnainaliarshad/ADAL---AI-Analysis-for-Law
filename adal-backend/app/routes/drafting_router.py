from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List, Dict
from bs4 import BeautifulSoup
import traceback
from datetime import datetime
from sqlalchemy.orm import Session

from app.database.database_manager import get_local_db
from app.core.auth_dependencies import get_current_user, require_auth
from app.models.user_model import User
from app.models.draft_model import Draft, DocumentVersion, DraftChatMessage
from app.models.template_model import Template
from app.services.drafting_service import DraftingAgent

router = APIRouter()

# Initialize the agent once
drafting_agent = DraftingAgent()


def _build_version_preview(content_html: str, limit: int = 160) -> str:
    text = BeautifulSoup(content_html or "", "html.parser").get_text(" ", strip=True)
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."

class DraftingRequest(BaseModel):
    title: str
    content_html: str
    content_text: Optional[str] = None
    draft_id: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    document_context: str
    draft_id: Optional[str] = None

class RenameRequest(BaseModel):
    title: str

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

@router.post("/process")
async def process_draft(
    request: DraftingRequest, 
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        return drafting_agent.process_document(request.title, request.content_html, request.content_text, request.draft_id, db, user_id)
    except Exception as e:
        print(f"Drafting Router Process Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
async def chat_draft(
    request: ChatRequest, 
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    user_id = _resolve_user_id(http_request, db)
    
    if not request.document_context or not request.document_context.strip():
        return {
            "reply": "<p>I can't see your document. Please ensure there is text in the editor.</p>",
            "sources": []
        }
        
    try:
        # Save user message if draft_id provided
        if request.draft_id:
            try:
                msg = DraftChatMessage(
                    draft_id=int(request.draft_id),
                    role="user",
                    content=request.message
                )
                db.add(msg)
                db.commit()
            except Exception as e:
                print(f"Error saving user chat message: {e}")

        # Invoke LangGraph agent
        try:
            result = drafting_agent.app.invoke({
                "message": request.message,
                "document_context": request.document_context,
                "user_id": user_id,
                "intent_analysis": "",
                "delivery_mode": "editor",
                "routing_reason": "",
                "retrieved_clauses": [],
                "drafted_content": "",
                "assistant_reply": "",
                "metadata": []
            })
        except Exception as agent_err:
            print(f"Agent Invoke Error: {agent_err}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"AI Assistant Error: {str(agent_err)}")
        
        delivery_mode = result.get("delivery_mode", "editor")
        raw_html = result.get("drafted_content", "")
        clean_html = ""
        if delivery_mode == "editor" and raw_html:
            # Verify HTML safety using BeautifulSoup
            soup = BeautifulSoup(raw_html, "html.parser")
            clean_html = str(soup)  # BeautifulSoup automatically fixes missing tags and unclosed tags

        metadata = result.get("metadata", [])
        ui_reply = (
            result.get("assistant_reply")
            or (
                "I prepared a drafting proposal for the editor."
                if clean_html
                else "I couldn't complete that drafting request."
            )
        )
        
        # Save assistant reply if draft_id provided
        if request.draft_id:
            try:
                reply_msg = DraftChatMessage(
                    draft_id=int(request.draft_id),
                    role="assistant",
                    content=ui_reply
                )
                db.add(reply_msg)
                db.commit()
            except Exception as e:
                print(f"Error saving assistant chat message: {e}")
        
        return {
            "reply": ui_reply,
            "delivery_mode": delivery_mode,
            "routing_reason": result.get("routing_reason", ""),
            "html_to_insert": clean_html,
            "sources": metadata
        }
    except Exception as e:
        error_detail = "".join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"Drafting Router Final Error:\n{error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/history/{draft_id}/messages")
async def get_draft_messages(
    draft_id: str,
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        draft_id_int = int(draft_id)
        
        # Verify ownership
        draft = db.query(Draft).filter(Draft.id == draft_id_int, Draft.user_id == user_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
            
        messages = db.query(DraftChatMessage).filter(DraftChatMessage.draft_id == draft_id_int).order_by(DraftChatMessage.created_at.asc()).all()
        
        return [
            {
                "id": m.id,
                "type": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    except Exception as e:
        print(f"Drafting Router Get Messages Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_draft_history(
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        drafts = db.query(Draft).filter(Draft.user_id == user_id).order_by(Draft.updated_at.desc()).all()
        return [
            {
                "id": str(d.id),
                "title": d.title,
                "updated_at": d.updated_at.isoformat()
            }
            for d in drafts
        ]
    except Exception as e:
        print(f"Drafting Router History Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{draft_id}")
async def get_draft_content(
    draft_id: str,
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        draft_id_int = int(draft_id)
        draft = db.query(Draft).filter(Draft.id == draft_id_int, Draft.user_id == user_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
            
        last_version = db.query(DocumentVersion).filter(DocumentVersion.draft_id == draft_id_int).order_by(DocumentVersion.version_number.desc()).first()
        return {
            "id": str(draft.id),
            "title": draft.title,
            "content_html": last_version.content_html if last_version else ""
        }
    except Exception as e:
        print(f"Drafting Router Single Draft Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{draft_id}/versions")
async def get_draft_versions(
    draft_id: str,
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        draft_id_int = int(draft_id)
        draft = db.query(Draft).filter(Draft.id == draft_id_int, Draft.user_id == user_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        versions = (
            db.query(DocumentVersion)
            .filter(DocumentVersion.draft_id == draft_id_int)
            .order_by(DocumentVersion.version_number.desc())
            .all()
        )

        latest_version_id = versions[0].id if versions else None

        return [
            {
                "id": str(version.id),
                "version_number": version.version_number,
                "created_at": version.created_at.isoformat(),
                "preview": _build_version_preview(version.content_html),
                "is_latest": version.id == latest_version_id,
            }
            for version in versions
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Drafting Router Versions Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history/{draft_id}/restore/{version_id}")
async def restore_draft_version(
    draft_id: str,
    version_id: str,
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        draft_id_int = int(draft_id)
        version_id_int = int(version_id)

        draft = db.query(Draft).filter(Draft.id == draft_id_int, Draft.user_id == user_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")

        source_version = (
            db.query(DocumentVersion)
            .filter(
                DocumentVersion.id == version_id_int,
                DocumentVersion.draft_id == draft_id_int,
            )
            .first()
        )
        if not source_version:
            raise HTTPException(status_code=404, detail="Draft version not found")

        last_version = (
            db.query(DocumentVersion)
            .filter(DocumentVersion.draft_id == draft_id_int)
            .order_by(DocumentVersion.version_number.desc())
            .first()
        )
        next_version_number = (last_version.version_number + 1) if last_version else 1

        restored_version = DocumentVersion(
            draft_id=draft.id,
            version_number=next_version_number,
            content_html=source_version.content_html,
        )
        db.add(restored_version)
        draft.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(restored_version)

        return {
            "status": "success",
            "message": "Draft version restored successfully",
            "draft_id": str(draft.id),
            "title": draft.title,
            "content_html": restored_version.content_html,
            "restored_from_version_id": str(source_version.id),
            "restored_from_version_number": source_version.version_number,
            "current_version_id": str(restored_version.id),
            "current_version_number": restored_version.version_number,
            "created_at": restored_version.created_at.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Drafting Router Restore Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/history/{draft_id}")
async def rename_draft(
    draft_id: str,
    request: RenameRequest,
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        draft_id_int = int(draft_id)
        draft = db.query(Draft).filter(Draft.id == draft_id_int, Draft.user_id == user_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        draft.title = request.title
        db.commit()
        return {"status": "success", "message": "Draft renamed successfully"}
    except Exception as e:
        print(f"Drafting Router Rename Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history/{draft_id}")
async def delete_draft(
    draft_id: str,
    http_request: Request,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        user_id = _resolve_user_id(http_request, db)
        draft_id_int = int(draft_id)
        
        # Verify ownership
        draft = db.query(Draft).filter(Draft.id == draft_id_int, Draft.user_id == user_id).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        db.delete(draft)
        db.commit()
        
        return {"status": "success", "message": "Draft deleted successfully"}
    except Exception as e:
        print(f"Drafting Router Delete Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates")
async def get_templates(
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        templates = db.query(Template).order_by(Template.title.asc()).all()
        return [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description
            }
            for t in templates
        ]
    except Exception as e:
        print(f"Drafting Router Templates Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates/{template_id}")
async def get_template_content(
    template_id: str,
    db: Session = Depends(get_local_db),
    _auth=Depends(require_auth)
):
    try:
        template = db.query(Template).filter(Template.id == int(template_id)).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {
            "id": str(template.id),
            "title": template.title,
            "description": template.description,
            "content_html": template.content_html
        }
    except Exception as e:
        print(f"Drafting Router Single Template Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
