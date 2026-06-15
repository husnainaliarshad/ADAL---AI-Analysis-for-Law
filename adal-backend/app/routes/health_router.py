"""
Health Check Router
Provides endpoint to check server health and status
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.database_main import get_db
from app.database.database_manager import get_local_db
from app.core.redis_client import redis_client
from datetime import datetime
import os

router = APIRouter(prefix="", tags=["Health"])


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint that returns server status in JSON format.
    
    Returns:
        JSON object with:
        - status: "healthy" or "unhealthy"
        - timestamp: Current UTC timestamp
        - checks: Dictionary of health check results
        - version: Server version info
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "checks": {
            "server": True,
            "database": False,
            "redis": False,
            "api_docs": True
        },
        "version": {
            "api_version": os.getenv("API_VERSION", "1.0.0"),
            "environment": os.getenv("ENVIRONMENT", "development")
        },
        "error": None
    }
    
    # Check database connectivity
    try:
        # Simple query to verify database connection
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = True
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = False
        health_status["error"] = f"Database connection failed: {str(e)}"
    
    # Check Redis connectivity (non-critical, so doesn't affect overall status)
    try:
        if redis_client.is_connected():
            redis_client.client.ping()
            health_status["checks"]["redis"] = True
        else:
            health_status["checks"]["redis"] = False
    except Exception as e:
        health_status["checks"]["redis"] = False
        # Redis is optional, so we don't mark as unhealthy if it fails
    
    # If any critical check fails, mark as unhealthy
    # Note: Redis is optional, so only database failure marks as unhealthy
    if not health_status["checks"]["database"]:
        health_status["status"] = "unhealthy"
    
    return health_status


@router.get("/health/db_conn_live")
async def db_conn_live():
    """
    Check liveness of PostgreSQL database.
    Returns JSON like:
    {
      "local": "alive" | "dead"
    }
    """
    status = {"local": "dead"}

    # Local PostgreSQL
    try:
        for _db in get_local_db():
            _db.execute(text("SELECT 1"))
            status["local"] = "alive"
            break
    except Exception:
        status["local"] = "dead"

    return status


@router.get("/health/live")
async def liveness_check():
    """
    Liveness probe endpoint - simple check if server is running.
    Used by Kubernetes/container orchestration for basic health checks.
    
    Returns:
        Simple JSON response indicating server is alive
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


@router.get("/health/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Readiness probe endpoint - checks if server is ready to accept traffic.
    Verifies critical dependencies (database) are available.
    
    Returns:
        JSON response indicating if server is ready
    """
    try:
        # Check database
        db.execute(text("SELECT 1"))
        return JSONResponse(status_code=200, content={
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "status": "not_ready",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error": f"Database not available: {str(e)}"
        })


@router.get("/health/redis")
async def redis_health():
    """
    Check Redis connection health and status.
    
    Returns:
        JSON object with:
        - status: "healthy", "unavailable", or "error"
        - connected: Boolean indicating if Redis is connected
        - redis_version: Redis server version (if connected)
        - used_memory_human: Human-readable memory usage
        - connected_clients: Number of connected clients
        - total_keys: Total number of keys in Redis
        - error: Error message (if any)
    """
    is_connected = redis_client.is_connected()
    
    if is_connected:
        try:
            # Get Redis server information
            info = redis_client.client.info()
            total_keys = redis_client.client.dbsize()
            
            return {
                "status": "healthy",
                "connected": True,
                "redis_version": info.get("redis_version", "unknown"),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "used_memory": info.get("used_memory", 0),
                "connected_clients": info.get("connected_clients", 0),
                "total_keys": total_keys,
                "uptime_in_seconds": info.get("uptime_in_seconds", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "error": None
            }
        except Exception as e:
            return {
                "status": "error",
                "connected": True,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
    else:
        return {
            "status": "unavailable",
            "connected": False,
            "message": "Redis is not connected. Check WSL Redis service and configuration.",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "error": None
        }
