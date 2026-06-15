from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.models.user_model import User
import bcrypt
import uuid
import secrets
from datetime import datetime, timedelta

def verify_password(plain_password, hashed_password):
    """Verify a password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def _get_authenticated_user_from_request(request: Request, local_db: Session) -> User:
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = auth_header.split(" ", 1)[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = local_db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def handle_login(local_db: Session, data, supabase_db: Session | None = None):
    """
    Handle user login.
    
    Users are stored in Local PostgreSQL. For enterprise features, 
    users can be linked to Supabase via supabase_user_id.
    
    Args:
        local_db: Database session
        data: LoginRequest with email, password, and optional remember flag
        supabase_db: Optional Supabase database session
    """
    user = local_db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update last login timestamp and set is_active = true in Local DB
    now = datetime.utcnow()
    user.last_login_at = now
    user.is_active = True
    local_db.commit()

    # Update last login timestamp and set is_active = true in Supabase if linked
    if supabase_db and user.supabase_user_id:
        try:
            supabase_db.execute(
                text(
                    """
                    UPDATE public.users
                    SET last_login_at = :last_login_at, 
                        is_active = true,
                        updated_at = :updated_at
                    WHERE id = :user_id
                    """
                ),
                {
                    "user_id": str(user.supabase_user_id),
                    "last_login_at": now,
                    "updated_at": now,
                },
            )
            supabase_db.commit()
        except Exception as e:
            # Log error but don't fail login if Supabase update fails
            print(f"Warning: Failed to update Supabase last_login_at and is_active: {e}")

    # Determine token expiry based on "remember me" option
    remember = getattr(data, 'remember', False)
    
    # If remember me is checked, extend access token to 7 days, otherwise use default (30 min)
    if remember:
        access_token_expiry = timedelta(days=7)
        access_token = create_access_token({"sub": user.email}, expires_delta=access_token_expiry)
    else:
        access_token = create_access_token({"sub": user.email})
    
    refresh_token = create_refresh_token({"sub": user.email}, remember=remember)

    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
    }


async def handle_refresh(data):
    if not data.refreshToken:
        raise HTTPException(status_code=400, detail="Missing refresh token")

    payload = verify_token(data.refreshToken)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    email = payload.get("sub")
    new_access = create_access_token({"sub": email})
    new_refresh = create_refresh_token({"sub": email})
    return {"accessToken": new_access, "refreshToken": new_refresh}


async def handle_profile(request: Request, local_db: Session):
    """
    Get current user's profile information.
    
    Args:
        request: FastAPI Request object to extract token
        local_db: Database session for Local PostgreSQL
    
    Returns:
        User profile data including id, username, email, first_name, last_name, etc.
    """
    user = _get_authenticated_user_from_request(request, local_db)

    # Return user profile data
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
    }


async def handle_update_profile(
    request: Request,
    data,
    local_db: Session,
    supabase_db: Session | None = None,
):
    """
    Update authenticated user's profile.

    Local DB is source of truth; Supabase is mirrored best-effort when linked.
    """
    user = _get_authenticated_user_from_request(request, local_db)
    fields_set = getattr(data, "model_fields_set", set())

    if "email" in fields_set:
        new_email = (data.email or "").strip().lower()
        if not new_email:
            raise HTTPException(status_code=400, detail="Email cannot be empty")

        existing_email = (
            local_db.query(User)
            .filter(User.email == new_email, User.id != user.id)
            .first()
        )
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = new_email

    if "username" in fields_set:
        new_username = (data.username or "").strip() or None
        if new_username:
            existing_username = (
                local_db.query(User)
                .filter(User.username == new_username, User.id != user.id)
                .first()
            )
            if existing_username:
                raise HTTPException(status_code=400, detail="Username already in use")
        user.username = new_username

    if "first_name" in fields_set:
        user.first_name = data.first_name
    if "last_name" in fields_set:
        user.last_name = data.last_name

    try:
        local_db.commit()
        local_db.refresh(user)
    except Exception as exc:
        local_db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {exc}") from exc

    if supabase_db and user.supabase_user_id:
        try:
            supabase_db.execute(
                text(
                    """
                    UPDATE public.users
                    SET username = :username,
                        email = :email,
                        first_name = :first_name,
                        last_name = :last_name,
                        updated_at = :updated_at
                    WHERE id = :user_id
                    """
                ),
                {
                    "user_id": str(user.supabase_user_id),
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "updated_at": datetime.utcnow(),
                },
            )
            supabase_db.commit()
        except Exception as exc:
            supabase_db.rollback()
            print(f"Warning: Failed to mirror profile update to Supabase: {exc}")

    return {
        "message": "Profile updated successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
    }


async def handle_change_password(
    request: Request,
    data,
    local_db: Session,
    supabase_db: Session | None = None,
):
    """
    Change password for authenticated user.
    """
    user = _get_authenticated_user_from_request(request, local_db)

    current_password = data.current_password
    new_password = data.new_password

    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long")

    if verify_password(new_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password",
        )

    new_password_hash = hash_password(new_password)
    user.password_hash = new_password_hash

    try:
        local_db.commit()
    except Exception as exc:
        local_db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to change password: {exc}") from exc

    if supabase_db and user.supabase_user_id:
        try:
            supabase_db.execute(
                text(
                    """
                    UPDATE public.users
                    SET password_hash = :password_hash,
                        updated_at = :updated_at
                    WHERE id = :user_id
                    """
                ),
                {
                    "user_id": str(user.supabase_user_id),
                    "password_hash": new_password_hash,
                    "updated_at": datetime.utcnow(),
                },
            )
            supabase_db.commit()
        except Exception as exc:
            supabase_db.rollback()
            print(f"Warning: Failed to mirror password update to Supabase: {exc}")

    return {"message": "Password changed successfully"}


async def handle_logout(request: Request, local_db: Session, supabase_db: Session | None = None):
    """
    Handle user logout.
    
    Sets is_active = false in both Local PostgreSQL and Supabase databases
    to track user login status.
    
    Args:
        request: FastAPI Request object to extract token
        local_db: Database session for Local PostgreSQL
        supabase_db: Optional Supabase database session
    """
    # Extract token from Authorization header
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # If no token, still return success (logout is idempotent)
        return {"message": "Logged out successfully"}
    
    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    
    if not payload:
        # If token is invalid, still return success (logout is idempotent)
        return {"message": "Logged out successfully"}
    
    email = payload.get("sub")
    if not email:
        return {"message": "Logged out successfully"}
    
    # Find user in Local DB
    user = local_db.query(User).filter(User.email == email).first()
    
    if user:
        # Set is_active = false in Local DB
        user.is_active = False
        local_db.commit()
        
        # Set is_active = false in Supabase if linked
        if supabase_db and user.supabase_user_id:
            try:
                now = datetime.utcnow()
                supabase_db.execute(
                    text(
                        """
                        UPDATE public.users
                        SET is_active = false, updated_at = :updated_at
                        WHERE id = :user_id
                        """
                    ),
                    {
                        "user_id": str(user.supabase_user_id),
                        "updated_at": now,
                    },
                )
                supabase_db.commit()
            except Exception as e:
                # Log error but don't fail logout if Supabase update fails
                print(f"Warning: Failed to update Supabase is_active on logout: {e}")
    
    return {"message": "Logged out successfully"}


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    if not isinstance(password, str):
        password = str(password)
    password = password[:72]  # truncate to safe length
    # Generate salt and hash password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def register_user(
    local_db: Session,
    username: str,
    email: str,
    password: str,
    supabase_db: Session | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
):
    """
    Register a new user.
    
    - Always writes to Local PostgreSQL.
    - If Supabase session is provided, also inserts into Supabase users and links supabase_user_id.
    
    Args:
        local_db: Local database session
        username: Username for local database
        email: User email
        password: User password
        supabase_db: Optional Supabase database session
        first_name: First name for Supabase (if None, will split username or use username)
        last_name: Last name for Supabase (if None, will be empty or split from username)
    """
    existing_user = local_db.query(User).filter(
        (User.username == username) | (User.email == email)
    ).first()
    if existing_user:
        raise ValueError("Username or email already exists")

    hashed_pw = hash_password(password)

    # Insert locally (flush only; commit happens after optional Supabase insert)
    new_user = User(
        username=username, 
        email=email, 
        password_hash=hashed_pw,
        first_name=first_name,
        last_name=last_name,
        is_active=False  # User is not logged in yet
    )
    local_db.add(new_user)
    local_db.flush()

    supa_id = None

    # Optionally insert into Supabase
    if supabase_db:
        supa_id = str(uuid.uuid4())
        
        # Determine first_name and last_name for Supabase
        # If not provided, try to split username, otherwise use username as first_name
        if first_name is None and last_name is None:
            # Try to split username by space
            name_parts = username.strip().split(maxsplit=1)
            if len(name_parts) >= 2:
                supabase_first_name = name_parts[0]
                supabase_last_name = name_parts[1]
            else:
                supabase_first_name = username or ""
                supabase_last_name = ""
        elif first_name is None:
            supabase_first_name = username or ""
            supabase_last_name = last_name or ""
        elif last_name is None:
            supabase_first_name = first_name or ""
            supabase_last_name = ""
        else:
            supabase_first_name = first_name or ""
            supabase_last_name = last_name or ""
        
        try:
            # Generate verification token for email verification
            verification_token = secrets.token_urlsafe(32)
            now = datetime.utcnow()
            
            supabase_db.execute(
                text(
                    """
                    INSERT INTO public.users
                        (id, email, password_hash, username, first_name, last_name, role, is_active, is_verified,
                         verification_token, created_at, updated_at)
                    VALUES
                        (:id, :email, :password_hash, :username, :first_name, :last_name, 'user', false, false,
                         :verification_token, :created_at, :updated_at)
                    """
                ),
                {
                    "id": supa_id,
                    "email": email,
                    "password_hash": hashed_pw,
                    "username": username,
                    "first_name": supabase_first_name,
                    "last_name": supabase_last_name,
                    "verification_token": verification_token,
                    "created_at": now,
                    "updated_at": now,
                },
            )
            supabase_db.commit()
            new_user.supabase_user_id = supa_id
        except Exception as e:
            supabase_db.rollback()
            local_db.rollback()
            raise HTTPException(status_code=502, detail=f"Supabase user insert failed: {e}")

    try:
        local_db.commit()
        local_db.refresh(new_user)
    except Exception as exc:
        local_db.rollback()
        if supabase_db and supa_id:
            try:
                supabase_db.execute(
                    text("DELETE FROM public.users WHERE id = :user_id"),
                    {"user_id": str(supa_id)},
                )
                supabase_db.commit()
            except Exception:
                supabase_db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create local user after Supabase insert. Rolled back remote user.",
        ) from exc

    return new_user


async def handle_request_password_reset(
    local_db: Session,
    data: "RequestPasswordResetRequest",
    supabase_db: Session | None = None,
):
    """
    Handle password reset request.
    
    Generates a secure reset token and stores it in Supabase.
    Returns success message regardless of whether email exists (prevents enumeration).
    
    Args:
        local_db: Local database session
        data: RequestPasswordResetRequest with email
        supabase_db: Optional Supabase database session
    
    Returns:
        Success message (always returns success to prevent user enumeration)
    """
    # Find user in Local DB
    user = local_db.query(User).filter(User.email == data.email).first()
    
    # Always return success to prevent user enumeration
    # Only generate token if user exists and is linked to Supabase
    if user and user.supabase_user_id and supabase_db:
        try:
            # Generate secure reset token
            reset_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry
            
            # Update Supabase user with reset token
            supabase_db.execute(
                text(
                    """
                    UPDATE public.users
                    SET password_reset_token = :reset_token,
                        password_reset_expires = :expires_at,
                        updated_at = :updated_at
                    WHERE id = :user_id
                    """
                ),
                {
                    "user_id": str(user.supabase_user_id),
                    "reset_token": reset_token,
                    "expires_at": expires_at,
                    "updated_at": datetime.utcnow(),
                },
            )
            supabase_db.commit()
            
            # TODO: Send email with reset link
            # Reset link format: {frontend_url}/reset-password?token={reset_token}
            # Example: https://app.adal.com/reset-password?token={reset_token}
            
        except Exception as e:
            # Log error but still return success (prevent enumeration)
            print(f"Warning: Failed to generate password reset token: {e}")
    
    # Always return success message (prevents user enumeration)
    return {
        "message": "If an account with that email exists, a password reset link has been sent."
    }


async def handle_reset_password(
    local_db: Session,
    data: "ResetPasswordRequest",
    supabase_db: Session | None = None,
):
    """
    Handle password reset with token.
    
    Validates the reset token, checks expiry, and updates the password.
    
    Args:
        local_db: Local database session
        data: ResetPasswordRequest with token and new_password
        supabase_db: Optional Supabase database session
    
    Returns:
        Success message
    
    Raises:
        HTTPException: If token is invalid, expired, or user not found
    """
    if not supabase_db:
        raise HTTPException(
            status_code=503,
            detail="Password reset service is not available. Please contact support."
        )
    
    # Find user in Supabase by reset token
    try:
        result = supabase_db.execute(
            text(
                """
                SELECT id, email, password_reset_token, password_reset_expires
                FROM public.users
                WHERE password_reset_token = :token
                AND password_reset_expires > :now
                """
            ),
            {
                "token": data.token,
                "now": datetime.utcnow(),
            },
        ).fetchone()
        
        if not result:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired reset token. Please request a new password reset."
            )
        
        supabase_user_id, email, stored_token, expires_at = result
        
        # Verify token matches exactly
        if stored_token != data.token:
            raise HTTPException(
                status_code=400,
                detail="Invalid reset token. Please request a new password reset."
            )
        
        # Validate password strength (min 8 characters)
        if len(data.new_password) < 8:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long."
            )
        
        # Hash new password
        new_password_hash = hash_password(data.new_password)
        
        # Find user in Local DB by email
        local_user = local_db.query(User).filter(User.email == email).first()
        
        if not local_user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Please contact support."
            )
        
        # Update password in Local DB
        local_user.password_hash = new_password_hash
        local_db.commit()
        
        # Update password in Supabase
        supabase_db.execute(
            text(
                """
                UPDATE public.users
                SET password_hash = :password_hash,
                    password_reset_token = NULL,
                    password_reset_expires = NULL,
                    updated_at = :updated_at
                WHERE id = :user_id
                """
            ),
            {
                "user_id": str(supabase_user_id),
                "password_hash": new_password_hash,
                "updated_at": datetime.utcnow(),
            },
        )
        supabase_db.commit()
        
        return {
            "message": "Password has been reset successfully. You can now log in with your new password."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        supabase_db.rollback()
        local_db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset password: {str(e)}"
        )
