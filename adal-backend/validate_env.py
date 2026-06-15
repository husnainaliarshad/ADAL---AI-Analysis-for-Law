#!/usr/bin/env python3
"""
Environment Variable Validation Script
Validates .env file configuration and suggests improvements.

Notes:
- Base backend boot requires DATABASE_URL.
- Chat/drafting features additionally rely on LOCAL_DATABASE_URL and DEEPSEEK_API_KEY.
- LOCAL_DATABASE_URL should point to a PostgreSQL database with pgvector enabled
  and a populated legal_library table for retrieval.
"""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

def generate_secret_key():
    """Generate a secure random secret key."""
    return secrets.token_urlsafe(32)

def check_env_file():
    """Check if .env file exists."""
    env_path = Path(__file__).parent / ".env"
    return env_path.exists(), env_path

def validate_database_url(db_url):
    """Validate DATABASE_URL format."""
    if not db_url:
        return False, "DATABASE_URL is missing"
    
    if not db_url.startswith("postgresql://"):
        return False, "DATABASE_URL should start with 'postgresql://'"
    
    if "sslmode=require" not in db_url:
        return False, "DATABASE_URL should include 'sslmode=require' for security"
    
    return True, "Valid"

def validate_postgres_url(db_url, var_name):
    """Validate generic PostgreSQL URL format."""
    if not db_url:
        return False, f"{var_name} is missing"

    if not db_url.startswith("postgresql://"):
        return False, f"{var_name} should start with 'postgresql://'"

    return True, "Valid"

