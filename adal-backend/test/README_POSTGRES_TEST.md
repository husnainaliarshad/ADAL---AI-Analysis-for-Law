# PostgreSQL Connection Test

This document explains how to use the PostgreSQL connection test to verify your local database setup.

## Overview

The `test_postgres_connection.py` file contains comprehensive tests to verify that your application can successfully connect to a local PostgreSQL database. These tests validate:

- Environment variable configuration
- Database URL format validation
- Actual database connectivity
- Basic query execution
- Connection pooling
- Transaction handling

## Prerequisites

### 1. PostgreSQL Server Installation

You need a running PostgreSQL server. Install it using:

**Windows:**

```bash
# Using Chocolatey (recommended)
choco install postgresql

# Or download from: https://www.postgresql.org/download/windows/
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**

```bash
# Using Homebrew
brew install postgresql
```

### 2. Start PostgreSQL Service

**Windows:**

```bash
# Start service
pg_ctl start

# Or using Services panel: Start "postgresql-x64-XX"
```

**Linux:**

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**

```bash
brew services start postgresql
```

### 3. Create Database (Optional)

Create a database for testing (replace `your_password` with your actual password):

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE adal_local;

-- Create user (optional)
CREATE USER adal_user WITH PASSWORD 'your_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE adal_local TO adal_user;
```

## Configuration

### 1. Environment Setup

Copy the example environment file and configure the database URL:

```bash
# Copy environment file
cp env.example .env
```

Edit `.env` file and set `LOCAL_DATABASE_URL`:

```bash
# Local PostgreSQL connection
LOCAL_DATABASE_URL=postgresql://postgres:your_password@localhost:5432/adal_local
```

### 2. Install Dependencies

Ensure you have the required packages:

```bash
pip install psycopg2-binary pytest python-dotenv
```

## Running the Tests

### Method 1: Run Specific Test

```bash
# From project root directory
python test/run_postgres_test.py
```

### Method 2: Run with pytest directly

```bash
# Run the specific test file
pytest test/test_postgres_connection.py -v

# Run all tests including PostgreSQL test
pytest test/ -v -k postgres
```

### Method 3: Run with existing test runner

```bash
# From test directory
python run_tests.py
```

## Test Results

### Successful Test Output

```
test/test_postgres_connection.py::TestLocalPostgresConnection::test_environment_variable_exists PASSED
test/test_postgres_connection.py::TestLocalPostgresConnection::test_database_url_format PASSED
test/test_postgres_connection.py::TestLocalPostgresConnection::test_connection_established PASSED
test/test_postgres_connection.py::TestLocalPostgresConnection::test_basic_query_execution PASSED
test/test_postgres_connection.py::TestLocalPostgresConnection::test_connection_pooling PASSED
test/test_postgres_connection.py::TestLocalPostgresConnection::test_transaction_rollback PASSED
test_postgres_connection_simple PASSED
```

### Common Issues and Solutions

#### 1. Environment Variable Not Set

```
LOCAL_DATABASE_URL environment variable is not set
```

**Solution:** Add `LOCAL_DATABASE_URL` to your `.env` file.

#### 2. Connection Refused

```
Cannot connect to PostgreSQL server
```

**Solutions:**

- Start PostgreSQL service: `pg_ctl start`
- Check if PostgreSQL is running: `pg_isready`
- Verify port (default: 5432) is not blocked

#### 3. Authentication Failed

```
PostgreSQL authentication failed
```

**Solutions:**

- Check username/password in `LOCAL_DATABASE_URL`
- Verify user exists: `psql -U postgres -c "\du"`
- Reset password if needed

#### 4. Database Does Not Exist

```
Database does not exist
```

**Solutions:**

- Create database: `createdb adal_local`
- Or change database name in `LOCAL_DATABASE_URL`

#### 5. Import Error

```
ModuleNotFoundError: No module named 'psycopg2'
```

**Solution:** Install dependency: `pip install psycopg2-binary`

## Test Details

### Test Classes and Methods

#### TestLocalPostgresConnection

- `test_environment_variable_exists()`: Validates `LOCAL_DATABASE_URL` is set
- `test_database_url_format()`: Checks URL format is correct
- `test_connection_established()`: Tests actual database connection
- `test_basic_query_execution()`: Runs basic SQL queries
- `test_connection_pooling()`: Tests multiple connections
- `test_transaction_rollback()`: Tests transaction handling

#### Standalone Tests

- `test_postgres_connection_simple()`: Basic connection test using psycopg2

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Test PostgreSQL Connection
  run: |
    sudo systemctl start postgresql
    sudo -u postgres createdb adal_local
    python test/run_postgres_test.py
```

## Troubleshooting

### Check PostgreSQL Status

```bash
# Check if service is running
pg_isready

# Check version
psql --version

# List databases
psql -U postgres -l

# Connect to database
psql -U postgres -d adal_local
```

### Common PostgreSQL Commands

```bash
# Start/stop service
sudo systemctl start postgresql
sudo systemctl stop postgresql

# Create database
createdb adal_local

# Drop database
dropdb adal_local

# Change password
psql -U postgres -c "ALTER USER postgres PASSWORD 'new_password';"
```

### Environment Variables

Make sure your `.env` file contains:

```bash
# Required for PostgreSQL tests
LOCAL_DATABASE_URL=postgresql://postgres:your_password@localhost:5432/adal_local
```

## Support

If you encounter issues:

1. Check the test output for specific error messages
2. Verify PostgreSQL installation and configuration
3. Ensure environment variables are correctly set
4. Check that all required packages are installed
5. Review the troubleshooting section above

For additional help, check the main project documentation or create an issue.
