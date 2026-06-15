"""
Cache decorators for route handlers and service functions

This module provides decorators to easily cache function results using Redis.
Supports both async and sync functions, with automatic cache key generation
and TTL management.

Usage Examples:
    # Basic usage
    @cached(ttl=1800, key_prefix="user")
    async def get_user(user_id: int, db):
        # ... fetch user from database
        return user
    
    # Exclude specific parameters from cache key
    @cached(ttl=3600, key_prefix="document", exclude_params=['db', 'current_user'])
    def get_document(document_id: int, db, current_user):
        # ... fetch document
        return document
"""
from functools import wraps
from typing import Callable, Optional, Any
from app.core.redis_client import get_cache_key, cache_get, cache_set
import inspect
import logging

logger = logging.getLogger(__name__)


def cached(ttl: int = 3600, key_prefix: str = "cache", exclude_params: list = None):
    """
    Decorator to cache function results in Redis
    
    Args:
        ttl: Time to live in seconds (default: 3600 = 1 hour)
        key_prefix: Prefix for cache key (default: "cache")
        exclude_params: List of parameter names to exclude from cache key
                       (default: ['db', 'session'] - excludes database sessions)
    
    Returns:
        Decorated function that caches results
    
    Features:
        - Automatically handles both async and sync functions
        - Excludes database sessions from cache key generation
        - Only caches non-None results
        - Returns cached value if available, otherwise executes function
    
    Example:
        @cached(ttl=1800, key_prefix="user")
        async def get_user(user_id: int, db):
            user = db.query(User).filter(User.id == user_id).first()
            return user
        
        # First call: fetches from database and caches
        user1 = await get_user(123, db)
        
        # Second call: returns from cache (faster!)
        user2 = await get_user(123, db)
    """
    if exclude_params is None:
        exclude_params = ['db', 'session']  # Exclude database sessions by default
    
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            """
            Async wrapper for caching async function results
            """
            try:
                # Get function signature
                sig = inspect.signature(func)
                bound_args = sig.bind(*args, **kwargs)
                bound_args.apply_defaults()
                
                # Build cache key excluding certain parameters
                cache_params = {
                    k: v for k, v in bound_args.arguments.items()
                    if k not in exclude_params
                }
                
                cache_key = get_cache_key(
                    key_prefix,
                    func.__name__,
                    **cache_params
                )
                
                # Try to get from cache
                cached_result = cache_get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Cache HIT for key: {cache_key}")
                    return cached_result
                
                logger.debug(f"Cache MISS for key: {cache_key}")
                
                # Execute function
                result = await func(*args, **kwargs)
                
                # Store in cache (only if result is not None)
                if result is not None:
                    cache_set(cache_key, result, ttl)
                    logger.debug(f"Cached result for key: {cache_key} (TTL: {ttl}s)")
                
                return result
                
            except Exception as e:
                # If caching fails, still execute the function
                logger.warning(f"Cache error in {func.__name__}: {e}. Executing function without cache.")
                return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            """
            Sync wrapper for caching synchronous function results
            """
            try:
                # Get function signature
                sig = inspect.signature(func)
                bound_args = sig.bind(*args, **kwargs)
                bound_args.apply_defaults()
                
                # Build cache key excluding certain parameters
                cache_params = {
                    k: v for k, v in bound_args.arguments.items()
                    if k not in exclude_params
                }
                
                cache_key = get_cache_key(
                    key_prefix,
                    func.__name__,
                    **cache_params
                )
                
                # Try to get from cache
                cached_result = cache_get(cache_key)
                if cached_result is not None:
                    logger.debug(f"Cache HIT for key: {cache_key}")
                    return cached_result
                
                logger.debug(f"Cache MISS for key: {cache_key}")
                
                # Execute function
                result = func(*args, **kwargs)
                
                # Store in cache (only if result is not None)
                if result is not None:
                    cache_set(cache_key, result, ttl)
                    logger.debug(f"Cached result for key: {cache_key} (TTL: {ttl}s)")
                
                return result
                
            except Exception as e:
                # If caching fails, still execute the function
                logger.warning(f"Cache error in {func.__name__}: {e}. Executing function without cache.")
                return func(*args, **kwargs)
        
        # Return appropriate wrapper based on function type
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def cache_invalidate(key_prefix: str, *args, **kwargs):
    """
    Helper function to invalidate cache by key pattern
    
    Args:
        key_prefix: Cache key prefix
        *args: Positional arguments for key generation
        **kwargs: Keyword arguments for key generation
    
    Example:
        # Invalidate specific document cache
        cache_invalidate("document", document_id=123)
        
        # Invalidate all user caches
        from app.core.redis_client import cache_delete_pattern
        cache_delete_pattern("user:*")
    """
    from app.core.redis_client import cache_delete
    
    cache_key = get_cache_key(key_prefix, *args, **kwargs)
    return cache_delete(cache_key)
