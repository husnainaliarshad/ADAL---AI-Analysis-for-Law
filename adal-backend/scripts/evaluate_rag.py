"""Evaluate RAG retrieval quality with test queries and ground truth."""
import json
import os
import sys
import math

# Add parent to path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sentence_transformers import SentenceTransformer
from sqlalchemy import create_engine, text

# Test queries with relevance judgments (1 = relevant, 0 = not relevant)
# Format: { "query": "...", "relevant_laws": ["law name substring 1", ...] }

TEST_QUERIES = [
    {
        "query": "What is the punishment for murder in Pakistan?",
        "relevant_terms": ["Penal Code", "murder", "homicide", "PPC", "Section 302"],
    },
    {
        "query": "Explain the requirements for a valid marriage contract",
        "relevant_terms": ["marriage", "Muslim Family", "nikah", "contract"],
    },
    {
        "query": "What are the grounds for divorce under Pakistani law?",
        "relevant_terms": ["divorce", "dissolution of marriage", "talaq", "family"],
    },
    {
        "query": "What are fundamental rights under the Constitution of Pakistan?",
        "relevant_terms": ["constitution", "fundamental rights", "Constitution of Pakistan"],
    },
    {
        "query": "Explain criminal procedure for filing an FIR",
        "relevant_terms": ["criminal", "FIR", "CrPC", "procedure", "investigation"],
    },
]


def is_relevant(chunk_title: str, chunk_content: str, relevant_terms: list) -> bool:
    """Check if a chunk matches any relevant term (case-insensitive)."""
    combined = (chunk_title + " " + chunk_content[:500]).lower()
    for term in relevant_terms:
        if term.lower() in combined:
            return True
    return False


def evaluate_retrieval(k: int = 5):
    """Run retrieval evaluation using the same setup as chat_service."""
    # Load model and connect to DB
    model = SentenceTransformer("BAAI/bge-m3")
    url = os.getenv("LOCAL_DATABASE_URL", "postgresql://admin:password@127.0.0.1:5433/adalbot")
    engine = create_engine(url, pool_size=3, pool_pre_ping=True)

    sql = text("""
        SELECT law_title, content,
               1 - (embedding <=> :qvec ::vector) AS similarity
        FROM legal_library
        WHERE 1 - (embedding <=> :qvec ::vector) > 0.5
        ORDER BY embedding <=> :qvec ::vector
        LIMIT :limit
    """)

    metrics = {
        "precision_at_k": [],
        "recall_at_k": [],
        "mrr": [],
        "queries_tested": 0,
    }

    print("=" * 60)
    print("ADAL RAG Retrieval Evaluation")
    print("=" * 60)

    for test in TEST_QUERIES:
        query = test["query"]
        relevant_terms = test["relevant_terms"]

        embedding = model.encode(query).tolist()
        vec_literal = "[" + ",".join(str(x) for x in embedding) + "]"

        with engine.connect() as conn:
            rows = conn.execute(sql, {"qvec": vec_literal, "limit": k}).fetchall()

        retrieved = [(row[0], row[1], float(row[2])) for row in rows]

        # Check relevance
        relevant_flags = []
        for title, content, sim in retrieved:
            relevant_flags.append(1 if is_relevant(title, content, relevant_terms) else 0)

        # Precision@K
        precision = sum(relevant_flags) / k if k > 0 else 0
        metrics["precision_at_k"].append(precision)

        # Recall estimation (assume 10 relevant exist in corpus)
        estimated_relevant = 10
        recall = sum(relevant_flags) / estimated_relevant if estimated_relevant > 0 else 0
        metrics["recall_at_k"].append(recall)

        # MRR
        mrr = 0
        for i, flag in enumerate(relevant_flags, 1):
            if flag == 1:
                mrr = 1.0 / i
                break
        metrics["mrr"].append(mrr)

        metrics["queries_tested"] += 1

        # Print per-query results
        print(f"\nQuery: {query[:80]}...")
        print(f"  Retrieved: {len(retrieved)} chunks")
        print(f"  Relevant:  {sum(relevant_flags)}/{len(retrieved)}")
        print(f"  Precision@{k}: {precision:.2f}")
        print(f"  MRR: {mrr:.3f}")
        for j, (title, content, sim) in enumerate(retrieved, 1):
            rel = "Y" if relevant_flags[j-1] else "N"
            print(f"    [{rel}] {title[:60]} (sim: {sim:.3f})")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    n = max(metrics["queries_tested"], 1)
    avg_precision = sum(metrics["precision_at_k"]) / n
    avg_recall = sum(metrics["recall_at_k"]) / n
    avg_mrr = sum(metrics["mrr"]) / n
    print(f"Average Precision@{k}: {avg_precision:.2f}")
    print(f"Average Recall@{k}:   {avg_recall:.2f}")
    print(f"Average MRR:          {avg_mrr:.3f}")
    print(f"Queries tested:       {metrics['queries_tested']}")
    print("=" * 60)

    engine.dispose()
    return metrics


if __name__ == "__main__":
    evaluate_retrieval(k=5)
