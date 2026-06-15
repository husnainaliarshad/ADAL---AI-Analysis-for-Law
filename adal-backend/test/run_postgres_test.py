"""
Script to run PostgreSQL connection tests specifically
"""
import sys
import subprocess
from pathlib import Path

def main():
    print("=" * 60)
    print("Running PostgreSQL Connection Tests")
    print("=" * 60)

    # Check if .env file exists
    env_file = Path(__file__).parent.parent / ".env"
    if not env_file.exists():
        print("[WARNING] .env file not found. Copy env.example to .env and configure LOCAL_DATABASE_URL")
        print(f"Expected location: {env_file}")
        print()

    # Change to the project root directory
    project_root = Path(__file__).parent.parent

    # Run the PostgreSQL connection test
    test_file = Path(__file__).parent / "test_postgres_connection.py"

    print(f"Running test: {test_file}")
    print(f"Working directory: {project_root}")
    print()

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-v", "--tb=short", "-s"],
        cwd=project_root
    )

    print()
    print("=" * 60)
    print(f"PostgreSQL connection test completed with exit code: {result.returncode}")

    if result.returncode == 0:
        print("[PASS] PostgreSQL connection test PASSED")
    else:
        print("[FAIL] PostgreSQL connection test FAILED")
        print()
        print("Troubleshooting:")
        print("1. Ensure PostgreSQL server is running: pg_ctl start")
        print("2. Check LOCAL_DATABASE_URL in .env file")
        print("3. Verify database credentials and database exists")
        print("4. Install psycopg2-binary: pip install psycopg2-binary")

    print("=" * 60)
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())