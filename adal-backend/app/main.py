from contextlib import asynccontextmanager
import os
import traceback

from dotenv import load_dotenv
load_dotenv()

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.redis_client import redis_client
from app.database.database_main import Base, engine
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes.admin_router import router as admin_router
from app.routes.auth_routes import router as auth_router
from app.routes.case_router import router as case_router
from app.routes.case_title_router import router as case_title_router
from app.routes.chat_router import router as chat_router
from app.routes.claim_router import router as claim_router
from app.routes.citation_router import router as citation_router
from app.routes.dashboard_router import router as dashboard_router
from app.routes.drafting_router import router as drafting_router
from app.routes.embedding_router import router as embedding_router
from app.routes.evidence_router import router as evidence_router
from app.routes.file_router import router as file_router
from app.routes.health_router import router as health_router
from app.routes.summary_router import router as summary_router
from app.routes.verification_router import router as verification_router

# Import models so SQLAlchemy metadata includes all tables before create_all().
from app.models.case_model import Case  # noqa: F401
from app.models.chat_model import Conversation, Message  # noqa: F401
from app.models.claim_model import Claim, ClaimCitationMapping  # noqa: F401
from app.models.citation_model import Citation  # noqa: F401
from app.models.document_model import Document  # noqa: F401
from app.models.draft_model import Draft, DocumentVersion, DraftChatMessage  # noqa: F401
from app.models.embedding_model import Embedding  # noqa: F401
from app.models.evidence_model import Evidence  # noqa: F401
from app.models.template_model import Template  # noqa: F401
from app.models.user_model import User  # noqa: F401
from app.models.verification_report_model import VerificationReport  # noqa: F401
from app.services.claim_service import start_claim_model_warmup
from app.services.vector_retrieval_service import start_vector_model_warmup


DEFAULT_SECRET_KEY = "supersecretkey"
INSECURE_SECRET_KEY_VALUES = {
    "",
    DEFAULT_SECRET_KEY,
    "your-super-secret-key-change-this-in-production",
}


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _parse_cors_settings():
    raw = os.getenv("CORS_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"], False

    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if not origins:
        return ["*"], False

    return origins, True


def _should_warm_claim_model() -> bool:
    return _env_flag("CLAIM_MODEL_WARMUP_ON_STARTUP", False)


def _should_warm_vector_model() -> bool:
    return _env_flag("VECTOR_MODEL_WARMUP_ON_STARTUP", False)


def _validate_runtime_configuration():
    environment = os.getenv("ENVIRONMENT", "development").strip().lower()
    secret_key = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY).strip()
    admin_auth_required = _env_flag("ADMIN_AUTH_REQUIRED", True)
    admin_api_key = os.getenv("ADMIN_API_KEY", "").strip()

    if environment in {"production", "staging"} and secret_key in INSECURE_SECRET_KEY_VALUES:
        raise RuntimeError(
            "Invalid SECRET_KEY for production/staging. Set a strong non-default SECRET_KEY."
        )

    if environment == "development" and secret_key in INSECURE_SECRET_KEY_VALUES:
        print("[WARNING] SECRET_KEY is missing/default in development.")

    if admin_auth_required and not admin_api_key:
        raise RuntimeError(
            "Invalid admin configuration: ADMIN_AUTH_REQUIRED=true but ADMIN_API_KEY is empty."
        )


_validate_runtime_configuration()
cors_origins, cors_allow_credentials = _parse_cors_settings()

try:
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables initialized")
except Exception as exc:
    print(f"[WARNING] Database initialization error: {exc}")
    traceback.print_exc()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("Starting ADAL Backend...")
    print("=" * 60)

    print("\nInitializing Redis cache system...")
    if redis_client.is_connected():
        try:
            print("[OK] Redis cache system ready")
        except UnicodeEncodeError:
            print("[OK] Redis cache system ready")
        try:
            info = redis_client.client.info()
            redis_version = info.get("redis_version", "unknown")
            connected_clients = info.get("connected_clients", 0)
            used_memory = info.get("used_memory_human", "unknown")
            total_keys = redis_client.client.dbsize()

            print(f"  Redis Version: {redis_version}")
            print(f"  Connected Clients: {connected_clients}")
            print(f"  Memory Used: {used_memory}")
            print(f"  Total Keys: {total_keys}")
        except Exception as exc:
            try:
                print(f"  [WARNING] Could not retrieve Redis info: {exc}")
            except UnicodeEncodeError:
                print(f"  [WARNING] Could not retrieve Redis info: {exc}")
    else:
        try:
            print("[WARNING] Redis not available - running without cache")
            print("  Application will continue, but caching features will be disabled")
            print("  To enable Redis:")
            print("    1. Ensure Redis is running in WSL: wsl redis-cli ping")
            print("    2. Check REDIS_HOST and REDIS_PORT in .env file")
        except UnicodeEncodeError:
            print("[WARNING] Redis not available - running without cache")
            print("  Application will continue, but caching features will be disabled")
            print("  To enable Redis:")
            print("    1. Ensure Redis is running in WSL: wsl redis-cli ping")
            print("    2. Check REDIS_HOST and REDIS_PORT in .env file")

    print("\n" + "=" * 60)
    print("Server ready!")
    print("=" * 60 + "\n")

    if _should_warm_claim_model():
        print("Starting InLegalBERT warmup in background...")
        start_claim_model_warmup()

    if _should_warm_vector_model():
        print("Starting BGE-m3 vector model warmup in background...")
        start_vector_model_warmup()

    yield

    print("\n" + "=" * 60)
    print("Shutting down server...")
    print("=" * 60)

    if redis_client.is_connected():
        try:
            redis_client.close()
            try:
                print("[OK] Redis connections closed")
            except UnicodeEncodeError:
                print("[OK] Redis connections closed")
        except Exception as exc:
            try:
                print(f"[WARNING] Error closing Redis connections: {exc}")
            except UnicodeEncodeError:
                print(f"[WARNING] Error closing Redis connections: {exc}")
    else:
        try:
            print("[OK] Redis was not connected, skipping cleanup")
        except UnicodeEncodeError:
            print("[OK] Redis was not connected, skipping cleanup")

    print("=" * 60)


app = FastAPI(title="ADAL Backend", lifespan=lifespan)

app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=int(os.getenv("LOGIN_RATE_LIMIT", "5")),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(file_router, prefix="/api/files", tags=["Files"])
app.include_router(citation_router, prefix="/api", tags=["Citations"])
app.include_router(dashboard_router, prefix="/api", tags=["Dashboard"])
app.include_router(claim_router, prefix="/api", tags=["Claims"])
app.include_router(embedding_router, prefix="/api", tags=["Embeddings & Retrieval"])
app.include_router(evidence_router, prefix="/api", tags=["Evidence"])
app.include_router(verification_router, prefix="/api", tags=["Verification"])
app.include_router(summary_router, prefix="/api", tags=["Summary"])
app.include_router(admin_router, prefix="/api", tags=["Admin"])
app.include_router(chat_router, prefix="/api", tags=["Chat"])
app.include_router(case_router, prefix="/api", tags=["Cases"])
app.include_router(case_title_router, prefix="/api", tags=["Cases"])
app.include_router(drafting_router, prefix="/api/draft", tags=["Drafting"])


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "9006"))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