def main():
    print("=" * 60)
    print("ADAL Backend - Environment Configuration Validator")
    print("=" * 60)
    print()
    
    # Check if .env exists
    env_exists, env_path = check_env_file()
    
    if not env_exists:
        print("❌ .env file not found!")
        print(f"   Expected location: {env_path}")
        print()
        print("💡 Solution:")
        print("   1. Copy env.example to .env:")
        print("      cp env.example .env")
        print("   2. Fill in your values")
        print()
        return
    
    print(f"✅ .env file found: {env_path}")
    print()
    
    # Load environment variables
    load_dotenv()
    
    # Required variables
    required_vars = {
        "DATABASE_URL": {
            "required": True,
            "validator": validate_database_url,
            "description": "PostgreSQL connection string"
        }
    }

    # Recommended variables
    recommended_vars = {
        "LOCAL_DATABASE_URL": {
            "required": False,
            "validator": lambda value: validate_postgres_url(value, "LOCAL_DATABASE_URL"),
            "description": "Local PostgreSQL used by chat/drafting and retrieval services"
        },
        "SECRET_KEY": {
            "required": False,
            "default": "supersecretkey",
            "description": "JWT secret key (MUST be changed in production!)",
            "generate": generate_secret_key
        },
        "PORT": {
            "required": False,
            "default": "9006",
            "description": "Server port"
        },
        "ENVIRONMENT": {
            "required": False,
            "default": "development",
            "description": "Environment (development/staging/production)"
        },
        "LLM_MODEL_NAME": {
            "required": False,
            "default": "llama2",
            "description": "LLM model name. Use deepseek-chat for imported chat/drafting routes."
        },
        "LLM_BASE_URL": {
            "required": False,
            "default": "http://localhost:11434",
            "description": "Ollama base URL"
        },
        "DEEPSEEK_API_KEY": {
            "required": False,
            "default": "",
            "description": "Required for cleanup-core chat/drafting backend routes (DeepSeek API)"
        },
        "BGE_MODEL_NAME": {
            "required": False,
            "default": "BAAI/bge-base-en-v1.5",
            "description": "BGE embedding model"
        }
    }
    
    # Check required variables
    print("📋 Required Variables:")
    print("-" * 60)
    all_required_ok = True
    
    for var_name, config in required_vars.items():
        value = os.getenv(var_name)
        is_required = config.get("required", False)
        validator = config.get("validator")
        
        if not value:
            print(f"❌ {var_name}: MISSING")
            if is_required:
                all_required_ok = False
                print(f"   ⚠️  This is REQUIRED!")
        else:
            # Validate if validator exists
            if validator:
                is_valid, message = validator(value)
                if is_valid:
                    # Mask sensitive parts
                    if "password" in var_name.lower() or "secret" in var_name.lower() or "key" in var_name.lower():
                        masked = value[:20] + "..." + value[-10:] if len(value) > 30 else "***"
                        print(f"✅ {var_name}: {masked} ({message})")
                    else:
                        print(f"✅ {var_name}: {value[:50]}... ({message})")
                else:
                    print(f"⚠️  {var_name}: {message}")
                    all_required_ok = False
            else:
                # Mask sensitive values
                if "password" in var_name.lower() or "secret" in var_name.lower() or "key" in var_name.lower():
                    masked = value[:10] + "..." + value[-5:] if len(value) > 15 else "***"
                    print(f"✅ {var_name}: {masked}")
                else:
                    print(f"✅ {var_name}: {value[:50]}...")
    
    print()
    
    # Check recommended variables
    print("📋 Recommended Variables:")
    print("-" * 60)
    security_issues = []
    
    for var_name, config in recommended_vars.items():
        value = os.getenv(var_name)
        default = config.get("default")
        description = config.get("description", "")
        generate_func = config.get("generate")
        validator = config.get("validator")
        
        if not value:
            print(f"⚠️  {var_name}: MISSING (using default: {default})")
            print(f"   📝 {description}")
            
            # Special handling for SECRET_KEY
            if var_name == "SECRET_KEY" and generate_func:
                new_key = generate_func()
                print(f"   💡 Generated secure key: {new_key}")
                print(f"   💡 Add to .env: SECRET_KEY={new_key}")
                security_issues.append(f"SECRET_KEY is using default value - security risk!")
            elif var_name == "DEEPSEEK_API_KEY":
                print("   💡 Chat/drafting endpoints imported from cleanup-core will not work without this.")
            elif var_name == "LOCAL_DATABASE_URL":
                print("   💡 Needed for chat/drafting retrieval and local PostgreSQL-backed features.")
        else:
            if validator:
                is_valid, message = validator(value)
                if not is_valid:
                    print(f"⚠️  {var_name}: {message}")
                    continue

            # Check if using default (security risk for SECRET_KEY)
            if var_name == "SECRET_KEY" and value == default:
                print(f"❌ {var_name}: USING DEFAULT VALUE (SECURITY RISK!)")
                new_key = generate_func()
                print(f"   💡 Generate new key: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
                print(f"   💡 Or use this generated one: {new_key}")
                security_issues.append(f"SECRET_KEY is using default value - MUST change!")
            elif var_name == "LLM_MODEL_NAME" and value == "llama2":
                print(f"⚠️  {var_name}: {value}")
                print("   📝 Imported chat/drafting routes expect a DeepSeek-compatible model such as deepseek-chat.")
            else:
                # Mask sensitive values
                if "password" in var_name.lower() or "secret" in var_name.lower() or "key" in var_name.lower():
                    masked = value[:10] + "..." + value[-5:] if len(value) > 15 else "***"
                    print(f"✅ {var_name}: {masked}")
                else:
                    print(f"✅ {var_name}: {value}")

    print()
    print("🧠 Chat/Drafting Checklist:")
    print("-" * 60)
    local_db_url = os.getenv("LOCAL_DATABASE_URL")
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
    llm_model_name = os.getenv("LLM_MODEL_NAME", "llama2")

    if local_db_url:
        print("✅ LOCAL_DATABASE_URL is set")
    else:
        print("⚠️  LOCAL_DATABASE_URL is not set")

    if deepseek_api_key:
        masked = deepseek_api_key[:10] + "..." + deepseek_api_key[-5:] if len(deepseek_api_key) > 15 else "***"
        print(f"✅ DEEPSEEK_API_KEY: {masked}")
    else:
        print("⚠️  DEEPSEEK_API_KEY is not set")

    if llm_model_name == "deepseek-chat":
        print("✅ LLM_MODEL_NAME is set for DeepSeek chat/drafting")
    else:
        print(f"⚠️  LLM_MODEL_NAME is '{llm_model_name}'")
        print("   💡 For imported cleanup-core chat/drafting routes, use: deepseek-chat")

    print("ℹ️  Also confirm your LOCAL_DATABASE_URL database has:")
    print("   - pgvector extension enabled")
    print("   - legal_library table present")
    print("   - embeddings/data loaded for retrieval")

    print()
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    if all_required_ok:
        print("✅ All required variables are set")
    else:
        print("❌ Some required variables are missing")
    
    if security_issues:
        print()
        print("⚠️  Security Issues Found:")
        for issue in security_issues:
            print(f"   - {issue}")
        print()
        print("💡 Fix these issues before deploying to production!")
    else:
        print("✅ No security issues detected")
    
    print()
    print("📚 For more information, see: Documents/ENV_CONFIGURATION_GUIDE.md")
    print("=" * 60)

if __name__ == "__main__":
    main()

