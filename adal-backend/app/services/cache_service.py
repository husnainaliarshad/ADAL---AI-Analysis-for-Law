import os
import redis
import json
import hashlib
from typing import Optional, Any

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CacheService:
    def __init__(self):
        try:
            self.redis = redis.from_url(REDIS_URL)
            self.redis.ping()
            self.enabled = True
        except Exception as e:
            print(f"Redis not available: {e}")
            self.enabled = False

    def _get_key(self, prefix: str, data: str) -> str:
        # Use MD5 hash of the data to keep keys short and handle long queries
        data_hash = hashlib.md5(data.encode()).hexdigest()
        return f"{prefix}:{data_hash}"

    def get_embedding(self, text: str) -> Optional[list]:
        if not self.enabled: return None
        try:
            key = self._get_key("emb", text)
            cached = self.redis.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
        return None

    def set_embedding(self, text: str, vector: list):
        if not self.enabled: return
        try:
            key = self._get_key("emb", text)
            self.redis.setex(key, 86400 * 7, json.dumps(vector)) # Cache for 7 days
        except Exception:
            pass

    def get_retrieval(self, query_text: str) -> Optional[list]:
        if not self.enabled: return None
        try:
            key = self._get_key("ret", query_text)
            cached = self.redis.get(key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass
        return None

    def set_retrieval(self, query_text: str, results: list):
        if not self.enabled: return
        try:
            key = self._get_key("ret", query_text)
            # Serialize objects to ensure they are JSON serializable
            self.redis.setex(key, 3600 * 24, json.dumps(results)) # Cache for 24 hours
        except Exception:
            pass

cache_service = CacheService()
