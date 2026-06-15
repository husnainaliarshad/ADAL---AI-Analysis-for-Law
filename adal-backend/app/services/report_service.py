"""
Report Generation Service
Formats and compiles verification reports
"""
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.verification_report_model import VerificationReport
from app.models.claim_model import Claim
from app.models.evidence_model import Evidence
from app.models.citation_model import Citation
from app.models.document_model import Document


def generate_verification_report(
    local_db: Session,
    document_id: int,
    include_evidence: bool = True,
    include_citations: bool = True
) -> Dict:
    """
    Generate a comprehensive verification report for a document.
    
    All data is retrieved from Local PostgreSQL (verification reports, claims, evidence, citations).
    
    Args:
        local_db: Local PostgreSQL database session
        document_id: Document ID
        include_evidence: Whether to include evidence paragraphs
        include_citations: Whether to include citations
    
    Returns:
        Formatted report dictionary
    """
    # Get document from Local PostgreSQL
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError("Document not found")
    
    # Get all verification reports for this document from Local PostgreSQL
    reports = local_db.query(VerificationReport).filter(
        VerificationReport.document_id == document_id
    ).order_by(VerificationReport.created_at.desc()).all()
    
    if not reports:
        return {
            "document_id": document_id,
            "document_filename": document.filename,
            "status": "no_reports",
            "message": "No verification reports found for this document"
        }
    
    # Get claims from Local PostgreSQL
    claims = local_db.query(Claim).filter(Claim.document_id == document_id).all()
    
    # Compile report data
    report_data = {
        "document_id": document_id,
        "document_filename": document.filename,
        "generated_at": datetime.utcnow().isoformat(),
        "total_claims": len(claims),
        "total_verifications": len(reports),
        "verification_summary": _compile_verification_summary(reports),
        "claims": []
    }
    
    # Add claim details with verification results
    for claim in claims:
        # Get latest verification for this claim
        claim_report = next(
            (r for r in reports if r.claim_id == claim.id),
            None
        )
        
        claim_data = {
            "claim_id": claim.id,
            "claim_text": claim.claim_text,
            "claim_type": claim.claim_type,
            "position": {
                "start": claim.position_start,
                "end": claim.position_end
            }
        }
        
        if claim_report:
            report_result = claim_report.report_data
            claim_data["verification"] = {
                "verdict": report_result.get("verdict", "uncertain"),
                "confidence": report_result.get("confidence", 0.0),
                "reasoning": report_result.get("reasoning", ""),
                "verified_at": claim_report.created_at.isoformat() if claim_report.created_at else None,
                "llm_model": claim_report.llm_model
            }
            
            # Add evidence if requested
            if include_evidence:
                evidence = local_db.query(Evidence).filter(
                    Evidence.claim_id == claim.id
                ).order_by(Evidence.relevance_score.desc()).all()
                
                claim_data["evidence"] = [
                    {
                        "id": ev.id,
                        "paragraph_text": ev.paragraph_text[:500] + "..." if len(ev.paragraph_text) > 500 else ev.paragraph_text,
                        "relevance_score": ev.relevance_score,
                        "source_document": ev.source_document_filename
                    }
                    for ev in evidence[:5]  # Top 5 evidence
                ]
            
            # Add citations if requested
            if include_citations:
                from app.services.citation_service import get_citations_by_document
                citations = get_citations_by_document(local_db, document_id)
                claim_citations = [
                    {
                        "id": cit.id,
                        "citation_text": cit.citation_text,
                        "citation_type": cit.citation_type,
                        "jurisdiction": cit.jurisdiction
                    }
                    for cit in citations
                    if (claim.position_start and cit.position_start and claim.position_end and
                        claim.position_start <= cit.position_start <= claim.position_end)
                ]
                claim_data["citations"] = claim_citations
        else:
            claim_data["verification"] = {
                "status": "not_verified",
                "message": "No verification report available for this claim"
            }
        
        report_data["claims"].append(claim_data)
    
    return report_data


def _compile_verification_summary(reports: List[VerificationReport]) -> Dict:
    """Compile summary statistics from verification reports."""
    verdict_counts = {
        "supported": 0,
        "contradicted": 0,
        "insufficient_evidence": 0,
        "uncertain": 0
    }
    
    total_confidence = 0.0
    verified_count = 0
    
    for report in reports:
        if report.report_data:
            verdict = report.report_data.get("verdict", "uncertain")
            if verdict in verdict_counts:
                verdict_counts[verdict] += 1
            
            confidence = report.report_data.get("confidence", 0.0)
            if confidence > 0:
                total_confidence += confidence
                verified_count += 1
    
    avg_confidence = total_confidence / verified_count if verified_count > 0 else 0.0
    
    return {
        "verdict_distribution": verdict_counts,
        "average_confidence": round(avg_confidence, 2),
        "total_verified": verified_count,
        "latest_verification": reports[0].created_at.isoformat() if reports else None
    }


def export_report_json(
    local_db: Session,
    document_id: int
) -> Dict:
    """Export verification report as JSON."""
    return generate_verification_report(
        local_db, document_id, include_evidence=True, include_citations=True
    )


def export_report_summary(
    local_db: Session,
    document_id: int
) -> str:
    """Export verification report as formatted text summary."""
    report = generate_verification_report(
        local_db, document_id, include_evidence=False, include_citations=False
    )
    
    summary = f"""
VERIFICATION REPORT
{'=' * 60}
Document: {report['document_filename']}
Document ID: {report['document_id']}
Generated: {report['generated_at']}

SUMMARY
{'-' * 60}
Total Claims: {report['total_claims']}
Total Verifications: {report['total_verifications']}

Verdict Distribution:
  Supported: {report['verification_summary']['verdict_distribution']['supported']}
  Contradicted: {report['verification_summary']['verdict_distribution']['contradicted']}
  Insufficient Evidence: {report['verification_summary']['verdict_distribution']['insufficient_evidence']}
  Uncertain: {report['verification_summary']['verdict_distribution']['uncertain']}

Average Confidence: {report['verification_summary']['average_confidence']}

CLAIMS
{'-' * 60}
"""
    
    for claim in report['claims']:
        summary += f"\nClaim {claim['claim_id']}: {claim['claim_text'][:100]}...\n"
        if 'verification' in claim and 'verdict' in claim['verification']:
            summary += f"  Verdict: {claim['verification']['verdict']}\n"
            summary += f"  Confidence: {claim['verification']['confidence']}\n"
            summary += f"  Reasoning: {claim['verification']['reasoning'][:200]}...\n"
        summary += "\n"
    
    return summary

