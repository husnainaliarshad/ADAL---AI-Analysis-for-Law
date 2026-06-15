"""
Redis Client Manager for ADAL Backend
Handles Redis connection, connection pooling, and utility functions
"""
import redis
from redis.connection import ConnectionPool
from typing import Optional, Any
import os
from dotenv import load_dotenv
import json
import logging

load_dotenv()

logger = logging.getLogger(__name__)


class RedisClient:
    """Singleton Redis client manager"""

    _instance: Optional['RedisClient'] = None
    _client: Optional[redis.Redis] = None
    _pool: Optional[ConnectionPool] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self._initialize_client()

    def _initialize_client(self):
        """Initialize Redis connection pool and client"""
        try:
            # Connection pool configuration
            self._pool = ConnectionPool(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", 6379)),
                password=os.getenv("REDIS_PASSWORD") or None,
                db=int(os.getenv("REDIS_DB", 0)),
                max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", 50)),
                decode_responses=os.getenv("REDIS_DECODE_RESPONSES", "True").lower() == "true",
                socket_timeout=int(os.getenv("REDIS_SOCKET_TIMEOUT", 5)),
                socket_connect_timeout=int(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", 5)),
                retry_on_timeout=os.getenv("REDIS_RETRY_ON_TIMEOUT", "True").lower() == "true",
            )

            # Create Redis client
            self._client = redis.Redis(connection_pool=self._pool)

            # Test connection
            self._client.ping()
            logger.info("✓ Redis connection established successfully")
            try:
                print("✓ Redis connection established successfully")
            except UnicodeEncodeError:
                print("[OK] Redis connection established successfully")

        except redis.AuthenticationError as e:
            logger.error(f"Redis authentication failed: {e}")
            try:
                print(f"⚠ Error: Redis authentication failed!")
                print(f"  Details: {e}")
                print("  Please check REDIS_PASSWORD in your .env file")
                print("⚠ Redis features will be disabled. Application will continue without caching.")
            except UnicodeEncodeError:
                print(f"[ERROR] Redis authentication failed!")
                print(f"  Details: {e}")
                print("  Please check REDIS_PASSWORD in your .env file")
                print("[WARNING] Redis features will be disabled. Application will continue without caching.")
            self._client = None
        except redis.ConnectionError as e:
            logger.warning(f"Redis connection failed: {e}")
            try:
                print(f"⚠ Warning: Redis connection failed: {e}")
                print("⚠ Redis features will be disabled. Application will continue without caching.")
            except UnicodeEncodeError:
                print(f"[WARNING] Redis connection failed: {e}")
                print("[WARNING] Redis features will be disabled. Application will continue without caching.")
            self._client = None
        except Exception as e:
            logger.error(f"Redis initialization error: {e}")
            try:
                print(f"⚠ Warning: Redis initialization error: {e}")
            except UnicodeEncodeError:
                print(f"[WARNING] Redis initialization error: {e}")
            self._client = None

    @property
    def client(self) -> Optional[redis.Redis]:
        """Get Redis client instance"""
        return self._client

    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except:
            return False

    def close(self):
        """Close Redis connection pool"""
        if self._pool:
            self._pool.disconnect()
            self._client = None
            self._pool = None
            logger.info("Redis connection pool closed")


# Global Redis client instance
redis_client = RedisClient()


# =============================================================================
# Cache Utility Functions
# =============================================================================

def get_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    Generate a consistent cache key from prefix and arguments

    Args:
        prefix: Cache key prefix (e.g., 'user', 'document', 'citation')
        *args: Positional arguments to include in key
        **kwargs: Keyword arguments to include in key

    Returns:
        Formatted cache key string

    Example:
        get_cache_key("document", 123) -> "document:123"
        get_cache_key("user", user_id=456, status="active") -> "user:status:active:user_id:456"
    """
    key_parts = [prefix]

    # Add positional arguments
    for arg in args:
        if arg is not None:
            key_parts.append(str(arg))

    # Add keyword arguments (sorted for consistency)
    if kwargs:
        sorted_kwargs = sorted(kwargs.items())
        for k, v in sorted_kwargs:
            if v is not None:
                key_parts.append(f"{k}:{v}")

    return ":".join(key_parts)


def cache_get(key: str, default: Any = None) -> Any:
    """
    Get value from cache

    Args:
        key: Cache key
        default: Default value if key doesn't exist

    Returns:
        Cached value or default
    """
    if not redis_client.is_connected():
        return default

    try:
        value = redis_client.client.get(key)
        if value is None:
            return default

        # Try to deserialize JSON
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    except Exception as e:
        logger.error(f"Redis cache_get error for key {key}: {e}")
        return default


def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> bool:
    """
    Set value in cache

    Args:
        key: Cache key
        value: Value to cache (will be JSON serialized if needed)
        ttl: Time to live in seconds (defaults to REDIS_CACHE_TTL)

    Returns:
        True if successful, False otherwise
    """
    if not redis_client.is_connected():
        return False

    try:
        # Serialize value if it's not a string
        if not isinstance(value, (str, bytes)):
            value = json.dumps(value)

        # Use default TTL if not specified
        if ttl is None:
            ttl = int(os.getenv("REDIS_CACHE_TTL", 3600))

        redis_client.client.setex(key, ttl, value)
        return True
    except Exception as e:
        logger.error(f"Redis cache_set error for key {key}: {e}")
        return False


def cache_delete(key: str) -> bool:
    """Delete a key from cache"""
    if not redis_client.is_connected():
        return False

    try:
        redis_client.client.delete(key)
        return True
    except Exception as e:
        logger.error(f"Redis cache_delete error for key {key}: {e}")
        return False


def cache_delete_pattern(pattern: str) -> bool:
    """
    Delete all keys matching a pattern

    Args:
        pattern: Redis key pattern (e.g., 'user:*', 'document:123:*')

    Returns:
        True if successful, False otherwise
    """
    if not redis_client.is_connected():
        return False

    try:
        keys = redis_client.client.keys(pattern)
        if keys:
            redis_client.client.delete(*keys)
            logger.info(f"Deleted {len(keys)} keys matching pattern: {pattern}")
        return True
    except Exception as e:
        logger.error(f"Redis cache_delete_pattern error for pattern {pattern}: {e}")
        return False


def cache_exists(key: str) -> bool:
    """Check if a key exists in cache"""
    if not redis_client.is_connected():
        return False

    try:
        return redis_client.client.exists(key) > 0
    except:
        return False


# =============================================================================
# Session Management Functions
# =============================================================================

def set_session(session_id: str, user_data: dict, ttl: Optional[int] = None) -> bool:
    """
    Store user session in Redis

    Args:
        session_id: Unique session identifier
        user_data: Dictionary containing user session data
        ttl: Time to live in seconds (defaults to REDIS_SESSION_TTL)

    Returns:
        True if successful, False otherwise
    """
    if ttl is None:
        ttl = int(os.getenv("REDIS_SESSION_TTL", 86400))

    return cache_set(f"session:{session_id}", user_data, ttl)


def get_session(session_id: str) -> Optional[dict]:
    """Get user session from Redis"""
    return cache_get(f"session:{session_id}")


def delete_session(session_id: str) -> bool:
    """Delete user session from Redis"""
    return cache_delete(f"session:{session_id}")


def refresh_session(session_id: str, ttl: Optional[int] = None) -> bool:
    """Refresh session TTL"""
    if ttl is None:
        ttl = int(os.getenv("REDIS_SESSION_TTL", 86400))

    if not redis_client.is_connected():
        return False

    try:
        return redis_client.client.expire(f"session:{session_id}", ttl)
    except:
        return False