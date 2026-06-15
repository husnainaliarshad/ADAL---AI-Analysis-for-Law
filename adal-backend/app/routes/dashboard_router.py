from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.auth_dependencies import get_current_user, require_auth
from app.database.database_manager import get_local_db
from app.models.user_model import User
from app.services.dashboard_service import build_dashboard_overview, build_notifications_feed


router = APIRouter(tags=["Dashboard"], dependencies=[Depends(require_auth)])


def _resolve_user_id(request: Request, db: Session) -> int:
    try:
        user: User = get_current_user(request, db)
        return user.id
    except Exception:
        return 1


@router.get("/dashboard/overview")
async def route_dashboard_overview(
    request: Request,
    local_db: Session = Depends(get_local_db),
):
    user_id = _resolve_user_id(request, local_db)
    return build_dashboard_overview(local_db, user_id)


@router.get("/notifications")
async def route_notifications(
    request: Request,
    limit: int = Query(20, ge=1, le=50, description="Maximum notifications to return"),
    local_db: Session = Depends(get_local_db),
):
    user_id = _resolve_user_id(request, local_db)
    return build_notifications_feed(local_db, user_id, limit=limit)
