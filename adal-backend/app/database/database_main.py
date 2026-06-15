"""
Database Connection Module (Backward Compatibility)

This module maintains backward compatibility with existing code.
For new code, use app.database.database_manager instead.

The module now routes to Local PostgreSQL by default if available,
otherwise falls back to Neon.
"""
from app.database.database_manager import (
    LocalBase as Base,
    LocalSessionLocal as SessionLocal,
    local_engine as engine,
    get_local_db as get_db
)

# Export for backward compatibility
__all__ = ['Base', 'SessionLocal', 'engine', 'get_db']
