"""
Hybrid search combining vector similarity with keyword matching (BM25).

This improves retrieval by finding documents that share exact legal terminology
even when vector similarity alone is insufficient.
"""

import logging
import math
from typing import Dict, List

logger = logging.getLogger(__name__)

# BM25 parameters
BM25_K1 = 1.5
BM25_B = 0.75


def _tokenize(text: str) -> List[str]:
    """Simple whitespace tokenization with lowercasing."""
    return text.lower().split()


def _compute_bm25(
    query: str,
    corpus: List[Dict],
    avg_doc_len: float,
    doc_lengths: List[int],
    doc_freq: Dict[str, int],
    corpus_size: int,
) -> List[float]:
    """Compute BM25 scores for all documents against a query."""
    query_terms = _tokenize(query)
    scores = []

    for i, doc in enumerate(corpus):
        doc_text = doc.get("content", "")
        doc_terms = _tokenize(doc_text)
        doc_len = doc_lengths[i]
        term_freq = {}
        for t in doc_terms:
            term_freq[t] = term_freq.get(t, 0) + 1

        score = 0.0
        for term in query_terms:
            if term not in doc_freq:
                continue
            tf = term_freq.get(term, 0)
            df = doc_freq[term]
            idf = math.log((corpus_size - df + 0.5) / (df + 0.5) + 1.0)
            numerator = tf * (BM25_K1 + 1.0)
            denominator = tf + BM25_K1 * (1.0 - BM25_B + BM25_B * doc_len / avg_doc_len)
            score += idf * numerator / denominator

        scores.append(score)

    return scores


def _normalize(scores: List[float]) -> List[float]:
    """Min-max normalize a list of scores."""
    if not scores:
        return scores
    mn, mx = min(scores), max(scores)
    if mx == mn:
        return [0.5] * len(scores)
    return [(s - mn) / (mx - mn) for s in scores]


def hybrid_search(
    query: str,
    vector_results: List[Dict],
    keyword_weight: float = 0.3,
    top_k: int = 5,
) -> List[Dict]:
    """
    Combine vector similarity with BM25 keyword matching.

    Args:
        query: The search query.
        vector_results: Results from vector search with 'similarity' key.
        keyword_weight: Weight for BM25 score (0.0 = pure vector, 1.0 = pure BM25).
        top_k: Number of results to return.

    Returns:
        Results sorted by combined score, with 'hybrid_score' added.
    """
    if not vector_results:
        return vector_results

    corpus_size = len(vector_results)
    doc_lengths = [len(_tokenize(r.get("content", ""))) for r in vector_results]
    avg_doc_len = sum(doc_lengths) / corpus_size if corpus_size > 0 else 1.0

    # Build document frequency index
    doc_freq: Dict[str, int] = {}
    for result in vector_results:
        seen = set()
        for term in _tokenize(result.get("content", "")):
            if term not in seen:
                seen.add(term)
                doc_freq[term] = doc_freq.get(term, 0) + 1

    # Compute BM25 scores
    bm25_scores = _compute_bm25(query, vector_results, avg_doc_len, doc_lengths, doc_freq, corpus_size)

    # Normalize both score types
    norm_bm25 = _normalize(bm25_scores)
    norm_vector = _normalize([r.get("similarity", 0) for r in vector_results])

    # Combine
    for i, result in enumerate(vector_results):
        result["bm25_score"] = round(norm_bm25[i], 4) if i < len(norm_bm25) else 0.0
        result["hybrid_score"] = round(
            (1 - keyword_weight) * norm_vector[i] + keyword_weight * norm_bm25[i],
            4,
        )

    # Sort by hybrid score
    combined = sorted(vector_results, key=lambda r: r.get("hybrid_score", 0), reverse=True)

    return combined[:top_k]
