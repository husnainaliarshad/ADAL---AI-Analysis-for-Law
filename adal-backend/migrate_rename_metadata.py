"""
Migration: rename 'metadata' column to 'msg_metadata' in the messages table.

Run once from the adal-backend directory:
    python migrate_rename_metadata.py
"""

import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

DATABASE_URL = os.getenv("LOCAL_DATABASE_URL")

if not DATABASE_URL:
    raise SystemExit("LOCAL_DATABASE_URL not set in .env")

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

try:
    # Check if the old column still exists
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'messages'
          AND column_name = 'metadata'
    """)
    old_exists = cur.fetchone()

    # Check if the new column already exists
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'messages'
          AND column_name = 'msg_metadata'
    """)
    new_exists = cur.fetchone()

    if new_exists:
        print("✓ 'msg_metadata' column already exists — nothing to do.")

    elif old_exists:
        print("Renaming 'metadata' → 'msg_metadata' on messages table...")
        cur.execute('ALTER TABLE messages RENAME COLUMN metadata TO msg_metadata')
        conn.commit()
        print("✓ Migration complete.")

    else:
        # Neither column exists — table may be missing entirely; let create_all handle it
        print("⚠ Neither 'metadata' nor 'msg_metadata' found.")
        print("  The messages table may not exist yet — starting the server will create it.")

except Exception as e:
    conn.rollback()
    raise SystemExit(f"Migration failed: {e}")

finally:
    cur.close()
    conn.close()
