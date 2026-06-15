"""
Simple in-memory rate limiting middleware for FastAPI.
Provides basic protection against brute force attacks.
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter.
    
    Tracks requests per IP address and endpoint.
    Resets counters after the time window expires.
    
    Note: This is a basic implementation. For production,
    consider using Redis-based rate limiting for distributed systems.
    """
    
    def __init__(self, app, requests_per_minute: int = 5):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts: Dict[str, list] = defaultdict(list)
        self.window_seconds = 60  # 1 minute window
    
    async def dispatch(self, request: Request, call_next):
        # Only rate limit login endpoint
        if request.url.path == "/api/auth/login":
            client_ip = request.client.host if request.client else "unknown"
            key = f"{client_ip}:login"
            
            now = datetime.utcnow()
            
            # Clean old entries
            self.request_counts[key] = [
                timestamp for timestamp in self.request_counts[key]
                if now - timestamp < timedelta(seconds=self.window_seconds)
            ]
            
            # Check if limit exceeded
            if len(self.request_counts[key]) >= self.requests_per_minute:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many login attempts. Please try again in {self.window_seconds} seconds."
                )
            
            # Add current request timestamp
            self.request_counts[key].append(now)
        
        response = await call_next(request)
        return response


def create_rate_limit_middleware(app, requests_per_minute: int = 5):
    """
    Factory function to create rate limit middleware.
    
    Args:
        app: FastAPI application instance
        requests_per_minute: Maximum requests per minute per IP (default: 5)
    
    Returns:
        RateLimitMiddleware instance
    """
    return RateLimitMiddleware(app, requests_per_minute=requests_per_minute)
