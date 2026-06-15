"""
Verification API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth
from app.database.schemas import (
    ClaimVerificationResponse,
    DocumentVerificationResponse,
    VerificationReportResponse
)
from app.services.verification_service import (
    verify_claim,
    verify_document_claims
)
from app.services.report_service import (
    generate_verification_report,
    export_report_json,
    export_report_summary
)
from app.models.verification_report_model import VerificationReport
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/verification", tags=["Verification"], dependencies=[Depends(require_auth)])


# Request Models
class VerifyClaimRequest(BaseModel):
    retrieve_evidence: bool = True
    k: int = 10
    threshold: float = 0.3
    index_name: str = "supreme_court_judgments"


class VerifyDocumentRequest(BaseModel):
    retrieve_evidence: bool = True
    k: int = 10
    threshold: float = 0.3
    index_name: str = "supreme_court_judgments"


@router.post("/claims/{claim_id}", response_model=ClaimVerificationResponse)
async def verify_claim_endpoint(
    claim_id: int,
    request: VerifyClaimRequest,
    local_db: Session = Depends(get_local_db)
):
    """
    Verify a specific claim using LLM reasoning with retrieved evidence.
    
    Verification reports are stored in Local PostgreSQL only (LLM verification data).
    
    This endpoint:
    1. Retrieves evidence for the claim (or uses existing)
    2. Calls LLM to analyze claim + evidence
    3. Returns verification verdict and reasoning
    4. Saves report to Local PostgreSQL
    """
    try:
        result = verify_claim(
            local_db,
            claim_id,
            retrieve_evidence=request.retrieve_evidence,
            k=request.k,
            threshold=request.threshold,
            index_name=request.index_name
        )
        
        # Save report to Local PostgreSQL
        from app.services.llm_service import get_llm_provider, get_llm_model_name
        report = VerificationReport(
            document_id=result.get("document_id", 0),
            claim_id=claim_id,
            report_data=result,
            verification_status="completed",
            llm_provider="ollama",  # Always Ollama now
            llm_model=get_llm_model_name(),
            evidence_count=result.get("evidence_count", 0),
            citations_count=result.get("citations_count", 0)
        )
        local_db.add(report)
        local_db.commit()
        local_db.refresh(report)
        
        return ClaimVerificationResponse(
            claim_id=claim_id,
            verdict=result["verdict"],
            confidence=result["confidence"],
            reasoning=result["reasoning"],
            supporting_evidence=result.get("supporting_evidence", []),
            contradicting_evidence=result.get("contradicting_evidence", []),
            citations_used=result.get("citations_used", []),
            evidence_count=result.get("evidence_count", 0),
            citations_count=result.get("citations_count", 0)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.post("/documents/{document_id}", response_model=DocumentVerificationResponse)
async def verify_document_endpoint(
    document_id: int,
    request: VerifyDocumentRequest,
    local_db: Session = Depends(get_local_db)
):
    """
    Verify all claims in a document.
    
    Verification reports are stored in Local PostgreSQL only (LLM verification data).
    
    This endpoint verifies each claim in the document and returns
    aggregated results.
    """
    try:
        result = verify_document_claims(
            local_db,
            document_id,
            retrieve_evidence=request.retrieve_evidence,
            k=request.k,
            threshold=request.threshold,
            index_name=request.index_name
        )
        
        return DocumentVerificationResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@router.get("/reports/{report_id}", response_model=VerificationReportResponse)
async def get_verification_report(
    report_id: int,
    local_db: Session = Depends(get_local_db)
):
    """Get a specific verification report by ID from Local PostgreSQL."""
    report = local_db.query(VerificationReport).filter(VerificationReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Verification report not found")
    return VerificationReportResponse.model_validate(report)


@router.get("/claims/{claim_id}/reports", response_model=list[VerificationReportResponse])
async def get_claim_verification_reports(
    claim_id: int,
    local_db: Session = Depends(get_local_db)
):
    """Get all verification reports for a claim from Local PostgreSQL."""
    reports = local_db.query(VerificationReport).filter(
        VerificationReport.claim_id == claim_id
    ).order_by(VerificationReport.created_at.desc()).all()
    return [VerificationReportResponse.model_validate(r) for r in reports]


@router.get("/documents/{document_id}/reports", response_model=list[VerificationReportResponse])
async def get_document_verification_reports(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """Get all verification reports for a document from Local PostgreSQL."""
    reports = local_db.query(VerificationReport).filter(
        VerificationReport.document_id == document_id
    ).order_by(VerificationReport.created_at.desc()).all()
    return [VerificationReportResponse.model_validate(r) for r in reports]


@router.get("/documents/{document_id}/report", response_class=JSONResponse)
async def generate_document_report(
    document_id: int,
    include_evidence: bool = Query(True, description="Include evidence paragraphs"),
    include_citations: bool = Query(True, description="Include citations"),
    local_db: Session = Depends(get_local_db)
):
    """
    Generate a comprehensive verification report for a document.
    
    All data is retrieved from Local PostgreSQL (verification reports, claims, evidence, citations).
    
    This endpoint compiles all verification results, claims, evidence, and citations
    into a structured report.
    """
    try:
        report = generate_verification_report(
            local_db, document_id, include_evidence, include_citations
        )
        return JSONResponse(content=report)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/documents/{document_id}/report/export/json", response_class=JSONResponse)
async def export_report_json_endpoint(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """Export verification report as JSON from Local PostgreSQL."""
    try:
        report = export_report_json(local_db, document_id)
        return JSONResponse(content=report)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/documents/{document_id}/report/export/text", response_class=PlainTextResponse)
async def export_report_text_endpoint(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """Export verification report as formatted text summary from Local PostgreSQL."""
    try:
        summary = export_report_summary(local_db, document_id)
        return PlainTextResponse(content=summary)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

