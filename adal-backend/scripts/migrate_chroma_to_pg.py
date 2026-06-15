"""
Migrate ChromaDB legal_docs collection to PostgreSQL legal_library table.
Uses execute_batch with explicit vector string casting.
"""

import json
import os
import sqlite3
import time
import numpy as np
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_batch

PROJECT_ROOT = Path(__file__).parent.parent.parent
CHROMA_PATH = PROJECT_ROOT / "chroma_migrate_tmp"
DB_URL = os.getenv("LOCAL_DATABASE_URL", "postgresql://admin:password@127.0.0.1:5433/adalbot")
BATCH_SIZE = 50
DIM = 1024


def main():
    print("=" * 60)
    print("ChromaDB -> PostgreSQL Migration")
    print("=" * 60)

    sqlite_path = CHROMA_PATH / "chroma.sqlite3"
    conn_s = sqlite3.connect(str(sqlite_path))
    conn_s.row_factory = sqlite3.Row
    cur_s = conn_s.cursor()

    cur_s.execute("SELECT id, name, dimension FROM collections")
    coll = cur_s.fetchone()
    print(f"Collection: {coll['name']} ({coll['dimension']}-dim)")

    cur_s.execute("SELECT id FROM segments WHERE type LIKE '%vector%' LIMIT 1")
    seg = cur_s.fetchone()
    seg_dir = CHROMA_PATH / seg["id"]
    data_file = seg_dir / "data_level0.bin"
    print(f"data_level0.bin: {data_file.stat().st_size:,} bytes")

    cur_s.execute("SELECT COUNT(*), MAX(id), MIN(id) FROM embeddings")
    total, max_id, min_id = cur_s.fetchone()
    print(f"Embeddings: {total} rows, id range {min_id}-{max_id}")

    with open(data_file, "rb") as f:
        raw_data = f.read()
    total_floats = len(raw_data) // 4
    num_vectors = total_floats // DIM
    vector_bytes = num_vectors * DIM * 4
    print(f"Binary: {total_floats:,} floats = {num_vectors:,} vectors")

    embeddings = np.frombuffer(raw_data[:vector_bytes], dtype=np.float32)
    embeddings = embeddings.reshape(num_vectors, DIM)
    print(f"Loaded {num_vectors:,} embeddings")

    cur_s.execute("SELECT id, key, string_value, int_value FROM embedding_metadata ORDER BY id")
    meta_by_id = {}
    for r in cur_s.fetchall():
        doc_id = r["id"]
        if doc_id not in meta_by_id:
            meta_by_id[doc_id] = {}
        val = r["string_value"] if r["string_value"] is not None else r["int_value"]
        meta_by_id[doc_id][r["key"]] = val

    cur_s.execute("SELECT id, c0 FROM embedding_fulltext_search_content ORDER BY id")
    docs_by_id = {r["id"]: r["c0"] for r in cur_s.fetchall()}

    conn_s.close()

    # PostgreSQL - NO register_vector to avoid dimension lock
    conn_pg = psycopg2.connect(DB_URL)
    cur_p = conn_pg.cursor()
    cur_p.execute("CREATE EXTENSION IF NOT EXISTS vector")

    cur_p.execute("SELECT COUNT(*) FROM legal_library")
    before_count = cur_p.fetchone()[0]
    print(f"PostgreSQL legal_library before: {before_count} rows")

    # Force recreate table to reset vector dimension type
    print("Recreating legal_library table for 1024-dim vectors...")
    cur_p.execute("DROP TABLE IF EXISTS legal_library CASCADE")
    cur_p.execute("""
        CREATE TABLE legal_library (
            id SERIAL PRIMARY KEY,
            law_title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding vector,
            metadata JSONB
        )
    """)
    conn_pg.commit()
    print("Table recreated")

    inserted = 0
    skipped_no_embedding = 0
    skipped_no_content = 0
    rows = []
    start_time = time.time()

    for doc_id in sorted(meta_by_id.keys()):
        emb_idx = doc_id - 1
        if emb_idx < 0 or emb_idx >= num_vectors:
            skipped_no_embedding += 1
            continue

        doc_text = docs_by_id.get(doc_id, "")
        if not doc_text or not doc_text.strip():
            skipped_no_content += 1
            continue

        meta = meta_by_id[doc_id]
        law_name = meta.get("law_name", "Unknown")
        emb_str = "[" + ",".join(str(x) for x in embeddings[emb_idx].tolist()) + "]"

        url = f"/static/statutes/{meta.get('doc_type', 'statute')}/{law_name.lower().replace(' ', '_')}"
        metadata = json.dumps({
            "source": meta.get("doc_id", str(doc_id)),
            "url": url,
            "chunk_index": meta.get("chunk_index", 0),
            "section_number": meta.get("section_number"),
            "doc_type": meta.get("doc_type"),
            "law_name": law_name,
            "case_number": meta.get("case_number"),
            "court": meta.get("court"),
            "category": meta.get("category"),
        })

        rows.append((law_name, doc_text, emb_str, metadata))

        if len(rows) >= BATCH_SIZE:
            try:
                execute_batch(cur_p,
                    """INSERT INTO legal_library (law_title, content, embedding, metadata)
                       VALUES (%s, %s, %s::vector, %s)
                       ON CONFLICT DO NOTHING""",
                    rows,
                    page_size=BATCH_SIZE)
                conn_pg.commit()
                inserted += len(rows)
            except Exception as e:
                conn_pg.rollback()
                print(f"\nInsert error around doc {doc_id}: {e}")
            rows = []

        if inserted % 1000 == 0 and inserted > 0:
            elapsed = time.time() - start_time
            print(f"\rProgress: {inserted:,} docs ({elapsed:.0f}s)", end="")

    if rows:
        try:
            execute_batch(cur_p,
                """INSERT INTO legal_library (law_title, content, embedding, metadata)
                   VALUES (%s, %s, %s::vector, %s)
                   ON CONFLICT DO NOTHING""",
                rows,
                page_size=BATCH_SIZE)
            conn_pg.commit()
            inserted += len(rows)
        except Exception as e:
            conn_pg.rollback()
            print(f"\nFinal batch error: {e}")

    elapsed = time.time() - start_time
    print(f"\n\nMigration complete: {inserted:,} documents in {elapsed:.1f}s")
    print(f"  Skipped (no embedding): {skipped_no_embedding}")
    print(f"  Skipped (no content):   {skipped_no_content}")

    cur_p.execute("SELECT COUNT(*) FROM legal_library")
    final_count = cur_p.fetchone()[0]
    print(f"legal_library total: {final_count:,} rows")

    # Reconnect with register_vector to read back
    cur_p.close()
    conn_pg.close()

    conn_pg2 = psycopg2.connect(DB_URL)
    import pgvector.psycopg2
    pgvector.psycopg2.register_vector(conn_pg2)
    cur_p2 = conn_pg2.cursor()
    cur_p2.execute("SELECT embedding FROM legal_library WHERE embedding IS NOT NULL LIMIT 1")
    sample = cur_p2.fetchone()
    if sample:
        d = sample[0].shape[0] if hasattr(sample[0], "shape") else len(sample[0])
        print(f"Embedding dimension: {d}")
    cur_p2.close()
    conn_pg2.close()

    print("Done.")


if __name__ == "__main__":
    main()
