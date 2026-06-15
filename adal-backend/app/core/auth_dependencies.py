import os

from fastapi import Depends, HTTPException, Request, WebSocket, WebSocketException, status
from sqlalchemy.orm import Session

from app.core.security import verify_token
from app.database.database_manager import get_local_db
from app.models.user_model import User


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


def get_bearer_payload(request: Request) -> dict:
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = auth_header.split(" ", 1)[1].strip()
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


def get_websocket_bearer_payload(websocket: WebSocket) -> dict:
    auth_header = websocket.headers.get("authorization")
    token = None

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    else:
        token = (websocket.query_params.get("token") or "").strip() or None

    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")

    payload = verify_token(token)
    if not payload:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
    return payload


def get_current_user(
    request: Request,
    local_db: Session = Depends(get_local_db),
) -> User:
    payload = get_bearer_payload(request)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = local_db.query(User).filter(User.email == subject).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def require_auth(
    request: Request = None,
    websocket: WebSocket = None,
    local_db: Session = Depends(get_local_db),
):
    if not _env_flag("AUTH_REQUIRED", False):
        return None
    if request is not None:
        return get_current_user(request, local_db)
    if websocket is not None:
        return require_websocket_auth(websocket, local_db)
    raise HTTPException(status_code=401, detail="Authentication context unavailable")


def require_websocket_auth(
    websocket: WebSocket,
    local_db: Session,
):
    if not _env_flag("AUTH_REQUIRED", False):
        return None

    payload = get_websocket_bearer_payload(websocket)
    subject = payload.get("sub")
    if not subject:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token payload")

    user = local_db.query(User).filter(User.email == subject).first()
    if not user:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="User not found")
    return user


def require_admin(request: Request):
    if not _env_flag("ADMIN_AUTH_REQUIRED", True):
        return None

    admin_api_key = os.getenv("ADMIN_API_KEY", "").strip()
    if not admin_api_key:
        raise HTTPException(status_code=500, detail="ADMIN_API_KEY is not configured")

    request_key = request.headers.get("X-Admin-Key")
    if not request_key or request_key != admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    return None
