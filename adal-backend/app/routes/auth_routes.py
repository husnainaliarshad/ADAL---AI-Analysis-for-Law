from fastapi import APIRouter, HTTPException, Request, Depends
from app.models.auth_models import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RequestPasswordResetRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
)
from app.services.auth_service import (
    handle_login,
    handle_refresh,
    handle_profile,
    handle_update_profile,
    handle_change_password,
    handle_logout,
    register_user,
    handle_request_password_reset,
    handle_reset_password
)
from app.database.database_manager import get_local_db
from sqlalchemy.orm import Session
from typing import Optional

router = APIRouter()


def get_optional_supabase_db():
    """Yield Supabase session if configured, else None."""
    from app.database.database_manager import SupabaseSessionLocal
    if not SupabaseSessionLocal:
        yield None
        return
    db = SupabaseSessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register")
def register(
    data: RegisterRequest,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Register a new user.
    
    - Always stores in Local PostgreSQL.
    - If Supabase is configured, also creates a Supabase user and links supabase_user_id.
    """
    try:
        user = register_user(
            local_db, 
            data.username, 
            data.email, 
            data.password, 
            supabase_db,
            first_name=data.first_name,
            last_name=data.last_name
        )
        return {"message": "User registered successfully", "user_id": user.id, "supabase_user_id": str(user.supabase_user_id) if user.supabase_user_id else None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
async def login(
    data: LoginRequest, 
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    return await handle_login(local_db, data, supabase_db)


@router.post("/refresh")
async def refresh(data: RefreshRequest):
    return await handle_refresh(data)


@router.get("/profile")
async def profile(
    request: Request,
    local_db: Session = Depends(get_local_db)
):
    return await handle_profile(request, local_db)


@router.put("/profile")
async def update_profile(
    data: UpdateProfileRequest,
    request: Request,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    return await handle_update_profile(request, data, local_db, supabase_db)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    return await handle_change_password(request, data, local_db, supabase_db)


@router.post("/logout")
async def logout(
    request: Request,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Logout endpoint.
    
    Sets is_active = false in both Local PostgreSQL and Supabase databases
    to track user login status.
    """
    return await handle_logout(request, local_db, supabase_db)


@router.post("/request-password-reset")
async def request_password_reset(
    data: RequestPasswordResetRequest,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Request a password reset.
    
    Generates a secure reset token and stores it in Supabase.
    Returns success message regardless of whether email exists (prevents user enumeration).
    
    Note: In production, an email with the reset link should be sent to the user.
    """
    return await handle_request_password_reset(local_db, data, supabase_db)


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Reset password using token from email.
    
    Validates the reset token, checks expiry, and updates the password in both databases.
    """
    return await handle_reset_password(local_db, data, supabase_db)
