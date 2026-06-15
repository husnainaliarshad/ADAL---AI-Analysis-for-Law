from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime

# Citation Schemas
class CitationBase(BaseModel):
    citation_text: str
    citation_type: str
    jurisdiction: Optional[str] = None
    year: Optional[int] = None
    court: Optional[str] = None
    volume: Optional[str] = None
    reporter: Optional[str] = None
    page: Optional[str] = None
    position_start: int
    position_end: int
    context: Optional[str] = None
    confidence_score: Optional[str] = None

class CitationCreate(CitationBase):
    document_id: int

class CitationResponse(CitationBase):
    id: int
    document_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Document Citation Response
class DocumentCitationsResponse(BaseModel):
    document_id: int
    total_citations: int
    citations: list[CitationResponse]


# Claim Schemas
class ClaimBase(BaseModel):
    claim_text: str
    claim_type: Optional[str] = None
    position_start: int
    position_end: int
    confidence_score: Optional[float] = None


class ClaimCreate(ClaimBase):
    document_id: int


class ClaimResponse(ClaimBase):
    id: int
    document_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Document Claims Response
class DocumentClaimsResponse(BaseModel):
    document_id: int
    total_claims: int
    claims: list[ClaimResponse]


# Claim-Citation Mapping Schemas
class ClaimCitationMappingBase(BaseModel):
    relationship_type: Optional[str] = None
    confidence_score: Optional[float] = None


class ClaimCitationMappingCreate(ClaimCitationMappingBase):
    claim_id: int
    citation_id: int


class ClaimCitationMappingResponse(ClaimCitationMappingBase):
    id: int
    claim_id: int
    citation_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Evidence Schemas
class EvidenceBase(BaseModel):
    paragraph_text: str
    position_start: Optional[int] = None
    position_end: Optional[int] = None
    relevance_score: Optional[float] = None
    source_document_filename: Optional[str] = None
    source_index_name: Optional[str] = None
    source_chunk_index: Optional[int] = None
    retrieval_rank: Optional[int] = None


class EvidenceCreate(EvidenceBase):
    document_id: int
    claim_id: Optional[int] = None
    source_citation_id: Optional[int] = None


class EvidenceResponse(EvidenceBase):
    id: int
    document_id: int
    claim_id: Optional[int] = None
    source_citation_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Document Evidence Response
class DocumentEvidenceResponse(BaseModel):
    document_id: int
    total_evidence: int
    evidence: list[EvidenceResponse]


# Claim Evidence Response
class ClaimEvidenceResponse(BaseModel):
    claim_id: int
    total_evidence: int
    evidence: list[EvidenceResponse]


# Verification Schemas
class VerificationResult(BaseModel):
    claim_id: int
    claim_text: Optional[str] = None
    verdict: str  # supported, contradicted, insufficient_evidence, uncertain
    confidence: float  # 0.0-1.0
    reasoning: str
    supporting_evidence: List[str] = []
    contradicting_evidence: List[str] = []
    citations_used: List[str] = []
    evidence_count: int = 0
    citations_count: int = 0
    evidence_details: Optional[List[Dict]] = None


class ClaimVerificationResponse(BaseModel):
    claim_id: int
    verdict: str
    confidence: float
    reasoning: str
    supporting_evidence: List[str]
    contradicting_evidence: List[str]
    citations_used: List[str]
    evidence_count: int
    citations_count: int


class DocumentVerificationResponse(BaseModel):
    document_id: int
    total_claims: int
    verified_claims: int
    verdict_summary: Dict[str, int]
    results: List[VerificationResult]


class VerificationReportResponse(BaseModel):
    id: int
    document_id: int
    claim_id: Optional[int] = None
    report_data: Dict
    verification_status: str
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    evidence_count: Optional[int] = None
    citations_count: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)