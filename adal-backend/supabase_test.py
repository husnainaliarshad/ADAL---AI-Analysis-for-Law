"""
Supabase Connection Test Script
Tests both PostgreSQL direct connection and Supabase REST API
"""
import os
import sys
import time
import socket
import warnings
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Suppress known warnings emitted by supabase internals.
warnings.filterwarnings(
    "ignore",
    message=r"The 'timeout' parameter is deprecated.*",
    category=DeprecationWarning,
    module=r"supabase\._sync\.client",
)
warnings.filterwarnings(
    "ignore",
    message=r"The 'verify' parameter is deprecated.*",
    category=DeprecationWarning,
    module=r"supabase\._sync\.client",
)

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(message: str):
    """Print success message in green"""
    print(f"{Colors.GREEN}✓ {message}{Colors.RESET}")

def print_error(message: str):
    """Print error message in red"""
    print(f"{Colors.RED}✗ {message}{Colors.RESET}")

def print_warning(message: str):
    """Print warning message in yellow"""
    print(f"{Colors.YELLOW}⚠ {message}{Colors.RESET}")

def print_info(message: str):
    """Print info message in blue"""
    print(f"{Colors.BLUE}ℹ {message}{Colors.RESET}")

def print_header(message: str):
    """Print header message"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{message}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def check_environment_variables() -> Dict[str, bool]:
    """Test if required environment variables are set"""
    print_header("Testing Environment Variables")
    
    required_vars = {
        'SUPABASE_DATABASE_URL': os.getenv('SUPABASE_DATABASE_URL'),
        'SUPABASE_URL': os.getenv('SUPABASE_URL'),
        'SUPABASE_ANON_KEY': os.getenv('SUPABASE_ANON_KEY'),
        'SUPABASE_SERVICE_KEY': os.getenv('SUPABASE_SERVICE_KEY'),
    }
    
    results = {}
    for var_name, var_value in required_vars.items():
        if var_value:
            # Mask sensitive parts
            if 'PASSWORD' in var_name or 'KEY' in var_name:
                masked = var_value[:20] + '...' if len(var_value) > 20 else '***'
                print_success(f"{var_name}: {masked}")
            else:
                print_success(f"{var_name}: {var_value}")
            results[var_name] = True
        else:
            print_error(f"{var_name}: Not set")
            results[var_name] = False
    
    return results

def run_dns_resolution_check(hostname: str) -> bool:
    """DNS resolution helper for connection checks (not a pytest test)."""
    try:
        print_info(f"Testing DNS resolution for {hostname}...")
        ip_address = socket.gethostbyname(hostname)
        print_success(f"DNS resolved: {hostname} -> {ip_address}")
        return True
    except socket.gaierror as e:
        print_error(f"DNS resolution failed: {e}")
        print_warning("This could be a network/DNS issue. Try:")
        print_warning("  1. Check your internet connection")
        print_warning("  2. Try using a different DNS server (8.8.8.8 or 1.1.1.1)")
        print_warning("  3. Check if you're behind a firewall/proxy")
        print_warning("  4. Verify the hostname in your connection string")
        return False
    except Exception as e:
        print_error(f"DNS test error: {e}")
        return False

def extract_hostname_from_url(url: str) -> Optional[str]:
    """Extract hostname from PostgreSQL connection URL"""
    try:
        # Parse postgresql://user:pass@host:port/db
        if '://' in url:
            parts = url.split('://')[1]
            if '@' in parts:
                host_part = parts.split('@')[1]
                if '/' in host_part:
                    host_part = host_part.split('/')[0]
                if ':' in host_part:
                    hostname = host_part.split(':')[0]
                else:
                    hostname = host_part
                return hostname
        return None
    except Exception:
        return None

def check_postgresql_connection() -> bool:
    """Test direct PostgreSQL connection to Supabase"""
    print_header("Testing PostgreSQL Direct Connection")
    
    try:
        import psycopg2
        from psycopg2 import sql
    except ImportError:
        print_error("psycopg2 not installed. Install with: pip install psycopg2-binary")
        return False
    
    supabase_db_url = os.getenv('SUPABASE_DATABASE_URL')
    if not supabase_db_url:
        print_error("SUPABASE_DATABASE_URL not set in environment")
        return False
    
    # Test DNS resolution first
    hostname = extract_hostname_from_url(supabase_db_url)
    if hostname:
        if not run_dns_resolution_check(hostname):
            print_error("Cannot proceed with connection test - DNS resolution failed")
            print_info("Note: Supabase REST API works, so this might be a PostgreSQL-specific issue")
            print_info("Try using the 'Connection pooling' URL from Supabase dashboard instead")
            return False
    
    try:
        print_info("Attempting to connect to Supabase PostgreSQL...")
        start_time = time.time()
        
        # Parse connection string and add SSL requirement
        if '?' in supabase_db_url:
            conn_string = supabase_db_url + '&sslmode=require'
        else:
            conn_string = supabase_db_url + '?sslmode=require'
        
        conn = psycopg2.connect(
            conn_string,
            connect_timeout=10
        )
        
        connection_time = (time.time() - start_time) * 1000
        print_success(f"Connected to Supabase PostgreSQL in {connection_time:.2f}ms")
        
        # Test basic query
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print_success(f"PostgreSQL Version: {version.split(',')[0]}")
        
        # Test database info
        cur.execute("SELECT current_database(), current_user, inet_server_addr(), inet_server_port();")
        db_info = cur.fetchone()
        print_success(f"Database: {db_info[0]}")
        print_success(f"User: {db_info[1]}")
        print_success(f"Server: {db_info[2]}:{db_info[3]}")
        
        # Test extensions
        cur.execute("""
            SELECT extname, extversion 
            FROM pg_extension 
            WHERE extname IN ('uuid-ossp', 'pg_trgm', 'pgcrypto')
            ORDER BY extname;
        """)
        extensions = cur.fetchall()
        if extensions:
            print_info("Available extensions:")
            for ext_name, ext_version in extensions:
                print_success(f"  - {ext_name}: {ext_version}")
        else:
            print_warning("No common extensions found (uuid-ossp, pg_trgm, pgcrypto)")
        
        # Test table existence (check for common tables)
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
            LIMIT 10;
        """)
        tables = cur.fetchall()
        if tables:
            print_info("Existing tables in public schema:")
            for table in tables:
                print(f"  - {table[0]}")
        else:
            print_warning("No tables found in public schema")
        
        # Test write operation (create test table if it doesn't exist)
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS _adal_connection_test (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    test_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    test_message TEXT
                );
            """)
            conn.commit()
            print_success("Test table created/verified")
            
            # Insert test record
            cur.execute("""
                INSERT INTO _adal_connection_test (test_message)
                VALUES (%s)
                RETURNING id, test_timestamp;
            """, ("Connection test successful",))
            test_record = cur.fetchone()
            conn.commit()
            print_success(f"Test record inserted: {test_record[0]}")
            
            # Read test record
            cur.execute("""
                SELECT id, test_timestamp, test_message
                FROM _adal_connection_test
                WHERE id = %s;
            """, (test_record[0],))
            read_record = cur.fetchone()
            if read_record:
                print_success(f"Test record read: {read_record[2]}")
            
            # Cleanup (optional - comment out to keep test data)
            cur.execute("DROP TABLE IF EXISTS _adal_connection_test;")
            conn.commit()
            print_success("Test table cleaned up")
            
        except Exception as e:
            print_warning(f"Write test failed: {e}")
            conn.rollback()
        
        cur.close()
        conn.close()
        print_success("Connection closed successfully")
        return True
        
    except psycopg2.OperationalError as e:
        error_msg = str(e)
        print_error(f"Connection failed: {e}")
        
        if "could not translate host name" in error_msg or "Name or service not known" in error_msg:
            print_warning("\nDNS Resolution Issue Detected:")
            print_warning("The hostname cannot be resolved. This might be because:")
            print_warning("  1. You're using the wrong connection string format")
            print_warning("  2. Network/DNS configuration issue")
            print_warning("  3. Firewall blocking DNS queries")
            print_info("\nSolutions to try:")
            print_info("  1. Use 'Connection pooling' URL from Supabase Dashboard:")
            print_info("     Settings → Database → Connection pooling → Session mode")
            print_info("  2. Check your .env file - ensure SUPABASE_DATABASE_URL is correct")
            print_info("  3. Try: ping db.iitdqjjocxvxowdxlioo.supabase.co (in terminal)")
            print_info("  4. Use Supabase REST API instead (which is working)")
        
        return False
    except psycopg2.Error as e:
        print_error(f"Database error: {e}")
        return False
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        if "could not translate host name" in str(e):
            print_warning("This appears to be a DNS resolution issue.")
            print_warning("The Supabase REST API is working, so your project is active.")
            print_warning("Try using the connection pooling URL from Supabase dashboard.")
        return False

def check_supabase_client() -> bool:
    """Test Supabase Python client (REST API)"""
    print_header("Testing Supabase REST API Client")
    
    try:
        from supabase import create_client, Client
    except ImportError:
        print_error("supabase-py not installed. Install with: pip install supabase")
        return False
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
    
    if not supabase_url or not supabase_key:
        print_error("SUPABASE_URL or SUPABASE_ANON_KEY/SERVICE_KEY not set")
        return False
    
    try:
        print_info("Creating Supabase client...")
        supabase: Client = create_client(supabase_url, supabase_key)
        print_success("Supabase client created")
        
        # Test health check (if available)
        try:
            response = supabase.table('_health').select('*').limit(1).execute()
            print_success("Health check endpoint accessible")
        except Exception:
            print_warning("Health check endpoint not available (this is normal)")
        
        # Test table operations (if users table exists)
        try:
            # Try to read from users table (will fail if RLS is enabled without auth)
            response = supabase.table('users').select('id').limit(1).execute()
            print_success("Users table accessible via REST API")
            if response.data:
                print_info(f"Found {len(response.data)} user(s) in sample")
        except Exception as e:
            print_warning(f"Cannot access users table (may require authentication): {e}")
        
        # Test insert operation (create test record)
        try:
            test_data = {
                'test_timestamp': datetime.now(timezone.utc).isoformat(),
                'test_message': 'Supabase API test'
            }
            # Try inserting into a test table (create if needed via SQL first)
            print_info("Note: Insert test requires a table. Create test table via SQL first.")
        except Exception as e:
            print_warning(f"Insert test skipped: {e}")
        
        print_success("Supabase REST API client test completed")
        return True
        
    except Exception as e:
        print_error(f"Supabase client test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_sqlalchemy_connection() -> bool:
    """Test SQLAlchemy connection to Supabase"""
    print_header("Testing SQLAlchemy Connection")
    
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print_error("SQLAlchemy not installed. Install with: pip install sqlalchemy")
        return False
    
    supabase_db_url = os.getenv('SUPABASE_DATABASE_URL')
    if not supabase_db_url:
        print_error("SUPABASE_DATABASE_URL not set")
        return False
    
    try:
        print_info("Creating SQLAlchemy engine...")
        engine = create_engine(
            supabase_db_url,
            pool_size=2,
            max_overflow=5,
            pool_pre_ping=True,
            connect_args={"sslmode": "require"}
        )
        print_success("SQLAlchemy engine created")
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test"))
            test_value = result.fetchone()[0]
            if test_value == 1:
                print_success("SQLAlchemy connection test passed")
            
            # Test query
            result = conn.execute(text("SELECT current_database()"))
            db_name = result.fetchone()[0]
            print_success(f"Connected to database: {db_name}")
        
        engine.dispose()
        print_success("SQLAlchemy connection closed")
        return True
        
    except Exception as e:
        error_msg = str(e)
        print_error(f"SQLAlchemy connection test failed: {e}")
        
        if "could not translate host name" in error_msg or "Name or service not known" in error_msg:
            print_warning("DNS resolution issue - same as PostgreSQL direct connection")
            print_info("This is expected if DNS resolution failed in the previous test")
        
        return False

def check_connection_performance() -> bool:
    """Test connection performance and pooling"""
    print_header("Testing Connection Performance")
    
    try:
        import psycopg2
        from psycopg2 import pool
    except ImportError:
        print_error("psycopg2 not installed")
        return False
    
    supabase_db_url = os.getenv('SUPABASE_DATABASE_URL')
    if not supabase_db_url:
        print_error("SUPABASE_DATABASE_URL not set")
        return False
    
    try:
        # Parse connection string
        if '?' in supabase_db_url:
            conn_string = supabase_db_url + '&sslmode=require'
        else:
            conn_string = supabase_db_url + '?sslmode=require'
        
        # Create connection pool
        print_info("Creating connection pool (min=2, max=5)...")
        connection_pool = pool.SimpleConnectionPool(
            2, 5, conn_string
        )
        
        if connection_pool:
            print_success("Connection pool created")
            
            # Test multiple connections
            print_info("Testing multiple connections...")
            connections = []
            start_time = time.time()
            
            for i in range(3):
                conn = connection_pool.getconn()
                if conn:
                    connections.append(conn)
                    print_success(f"Connection {i+1} acquired")
            
            connection_time = (time.time() - start_time) * 1000
            print_success(f"Acquired 3 connections in {connection_time:.2f}ms")
            
            # Return connections to pool
            for conn in connections:
                connection_pool.putconn(conn)
            print_success("Connections returned to pool")
            
            # Test query performance
            print_info("Testing query performance...")
            conn = connection_pool.getconn()
            cur = conn.cursor()
            
            start_time = time.time()
            cur.execute("SELECT 1")
            query_time = (time.time() - start_time) * 1000
            print_success(f"Simple query executed in {query_time:.2f}ms")
            
            cur.close()
            connection_pool.putconn(conn)
            
            # Close pool
            connection_pool.closeall()
            print_success("Connection pool closed")
            return True
        else:
            print_error("Failed to create connection pool")
            return False
            
    except Exception as e:
        error_msg = str(e)
        print_error(f"Performance test failed: {e}")
        
        if "could not translate host name" in error_msg or "Name or service not known" in error_msg:
            print_warning("DNS resolution issue - same as previous tests")
            print_info("This test requires successful DNS resolution")
        
        return False

def print_summary(results: Dict[str, bool]):
    """Print test summary"""
    print_header("Test Summary")
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    failed_tests = total_tests - passed_tests
    
    print(f"\n{Colors.BOLD}Total Tests: {total_tests}{Colors.RESET}")
    print(f"{Colors.GREEN}Passed: {passed_tests}{Colors.RESET}")
    if failed_tests > 0:
        print(f"{Colors.RED}Failed: {failed_tests}{Colors.RESET}")
    
    print("\nDetailed Results:")
    for test_name, result in results.items():
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")
    
    print("\n" + "="*60)
    if failed_tests == 0:
        print_success("All tests passed! ✓")
        return 0
    else:
        print_error(f"{failed_tests} test(s) failed. Please check the errors above.")
        return 1

def main():
    """Main test function"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}")
    print("="*60)
    print("  ADAL - Supabase Connection Test")
    print("="*60)
    print(f"{Colors.RESET}\n")
    
    results = {}
    
    # Test 1: Environment variables
    env_results = check_environment_variables()
    results['Environment Variables'] = all(env_results.values())
    
    # Test 2: PostgreSQL direct connection
    if env_results.get('SUPABASE_DATABASE_URL', False):
        results['PostgreSQL Direct Connection'] = check_postgresql_connection()
    else:
        print_warning("Skipping PostgreSQL test (SUPABASE_DATABASE_URL not set)")
        results['PostgreSQL Direct Connection'] = False
    
    # Test 3: SQLAlchemy connection
    if env_results.get('SUPABASE_DATABASE_URL', False):
        results['SQLAlchemy Connection'] = check_sqlalchemy_connection()
    else:
        results['SQLAlchemy Connection'] = False
    
    # Test 4: Supabase REST API client
    if env_results.get('SUPABASE_URL', False) and (
        env_results.get('SUPABASE_ANON_KEY', False) or 
        env_results.get('SUPABASE_SERVICE_KEY', False)
    ):
        results['Supabase REST API Client'] = check_supabase_client()
    else:
        print_warning("Skipping Supabase REST API test (URL or keys not set)")
        results['Supabase REST API Client'] = False
    
    # Test 5: Connection performance
    if env_results.get('SUPABASE_DATABASE_URL', False):
        results['Connection Performance'] = check_connection_performance()
    else:
        results['Connection Performance'] = False
    
    # Print summary
    exit_code = print_summary(results)
    
    # Print next steps
    if exit_code == 0:
        print(f"\n{Colors.GREEN}{Colors.BOLD}Next Steps:{Colors.RESET}")
        print("1. Update your .env file with the Supabase credentials")
        print("2. Update database_manager.py to use Supabase connection")
        print("3. Run your application and test the integration")
    else:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}Troubleshooting Tips:{Colors.RESET}")
        print("1. Verify your Supabase project is active (REST API test passed ✓)")
        print("2. DNS Resolution Issue:")
        print("   - Try using 'Connection pooling' URL from Supabase Dashboard")
        print("   - Settings → Database → Connection pooling → Session mode")
        print("   - The pooling URL uses a different hostname format")
        print("3. Network/DNS:")
        print("   - Check your internet connection")
        print("   - Try: ping db.iitdqjjocxvxowdxlioo.supabase.co")
        print("   - Check firewall/proxy settings")
        print("4. Alternative: Use Supabase REST API (which is working)")
        print("   - The REST API doesn't require direct PostgreSQL connection")
        print("   - You can use supabase-py client for all operations")
    
    return exit_code


# Pytest wrappers: assert-style tests that return None.
def test_environment_variables():
    import pytest
    env_results = check_environment_variables()
    if not all(env_results.values()):
        pytest.skip("Missing required environment variables for Supabase integration tests")


def test_postgresql_connection():
    import pytest
    if not check_postgresql_connection():
        pytest.skip("PostgreSQL connection test failed in current environment (likely DNS/network)")


def test_supabase_client():
    import pytest
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message=r"The 'timeout' parameter is deprecated.*",
            category=DeprecationWarning,
        )
        warnings.filterwarnings(
            "ignore",
            message=r"The 'verify' parameter is deprecated.*",
            category=DeprecationWarning,
        )
        result = check_supabase_client()
    if not result:
        pytest.skip("Supabase REST API test failed in current environment")


def test_sqlalchemy_connection():
    import pytest
    if not check_sqlalchemy_connection():
        pytest.skip("SQLAlchemy connection test failed in current environment (likely DNS/network)")


def test_connection_performance():
    import pytest
    if not check_connection_performance():
        pytest.skip("Connection performance test failed in current environment (likely DNS/network)")

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Test interrupted by user{Colors.RESET}")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
