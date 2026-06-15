"""
Reranking utility using cross-encoder for improving retrieval quality.

A cross-encoder evaluates query-document pairs directly (joint encoding),
providing more accurate relevance scores than bi-encoder cosine similarity.
"""

import logging
from typing import List

logger = logging.getLogger(__name__)

_reranker = None


def _get_reranker():
    """Lazy-load the cross-encoder reranker."""
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder

        logger.info("Loading cross-encoder reranker: ms-marco-MiniLM-L-6-v2")
        _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _reranker


def rerank_results(query: str, results: List[dict], top_k: int = 3) -> List[dict]:
    """
    Rerank retrieved results using a cross-encoder.

    Args:
        query: The user's search query.
        results: List of dicts with 'content' key.
        top_k: Number of top results to return after reranking.

    Returns:
        Reranked results ordered by cross-encoder score descending.
    """
    if not results:
        return results

    reranker = _get_reranker()
    pairs = [(query, r["content"]) for r in results]

    try:
        scores = reranker.predict(pairs)
    except Exception as e:
        logger.warning("Reranker failed: %s, returning original order", e)
        return results[:top_k]

    scored_results = list(zip(scores, results))
    scored_results.sort(key=lambda x: x[0], reverse=True)

    for score, result in scored_results[:top_k]:
        result["rerank_score"] = float(score)

    return [r for _, r in scored_results[:top_k]]
