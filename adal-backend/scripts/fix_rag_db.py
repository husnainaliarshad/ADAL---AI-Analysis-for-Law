"""Fix critical issues in the migrated RAG database. Uses HNSW index (lower memory)."""
import psycopg2
import time

DB_URL = 'postgresql://admin:password@127.0.0.1:5433/adalbot'

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

print("=" * 50)
print("Fixing RAG Database")
print("=" * 50)

# 1. HNSW index (less memory during build than IVFFlat)
print("\n1. Creating HNSW vector index...")
cur.execute("DROP INDEX IF EXISTS idx_legal_library_embedding")
conn.commit()
start = time.time()
cur.execute("""
    CREATE INDEX idx_legal_library_embedding
    ON legal_library
    USING hnsw ((embedding::vector(1024)) vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
""")
conn.commit()
print(f"   HNSW index created in {time.time() - start:.1f}s")

# 2. Fix empty law_titles
print("\n2. Fixing empty law_titles...")
cur.execute("SELECT COUNT(*) FROM legal_library WHERE law_title = '' OR law_title IS NULL")
empty = cur.fetchone()[0]
print(f"   Empty before: {empty}")

cur.execute("""
    UPDATE legal_library
    SET law_title = COALESCE(metadata->>'law_name', metadata->>'source', 'Unknown Statute')
    WHERE law_title = '' OR law_title IS NULL
""")
conn.commit()

cur.execute("SELECT COUNT(*) FROM legal_library WHERE law_title = '' OR law_title IS NULL")
print(f"   Empty after: {cur.fetchone()[0]}")

# 3. Remove very short docs
cur.execute("DELETE FROM legal_library WHERE LENGTH(content) < 50")
conn.commit()
cur.execute("SELECT COUNT(*) FROM legal_library WHERE LENGTH(content) < 50")
print(f"\n3. Very short docs: {cur.fetchone()[0]}")

# 4. Final stats
cur.execute("SELECT COUNT(*), COUNT(DISTINCT law_title) FROM legal_library")
total, distinct = cur.fetchone()
print(f"\nFinal: {total} rows, {distinct} distinct titles")

cur.execute("SELECT law_title, COUNT(*) FROM legal_library GROUP BY law_title ORDER BY COUNT(*) DESC LIMIT 10")
print("Top 10:")
for r in cur.fetchall():
    print(f"  {str(r[0])[:70]}: {r[1]}")

# Verify index exists
cur.execute("SELECT indexname FROM pg_indexes WHERE tablename = 'legal_library' AND indexname LIKE '%embedding%'")
idx = cur.fetchone()
print(f"\nVector index: {'PRESENT' if idx else 'MISSING'}")

cur.close()
conn.close()
print("\nDone.")
