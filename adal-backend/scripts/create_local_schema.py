"""
Script to initialize Local PostgreSQL schema for ADAL Backend

This script:
1. Creates the database if it doesn't exist
2. Runs the SQL schema file to create all tables
3. Verifies the schema was created successfully

Usage:
    python scripts/create_local_schema.py

Requirements:
    - PostgreSQL server running
    - LOCAL_DATABASE_URL set in .env file
    - psycopg2-binary installed
"""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

load_dotenv()


def get_db_info():
    """Parse LOCAL_DATABASE_URL and return connection info."""
    db_url = os.getenv("LOCAL_DATABASE_URL")
    if not db_url:
        raise ValueError(
            "LOCAL_DATABASE_URL environment variable not set. "
            "Please set it in your .env file."
        )
    
    parsed = urlparse(db_url)
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'user': parsed.username,
        'password': parsed.password,
        'database': parsed.path.lstrip('/')
    }


def create_database_if_not_exists(db_info):
    """Create database if it doesn't exist."""
    # Connect to postgres database to create the target database
    admin_db_info = db_info.copy()
    admin_db_info['database'] = 'postgres'  # Must connect to 'postgres' to create other databases
    
    try:
        conn = psycopg2.connect(**admin_db_info)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (db_info['database'],)
        )
        exists = cursor.fetchone()
        
        if not exists:
            print(f"Creating database: {db_info['database']}")
            cursor.execute(f'CREATE DATABASE "{db_info["database"]}"')
            print(f"✓ Database '{db_info['database']}' created successfully")
        else:
            print(f"✓ Database '{db_info['database']}' already exists")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"✗ Error creating database: {e}")
        raise


def run_schema_file(db_info):
    """Run the SQL schema file."""
    schema_file = project_root / "app" / "database" / "local_schema.sql"
    
    if not schema_file.exists():
        raise FileNotFoundError(
            f"Schema file not found: {schema_file}\n"
            "Please ensure app/database/local_schema.sql exists."
        )
    
    print(f"Reading schema file: {schema_file}")
    with open(schema_file, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    print(f"Connecting to database: {db_info['database']}")
    try:
        conn = psycopg2.connect(**db_info)
        cursor = conn.cursor()
        
        print("Executing schema SQL...")
        cursor.execute(schema_sql)
        conn.commit()
        
        print("✓ Schema created successfully")
        
        # Verify tables were created
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        tables = cursor.fetchall()
        
        print(f"\n✓ Created {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"✗ Error executing schema: {e}")
        raise


def verify_schema(db_info):
    """Verify that all expected tables exist."""
    expected_tables = [
        'documents', 'users', 'claims', 'citations',
        'claim_citation_mappings', 'embeddings', 'evidence', 
        'verification_reports', 'conversations', 'messages'
    ]
    
    try:
        conn = psycopg2.connect(**db_info)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        missing_tables = set(expected_tables) - set(existing_tables)
        
        if missing_tables:
            print(f"\n⚠ Warning: Missing tables: {missing_tables}")
            return False
        
        print(f"\n✓ All {len(expected_tables)} expected tables exist")
        
        # Check for supabase linking columns
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'documents' 
            AND column_name LIKE 'supabase_%'
        """)
        supabase_columns = cursor.fetchall()
        
        if supabase_columns:
            print(f"\n✓ Supabase linking columns found:")
            for col_name, col_type in supabase_columns:
                print(f"  - documents.{col_name} ({col_type})")
        
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.Error as e:
        print(f"✗ Error verifying schema: {e}")
        return False


def main():
    """Main execution function."""
    print("=" * 60)
    print("Local PostgreSQL Schema Initialization")
    print("=" * 60)
    print()
    
    try:
        # Get database connection info
        db_info = get_db_info()
        print(f"Target database: {db_info['database']}")
        print(f"Host: {db_info['host']}:{db_info['port']}")
        print(f"User: {db_info['user']}")
        print()
        
        # Create database if needed
        create_database_if_not_exists(db_info)
        print()
        
        # Run schema file
        run_schema_file(db_info)
        print()
        
        # Verify schema
        if verify_schema(db_info):
            print()
            print("=" * 60)
            print("✓ Schema initialization completed successfully!")
            print("=" * 60)
            print()
            print("Next steps:")
            print("1. Update your models to use LocalBase from database_manager")
            print("2. Update services to route operations to appropriate database")
            print("3. Test the connection: python test/run_postgres_test.py")
            return 0
        else:
            print()
            print("=" * 60)
            print("⚠ Schema initialization completed with warnings")
            print("=" * 60)
            return 1
            
    except Exception as e:
        print()
        print("=" * 60)
        print(f"✗ Schema initialization failed: {e}")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
