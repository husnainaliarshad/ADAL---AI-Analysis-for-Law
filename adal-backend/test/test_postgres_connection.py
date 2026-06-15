"""
Test for Local PostgreSQL Database Connection

This test verifies that the application can successfully connect to a local PostgreSQL database.
It tests the connection using the LOCAL_DATABASE_URL environment variable.

Requirements:
- Local PostgreSQL server must be running
- LOCAL_DATABASE_URL environment variable must be set
- psycopg2-binary package must be installed

Usage:
    pytest test/test_postgres_connection.py -v
"""

import pytest
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, DatabaseError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class TestLocalPostgresConnection:
    """Test class for Local PostgreSQL database connection."""

    @pytest.fixture(scope="class")
    def local_db_url(self):
        """Fixture to get the local database URL from environment."""
        url = os.getenv("LOCAL_DATABASE_URL")
        if not url:
            pytest.skip("LOCAL_DATABASE_URL environment variable not set. "
                       "Please set it in your .env file to run these tests.")
        return url

    @pytest.fixture(scope="class")
    def local_engine(self, local_db_url):
        """Fixture to create a SQLAlchemy engine for local PostgreSQL."""
        try:
            engine = create_engine(
                local_db_url,
                pool_pre_ping=True,
                connect_args={
                    "connect_timeout": 5,  # Shorter timeout for tests
                }
            )
            yield engine
            engine.dispose()
        except Exception as e:
            pytest.skip(f"Failed to create database engine: {e}")

    def test_environment_variable_exists(self):
        """Test that LOCAL_DATABASE_URL environment variable is set."""
        db_url = os.getenv("LOCAL_DATABASE_URL")
        assert db_url is not None, (
            "LOCAL_DATABASE_URL environment variable is not set. "
            "Please add it to your .env file. "
            "Example: LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/adal_local"
        )

    def test_database_url_format(self, local_db_url):
        """Test that the database URL has the correct format."""
        assert local_db_url.startswith("postgresql://"), (
            "LOCAL_DATABASE_URL must start with 'postgresql://'. "
            f"Current value: {local_db_url}"
        )

        # Check that it contains required components
        assert "@localhost:" in local_db_url or "@127.0.0.1:" in local_db_url, (
            "LOCAL_DATABASE_URL should connect to localhost or 127.0.0.1. "
            f"Current value: {local_db_url}"
        )

    def test_connection_established(self, local_engine):
        """Test that a connection can be established to the local PostgreSQL database."""
        try:
            with local_engine.connect() as connection:
                result = connection.execute(text("SELECT 1 as test"))
                row = result.fetchone()
                assert row is not None, "No result returned from test query"
                assert row[0] == 1, f"Unexpected result from test query: {row[0]}"
        except OperationalError as e:
            if "could not connect to server" in str(e).lower():
                pytest.fail(
                    "Cannot connect to PostgreSQL server. "
                    "Please ensure:\n"
                    "1. PostgreSQL server is running\n"
                    "2. The connection details in LOCAL_DATABASE_URL are correct\n"
                    "3. The database exists\n"
                    f"Error: {e}"
                )
            elif "authentication failed" in str(e).lower():
                pytest.fail(
                    "PostgreSQL authentication failed. "
                    "Please check the username and password in LOCAL_DATABASE_URL.\n"
                    f"Error: {e}"
                )
            elif "database" in str(e).lower() and "does not exist" in str(e).lower():
                pytest.fail(
                    "Database does not exist. "
                    "Please create the database specified in LOCAL_DATABASE_URL.\n"
                    f"Error: {e}"
                )
            else:
                pytest.fail(f"Database connection failed: {e}")
        except DatabaseError as e:
            pytest.fail(f"Database error occurred: {e}")
        except Exception as e:
            pytest.fail(f"Unexpected error during database connection test: {e}")

    def test_basic_query_execution(self, local_engine):
        """Test that basic SQL queries can be executed."""
        try:
            with local_engine.connect() as connection:
                # Test SELECT query
                result = connection.execute(text("SELECT version()"))
                version_row = result.fetchone()
                assert version_row is not None, "Failed to get PostgreSQL version"
                assert "PostgreSQL" in version_row[0], f"Unexpected version: {version_row[0]}"

                # Test CREATE TEMP TABLE and INSERT
                connection.execute(text("CREATE TEMP TABLE test_connection (id SERIAL PRIMARY KEY, data TEXT)"))
                connection.execute(text("INSERT INTO test_connection (data) VALUES ('test_data')"))
                connection.commit()

                # Test SELECT from created table
                result = connection.execute(text("SELECT COUNT(*) FROM test_connection"))
                count_row = result.fetchone()
                assert count_row[0] == 1, f"Expected 1 row, got {count_row[0]}"

        except Exception as e:
            pytest.fail(f"Failed to execute basic queries: {e}")

    def test_connection_pooling(self, local_engine):
        """Test that connection pooling works correctly."""
        connections = []
        try:
            # Create multiple connections to test pooling
            for i in range(3):
                conn = local_engine.connect()
                connections.append(conn)

                # Execute a simple query on each connection
                result = conn.execute(text("SELECT 42"))
                assert result.fetchone()[0] == 42

            # All connections should work independently
            assert len(connections) == 3, "Failed to create multiple connections"

        except Exception as e:
            pytest.fail(f"Connection pooling test failed: {e}")
        finally:
            # Clean up connections
            for conn in connections:
                try:
                    conn.close()
                except:
                    pass

    def test_transaction_rollback(self, local_engine):
        """Test that transactions work correctly with rollback."""
        try:
            with local_engine.connect() as connection:
                # Start a transaction (not using context manager so we can manually rollback)
                trans = connection.begin()
                
                try:
                    # Create a temp table and insert data
                    connection.execute(text("CREATE TEMP TABLE test_transaction (id INTEGER)"))
                    connection.execute(text("INSERT INTO test_transaction VALUES (1)"))
                    connection.execute(text("INSERT INTO test_transaction VALUES (2)"))

                    # Verify data exists in transaction
                    result = connection.execute(text("SELECT COUNT(*) FROM test_transaction"))
                    count = result.fetchone()[0]
                    assert count == 2, f"Expected 2 rows in transaction, got {count}"

                    # Rollback the transaction explicitly
                    trans.rollback()
                    
                except Exception as e:
                    # Ensure rollback on error
                    if trans.is_active:
                        trans.rollback()
                    raise e

                # After rollback, verify we can still execute queries (connection is still valid)
                # Note: Temp tables are session-scoped, so they're gone after rollback
                # Just verify the connection is still working
                result = connection.execute(text("SELECT 1"))
                assert result.fetchone()[0] == 1, "Connection should still be valid after rollback"

        except Exception as e:
            pytest.fail(f"Transaction rollback test failed: {e}")


# Standalone test functions for simple validation
def test_postgres_connection_simple():
    """Simple test to verify PostgreSQL connection using basic psycopg2 if available."""
    try:
        import psycopg2
    except ImportError:
        pytest.skip("psycopg2-binary not installed. Install with: pip install psycopg2-binary")

    local_db_url = os.getenv("LOCAL_DATABASE_URL")
    if not local_db_url:
        pytest.skip("LOCAL_DATABASE_URL environment variable not set")

    # Parse the URL manually for psycopg2
    try:
        from urllib.parse import urlparse
        parsed = urlparse(local_db_url)

        conn_params = {
            'host': parsed.hostname,
            'port': parsed.port or 5432,
            'user': parsed.username,
            'password': parsed.password,
            'database': parsed.path.lstrip('/')
        }

        # Try to connect
        conn = psycopg2.connect(**conn_params)
        conn.close()

    except Exception as e:
        pytest.fail(f"Simple PostgreSQL connection test failed: {e}")


if __name__ == "__main__":
    # Allow running this test directly
    pytest.main([__file__, "-v"])