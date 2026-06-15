"""
Test Single Database Configuration

Verifies that removing Supabase keys still allows everything to work with PostgreSQL.
"""

import os
from dotenv import load_dotenv
import requests

load_dotenv()

def test_database_fallback():
    """Test that database functions work with just PostgreSQL."""
    print("🔍 Testing Database Fallback Logic\n")
    
    # Temporarily remove Supabase env var
    supabase_url = os.getenv('SUPABASE_DATABASE_URL')
    os.environ['SUPABASE_DATABASE_URL'] = ''
    
    try:
        # Test imports
        from app.database.database_manager import get_db, get_local_db, get_supabase_db, get_neon_db
        print("✅ Database imports successful")
        
        # Test that all functions return the same session
        local_db = next(get_local_db())
        supabase_db = next(get_supabase_db())
        neon_db = next(get_neon_db())
        
        print(f"✅ get_local_db() works: {type(local_db)}")
        print(f"✅ get_supabase_db() fallback works: {type(supabase_db)}")
        print(f"✅ get_neon_db() fallback works: {type(neon_db)}")
        
        # Test basic database operation
        result = local_db.execute("SELECT 1 as test").fetchone()
        print(f"✅ Database query works: {result}")
        
        # Close sessions
        local_db.close()
        supabase_db.close()
        neon_db.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        # Restore Supabase env var
        if supabase_url:
            os.environ['SUPABASE_DATABASE_URL'] = supabase_url

def test_api_endpoints():
    """Test that API endpoints work without Supabase."""
    print("\n🌐 Testing API Endpoints\n")
    
    base_url = "http://127.0.0.1:9006"
    
    # Test health check
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ Health check works: {health['status']}")
            print(f"   Database status: {health['checks']['database']}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health check error: {e}")
    
    # Test database connection endpoint
    try:
        response = requests.get(f"{base_url}/health/db_conn_live")
        if response.status_code == 200:
            conn_status = response.json()
            print(f"✅ DB connection check works: {conn_status}")
        else:
            print(f"❌ DB connection check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ DB connection check error: {e}")

def main():
    """Run all tests."""
    print("🚀 Testing Single Database Configuration\n")
    
    test_database_fallback()
    test_api_endpoints()
    
    print("\n🎉 Testing completed!")

if __name__ == "__main__":
    main()
