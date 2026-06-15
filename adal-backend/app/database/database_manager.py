"""
Multi-Database Connection Manager for ADAL Backend

Manages connections to three PostgreSQL databases:
1. Local PostgreSQL - AI/ML processing, heavy data storage
2. Supabase - Enterprise features, collaboration, multi-tenant
3. Neon - Legacy/backup (read-only, minimal sync)

Usage:
    from app.database.database_manager import (
        get_local_db,
        get_supabase_db,
        get_neon_db,
        LocalBase,
        SupabaseBase,
        NeonBase
    )
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

# =============================================================================
# Local PostgreSQL Connection
# Purpose: AI/ML processing, heavy data storage, embeddings
# =============================================================================
LOCAL_DATABASE_URL = os.getenv("LOCAL_DATABASE_URL")

if LOCAL_DATABASE_URL:
    local_engine = create_engine(
        LOCAL_DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "connect_timeout": 10,
        },
        echo=False
    )
    LocalSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)
    LocalBase = declarative_base()
else:
    local_engine = None
    LocalSessionLocal = None
    LocalBase = None
    print("⚠ Warning: LOCAL_DATABASE_URL not set. Local PostgreSQL features disabled.")


# =============================================================================
# Supabase Connection
# Purpose: Enterprise features, collaboration, multi-tenant
# =============================================================================
SUPABASE_DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")

if SUPABASE_DATABASE_URL:
    supabase_engine = create_engine(
        SUPABASE_DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "connect_timeout": 10,
            "sslmode": "require",
        },
        echo=False
    )
    SupabaseSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=supabase_engine)
    SupabaseBase = declarative_base()
else:
    supabase_engine = None
    SupabaseSessionLocal = None
    SupabaseBase = None
    print("Warning: SUPABASE_DATABASE_URL not set. Supabase features disabled.")


# =============================================================================
# Neon Connection (Legacy/Backup)
# Purpose: Minimal data sync, read-only analytics
# =============================================================================
DATABASE_URL = os.getenv("DATABASE_URL")  # Neon connection string

if DATABASE_URL:
    neon_engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
        echo=False
    )
    NeonSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=neon_engine)
    NeonBase = declarative_base()
else:
    neon_engine = None
    NeonSessionLocal = None
    NeonBase = None
    print("Warning: DATABASE_URL (Neon) not set. Neon features disabled.")


# =============================================================================
# Database Dependency Functions for FastAPI Routes
# =============================================================================

def get_local_db():
    """
    Get Local PostgreSQL database session.
    Use for: AI/ML processing, embeddings, claims, citations, evidence, verification reports.
    """
    if LocalSessionLocal is None:
        raise ValueError("Local PostgreSQL not configured. Set LOCAL_DATABASE_URL in .env")
    
    db = LocalSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_supabase_db():
    """
    Fallback function - returns local database session.
    Previously returned Supabase session, now uses PostgreSQL for everything.
    """
    return get_local_db()


def get_neon_db():
    """
    Fallback function - returns local database session.
    Previously returned Neon session, now uses PostgreSQL for everything.
    """
    return get_local_db()


# =============================================================================
# Backward Compatibility
# Keep existing database_main.py imports working
# =============================================================================

# For backward compatibility, export LocalBase as Base if it's the primary database
# This allows existing code to continue working
Base = LocalBase if LocalBase is not None else NeonBase

# Export the primary engine and session for backward compatibility
# Default to Local PostgreSQL if available, otherwise Neon
if local_engine:
    engine = local_engine
    SessionLocal = LocalSessionLocal
elif neon_engine:
    engine = neon_engine
    SessionLocal = NeonSessionLocal
else:
    engine = None
    SessionLocal = None


def get_db():
    """
    Backward compatibility function.
    Returns Local PostgreSQL session if available, otherwise Neon.
    """
    if LocalSessionLocal:
        return get_local_db()
    elif NeonSessionLocal:
        return get_neon_db()
    else:
        raise ValueError("No database configured. Set LOCAL_DATABASE_URL or DATABASE_URL in .env")
