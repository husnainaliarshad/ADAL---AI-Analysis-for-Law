from datetime import datetime, timedelta
from jose import jwt, JWTError
from dotenv import load_dotenv
import os

load_dotenv()  # Load environment variables from .env file

# JWT Configuration from environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")  # Default for development only
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, remember: bool = False):
    """
    Create a refresh token.
    
    Args:
        data: Token payload data
        remember: If True, extends token expiry to 30 days (default: 7 days)
    """
    expire_days = 30 if remember else REFRESH_TOKEN_EXPIRE_DAYS
    expire = datetime.utcnow() + timedelta(days=expire_days)
    to_encode = {**data, "exp": expire, "type": "refresh"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def is_token_valid(token: str) -> bool:
    """
    Check if a token is valid (not expired and properly signed).
    Returns True if token is valid, False otherwise.
    """
    payload = verify_token(token)
    if not payload:
        return False
    
    # Check if token is expired
    exp = payload.get("exp")
    if exp:
        expire_time = datetime.fromtimestamp(exp)
        if datetime.utcnow() > expire_time:
            return False
    
    return True
