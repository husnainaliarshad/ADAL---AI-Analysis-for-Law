"""Validate legal_library data quality."""
import os
import sys
import psycopg2
import pgvector.psycopg2
from dotenv import load_dotenv

load_dotenv()


def validate_embeddings():
    url = os.getenv("LOCAL_DATABASE_URL", "postgresql://admin:password@127.0.0.1:5433/adalbot")

    try:
        conn = psycopg2.connect(url)
        pgvector.psycopg2.register_vector(conn)
        cur = conn.cursor()
    except Exception as e:
        print(f"Failed to connect: {e}")
        sys.exit(1)

    print("=" * 50)
    print("ADAL Embedding Validation Report")
    print("=" * 50)

    # 1. Row count
    cur.execute("SELECT COUNT(*) FROM legal_library")
    total = cur.fetchone()[0]
    print(f"\nTotal rows: {total}")

    if total == 0:
        print("No data found in legal_library. Nothing to validate.")
        cur.close()
        conn.close()
        return

    # 2. Empty/null embeddings
    cur.execute("SELECT COUNT(*) FROM legal_library WHERE embedding IS NULL")
    null_count = cur.fetchone()[0]
    status = "PASS" if null_count == 0 else "FAIL"
    print(f"\n[{status}] NULL embeddings: {null_count}")

    # 3. Embedding dimensions (sample first row)
    cur.execute("SELECT embedding FROM legal_library LIMIT 1")
    row = cur.fetchone()
    dim = row[0].shape[0] if hasattr(row[0], "shape") else len(row[0]) if row[0] is not None else 0
    print(f"\n[INFO] Embedding dimension: {dim}")

    # 4. Short content
    cur.execute("SELECT COUNT(*) FROM legal_library WHERE LENGTH(content) < 200")
    short_count = cur.fetchone()[0]
    status = "WARN" if short_count > 0 else "PASS"
    print(f"\n[{status}] Short chunks (<200 chars): {short_count}")

    # 5. Content length stats
    cur.execute("""
        SELECT MIN(LENGTH(content)), MAX(LENGTH(content)), AVG(LENGTH(content))
        FROM legal_library
    """)
    min_len, max_len, avg_len = cur.fetchone()
    print(f"\n[INFO] Content length: min={min_len}, max={max_len}, avg={avg_len:.0f}")

    # 6. Chunks per law_title
    cur.execute("""
        SELECT law_title, COUNT(*) as cnt
        FROM legal_library
        GROUP BY law_title
        ORDER BY cnt DESC
        LIMIT 20
    """)
    print("\nTop 20 law titles by chunk count:")
    for title, cnt in cur.fetchall():
        print(f"  {title}: {cnt}")

    # 7. Duplicate content check
    cur.execute("""
        SELECT COUNT(*) as dupes
        FROM (
            SELECT content, COUNT(*) as cnt
            FROM legal_library
            GROUP BY content
            HAVING COUNT(*) > 1
        ) sub
    """)
    dupes = cur.fetchone()[0]
    status = "WARN" if dupes > 0 else "PASS"
    print(f"\n[{status}] Duplicate content groups: {dupes}")

    cur.close()
    conn.close()

    print("\nValidation complete.")


if __name__ == "__main__":
    validate_embeddings()
