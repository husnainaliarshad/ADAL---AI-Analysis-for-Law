"""
Verification Service
Orchestrates the full verification pipeline: claim + evidence + LLM reasoning
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.claim_model import Claim
from app.models.evidence_model import Evidence
from app.models.citation_model import Citation
from app.services.evidence_service import (
    retrieve_evidence_for_claim,
    get_evidence_by_claim
)
from app.services.citation_service import get_citations_by_document
from app.services.citation_verification_service import verify_citation
from app.services.llm_service import verify_claim_with_llm


def verify_claim(
    local_db: Session,
    claim_id: int,
    retrieve_evidence: bool = True,
    k: int = 10,
    threshold: float = 0.3,
    index_name: str = "supreme_court_judgments"
) -> Dict:
    """
    Verify a claim using the full RAG pipeline.
    
    Verification reports are stored in Local PostgreSQL only (LLM verification data).
    
    Args:
        local_db: Local PostgreSQL database session
        claim_id: ID of the claim to verify
        retrieve_evidence: Whether to retrieve new evidence (True) or use existing (False)
        k: Number of evidence paragraphs to retrieve
        threshold: Similarity threshold for evidence retrieval
        index_name: FAISS index name
    
    Returns:
        Dictionary with verification results
    """
    # Get the claim from Local PostgreSQL
    claim = local_db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    # Get or retrieve evidence
    if retrieve_evidence:
        # Retrieve new evidence
        evidence_objects = retrieve_evidence_for_claim(
            local_db, claim_id, k=k, threshold=threshold, index_name=index_name
        )
    else:
        # Use existing evidence
        evidence_objects = get_evidence_by_claim(local_db, claim_id)
    
    if not evidence_objects:
        return {
            "claim_id": claim_id,
            "verdict": "insufficient_evidence",
            "confidence": 0.0,
            "reasoning": "No evidence found to verify this claim.",
            "evidence_count": 0,
            "citations_count": 0
        }
    
    # Extract evidence texts
    evidence_texts = [ev.paragraph_text for ev in evidence_objects]
    
    # Get and Verify citations for context
    citations = get_citations_by_document(local_db, claim.document_id)
    
    verified_citations = []
    # Verify top 3 citations to avoid blowing up the budget/time
    for cit in citations[:3]:
        try:
            v_res = verify_citation(local_db, cit.id)
            verified_citations.append(v_res)
        except Exception as e:
            logger.warning(f"Failed to verify citation {cit.id}: {e}")

    citation_dicts = [
        {
            "citation_text": cit.citation_text,
            "verdict": next((v["verdict"] for v in verified_citations if v.get("citation_id") == cit.id), "unknown"),
            "legal_text": next((v.get("legal_text_preview") for v in verified_citations if v.get("citation_id") == cit.id), "Not found")
        }
        for cit in citations[:5]
    ]
    
    # Verify with LLM
    try:
        llm_result = verify_claim_with_llm(
            claim_text=claim.claim_text,
            evidence_paragraphs=evidence_texts,
            citations=citation_dicts if citation_dicts else None
        )
        
        # Combine results
        result = {
            "claim_id": claim_id,
            "document_id": claim.document_id,  # Add document_id
            "claim_text": claim.claim_text,
            "verdict": llm_result["verdict"],
            "confidence": llm_result["confidence"],
            "reasoning": llm_result["reasoning"],
            "supporting_evidence": llm_result["supporting_evidence"],
            "contradicting_evidence": llm_result["contradicting_evidence"],
            "citations_used": llm_result["citations_used"],
            "citation_verifications": verified_citations,
            "evidence_count": len(evidence_objects),
            "citations_count": len(citations),
            "evidence_details": [
                {
                    "id": ev.id,
                    "relevance_score": ev.relevance_score,
                    "source_document": ev.source_document_filename,
                    "retrieval_rank": ev.retrieval_rank
                }
                for ev in evidence_objects
            ]
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM verification failed: {str(e)}"
        )


def verify_document_claims(
    local_db: Session,
    document_id: int,
    retrieve_evidence: bool = True,
    k: int = 10,
    threshold: float = 0.3,
    index_name: str = "supreme_court_judgments"
) -> Dict:
    """
    Verify all claims in a document.
    
    Verification reports are stored in Local PostgreSQL only (LLM verification data).
    
    Args:
        local_db: Local PostgreSQL database session
        document_id: ID of the document
        retrieve_evidence: Whether to retrieve new evidence
        k: Number of evidence paragraphs per claim
        threshold: Similarity threshold
        index_name: FAISS index name
    
    Returns:
        Dictionary with verification results for all claims
    """
    # Get all claims for the document from Local PostgreSQL
    claims = local_db.query(Claim).filter(Claim.document_id == document_id).all()
    
    if not claims:
        raise HTTPException(status_code=404, detail="No claims found for this document")
    
    # Verify each claim
    results = []
    for claim in claims:
        try:
            result = verify_claim(
                local_db, claim.id, retrieve_evidence, k, threshold, index_name
            )
            results.append(result)
        except Exception as e:
            # Continue with other claims if one fails
            results.append({
                "claim_id": claim.id,
                "verdict": "error",
                "confidence": 0.0,
                "reasoning": f"Verification failed: {str(e)}",
                "error": True
            })
    
    # Aggregate statistics
    verdict_counts = {}
    for result in results:
        verdict = result.get("verdict", "uncertain")
        verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
    
    return {
        "document_id": document_id,
        "total_claims": len(claims),
        "verified_claims": len([r for r in results if not r.get("error", False)]),
        "verdict_summary": verdict_counts,
        "results": results
    }

