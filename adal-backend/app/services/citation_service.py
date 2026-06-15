import re
import json
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.citation_model import Citation
from app.models.document_model import Document
from app.database.schemas import CitationCreate
from app.utils.database_helpers import (
    get_supabase_doc_id,
    create_supabase_citation_metadata
)

import os
from pathlib import Path
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

# 1. Get the base data directory from the environment
# 2. Default to the current directory's 'data' folder if the ENV is missing
# 3. Use .resolve() to turn it into a clean, absolute path
DATA_ROOT = Path(os.getenv("ADAL_DATA_DIR", "../Data")).resolve()

# 4. Now define the Citations directory relative to that root
CITATIONS_DIR = DATA_ROOT / "citations"

# 5. Create it if it doesn't exist
CITATIONS_DIR.mkdir(parents=True, exist_ok=True)

print(f"AdalBot Citations are being saved to: {CITATIONS_DIR}")

# Pakistani Legal Citation Patterns
# These patterns cover Pakistani legal citation formats

CITATION_PATTERNS = {
    # Named Pakistani statutes and instruments
    "pk_named_statute": {
        "pattern": r'\b([A-Z][A-Z\s,&().\'/-]{8,}?(?:ACT|ORDINANCE|CODE|RULES|REGULATIONS))\s*,?\s*(\d{4})\b',
        "type": "statute",
        "groups": ["act_name", "year"],
        "ignore_case": False,
        "example": "INDUSTRIAL RELATIONS ACT, 2012"
    },
    "pk_statutory_number": {
        "pattern": r'\b(?:ACT|ORDINANCE)\s+No\.\s*([A-Z0-9IVXLCDM-]+)\s+OF\s+(\d{4})\b',
        "type": "statute",
        "groups": ["act_number", "year"],
        "ignore_case": False,
        "example": "ORDINANCE No. IX OF 1984"
    },
    "pk_section_reference": {
        "pattern": r'\b(?:Section|Sec\.|S\.)\s*(\d{1,4}(?:[A-Z])?(?:\([a-z0-9]+\))*)\b',
        "type": "statute",
        "groups": ["section"],
        "example": "Section 25"
    },
    "pk_article_reference": {
        "pattern": r'\b(?:Article|Art\.)\s*(\d{1,3}(?:[A-Z])?(?:\([a-z0-9]+\))*)\b',
        "type": "statute",
        "groups": ["article"],
        "example": "Article 25"
    },
    "pk_chapter_reference": {
        "pattern": r'\b(?:Chapter|Ch\.)\s*[-–]?\s*([IVXLC0-9]+)\b',
        "type": "statute",
        "groups": ["chapter"],
        "example": "CHAPTER -II"
    },

    # PLD (Pakistan Law Digest) - Supreme Court
    "pld_sc": {
        "pattern": r'\bPLD\s+(\d{4})\s+SC\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "PLD 2025 SC 123"
    },
    # PLD - High Courts (Lahore, Karachi, Islamabad, Peshawar, Quetta)
    "pld_hc": {
        "pattern": r'\bPLD\s+(\d{4})\s+(Lah\.|Kar\.|Isl\.|Pes\.|Quetta)\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "court", "page"],
        "example": "PLD 2025 Lah. 321"
    },
    # PLD - Without court (general)
    "pld_general": {
        "pattern": r'\bPLD\s+(\d{4})\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "PLD 2025 123"
    },
    
    # SCMR (Supreme Court Monthly Review)
    "scmr": {
        "pattern": r'\b(\d{4})\s+SCMR\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 SCMR 456"
    },
    
    # YLR (Yearly Law Reporter)
    "ylr": {
        "pattern": r'\b(\d{4})\s+YLR\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 YLR 789"
    },
    
    # PLJ (Pakistan Legal Judgments)
    "plj": {
        "pattern": r'\b(\d{4})\s+PLJ\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 PLJ 123"
    },
    
    # MLD (Monthly Law Digest)
    "mld": {
        "pattern": r'\b(\d{4})\s+MLD\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 MLD 456"
    },
    
    # CLC (Civil Law Cases)
    "clc": {
        "pattern": r'\b(\d{4})\s+CLC\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 CLC 654"
    },
    
    # NLR (National Law Reporter)
    "nlr": {
        "pattern": r'\b(\d{4})\s+NLR\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 NLR 456"
    },
    
    # PCrLJ (Pakistan Criminal Law Journal)
    "pcrlj": {
        "pattern": r'\b(\d{4})\s+PCrLJ\s+(\d{1,4})',
        "type": "case",
        "groups": ["year", "page"],
        "example": "2025 PCrLJ 123"
    },
    
    # Case with Party names and Pakistani citation
    "pk_case_with_parties": {
        "pattern": r'\b([A-Z][a-zA-Z\s]+)\s+v\.\s+([A-Z][a-zA-Z\s]+)\s*,\s*(?:PLD|SCMR|YLR|PLJ|MLD|CLC|NLR|PCrLJ)\s+(\d{4})\s+(?:SC|Lah\.|Kar\.|Isl\.|Pes\.|Quetta)?\s*(\d{1,4})',
        "type": "case",
        "groups": ["party1", "party2", "year", "page"],
        "example": "State v. Khan, PLD 2025 SC 123"
    },
    
    # Statutes - Pakistan Penal Code
    "ppc": {
        "pattern": r'\bPakistan\s+Penal\s+Code\s*\([^)]+\)\s*,\s*S\.\s*(\d{1,4}(?:\([a-z]\))?(?:\([0-9]+\))?)',
        "type": "statute",
        "groups": ["section"],
        "example": "Pakistan Penal Code (XLV of 1860), S.302"
    },
    "ppc_short": {
        "pattern": r'\bPPC\s*,\s*S\.\s*(\d{1,4}(?:\([a-z]\))?(?:\([0-9]+\))?)',
        "type": "statute",
        "groups": ["section"],
        "example": "PPC, S.302"
    },
    
    # Statutes - Civil Procedure Code
    "cpc": {
        "pattern": r'\bCivil\s+Procedure\s+Code\s*\([^)]+\)\s*,\s*S\.\s*(\d{1,4}(?:\([a-z]\))?(?:\([0-9]+\))?)',
        "type": "statute",
        "groups": ["section"],
        "example": "Civil Procedure Code (V of 1908), S.115"
    },
    "cpc_short": {
        "pattern": r'\bCPC\s*,\s*S\.\s*(\d{1,4}(?:\([a-z]\))?(?:\([0-9]+\))?)',
        "type": "statute",
        "groups": ["section"],
        "example": "CPC, S.115"
    },
    
    # Statutes - General format (Act Name (Number of Year), S.Section)
    "pk_statute_general": {
        "pattern": r'\b([A-Z][a-zA-Z\s]+(?:Code|Act|Ordinance)?)\s*\(([A-Z]+(?:\s+of\s+)?\d{4})\)\s*,\s*S\.\s*(\d{1,4}(?:\([a-z]\))?(?:\([0-9]+\))?)',
        "type": "statute",
        "groups": ["act_name", "act_number", "section"],
        "example": "Criminal Procedure Code (V of 1898), S.154"
    },
    
    # Constitution of Pakistan
    "constitution": {
        "pattern": r'\bConstitution\s+of\s+Pakistan\s*,\s*Art\.\s*(\d{1,3}(?:\([a-z]\))?(?:\([0-9]+\))?)',
        "type": "statute",
        "groups": ["article"],
        "example": "Constitution of Pakistan, Art.25"
    },
    "constitution_short": {
        "pattern": r'\bArt\.\s*(\d{1,3}(?:\([a-z]\))?(?:\([0-9]+\))?)\s+of\s+the\s+Constitution',
        "type": "statute",
        "groups": ["article"],
        "example": "Art.25 of the Constitution"
    },
}

# Pakistani Court abbreviations
COURT_ABBREVIATIONS = {
    "sc": "Supreme Court of Pakistan",
    "lah.": "Lahore High Court",
    "kar.": "Karachi High Court",
    "isl.": "Islamabad High Court",
    "pes.": "Peshawar High Court",
    "quetta": "Balochistan High Court",
    "federal shariat court": "Federal Shariat Court",
    "supreme court": "Supreme Court of Pakistan",
    "lahore high court": "Lahore High Court",
    "karachi high court": "Karachi High Court",
    "islamabad high court": "Islamabad High Court",
    "peshawar high court": "Peshawar High Court",
    "balochistan high court": "Balochistan High Court",
}

# Pakistani Reporter abbreviations
REPORTER_ABBREVIATIONS = {
    "pld": "Pakistan Law Digest",
    "scmr": "Supreme Court Monthly Review",
    "ylr": "Yearly Law Reporter",
    "plj": "Pakistan Legal Judgments",
    "mld": "Monthly Law Digest",
    "clc": "Civil Law Cases",
    "nlr": "National Law Reporter",
    "pcrlj": "Pakistan Criminal Law Journal",
}


def extract_context(text: str, start: int, end: int, context_window: int = 100) -> str:
    """Extract surrounding context for a citation."""
    context_start = max(0, start - context_window)
    context_end = min(len(text), end + context_window)
    return text[context_start:context_end].strip()


def parse_year(text: str) -> Optional[int]:
    """Extract year from citation text."""
    year_match = re.search(r'\b(19|20)\d{2}\b', text)
    if year_match:
        return int(year_match.group())
    return None


def parse_jurisdiction(citation_text: str, citation_type: str) -> Optional[str]:
    """Determine jurisdiction from citation. For Pakistani laws, always returns 'PK'."""
    text_lower = citation_text.lower()
    
    # Pakistani indicators
    pakistani_indicators = [
        "pld", "scmr", "ylr", "plj", "mld", "clc", "nlr", "pcrlj",
        "pakistan penal code", "ppc", "civil procedure code", "cpc",
        "constitution of pakistan", "pakistan", "lah.", "kar.", "isl.", "pes."
    ]
    
    if any(indicator in text_lower for indicator in pakistani_indicators):
        return "PK"
    
    # Default to PK for all citations in this system
    return "PK"


def parse_court(citation_text: str, match_groups: Dict) -> Optional[str]:
    """Extract court name from citation."""
    text_lower = citation_text.lower()
    
    # Check match groups first (from regex patterns)
    if "court" in match_groups:
        court_abbrev = match_groups["court"].lower()
        # Map abbreviations to full names
        court_mapping = {
            "sc": "Supreme Court of Pakistan",
            "lah.": "Lahore High Court",
            "kar.": "Karachi High Court",
            "isl.": "Islamabad High Court",
            "pes.": "Peshawar High Court",
            "quetta": "Balochistan High Court",
        }
        if court_abbrev in court_mapping:
            return court_mapping[court_abbrev]
        return match_groups["court"]
    
    # Check for explicit court mentions in text
    for abbrev, full_name in COURT_ABBREVIATIONS.items():
        if abbrev in text_lower:
            return full_name
    
    # If SC is mentioned but not in match groups, infer Supreme Court
    if " sc " in text_lower or text_lower.startswith("sc ") or text_lower.endswith(" sc"):
        return "Supreme Court of Pakistan"
    
    return None


def parse_reporter(citation_text: str, match_groups: Dict) -> Optional[str]:
    """Extract reporter abbreviation from Pakistani citations."""
    text_lower = citation_text.lower()
    
    # Check common Pakistani reporter patterns
    for abbrev, full_name in REPORTER_ABBREVIATIONS.items():
        if abbrev in text_lower:
            return abbrev.upper()
    
    # Check match groups (though Pakistani patterns don't typically have reporter group)
    if "reporter" in match_groups:
        return match_groups["reporter"]
    
    return None


def determine_confidence(pattern_name: str, match: re.Match) -> str:
    """Determine confidence level based on pattern specificity for Pakistani citations."""
    high_confidence_patterns = [
        "pld_sc", "pld_hc", "scmr", "ppc", "cpc", "constitution", 
        "constitution_short", "ppc_short", "cpc_short"
    ]
    medium_confidence_patterns = [
        "pld_general", "ylr", "plj", "mld", "clc", "nlr", "pcrlj",
        "pk_statute_general"
    ]
    
    if pattern_name in high_confidence_patterns:
        return "high"
    elif pattern_name in medium_confidence_patterns:
        return "medium"
    else:
        return "low"


def detect_citations(text: str, document_id: int) -> List[Dict]:
    """
    Detect legal citations in text using regex patterns.
    
    Args:
        text: The text to search for citations
        document_id: ID of the document
        
    Returns:
        List of detected citations as dictionaries
    """
    citations = []
    seen_positions = set()  # To avoid duplicates
    
    for pattern_name, pattern_info in CITATION_PATTERNS.items():
        pattern = pattern_info["pattern"]
        citation_type = pattern_info["type"]
        group_names = pattern_info.get("groups", [])
        regex_flags = re.IGNORECASE if pattern_info.get("ignore_case", True) else 0
        
        for match in re.finditer(pattern, text, regex_flags):
            start_pos = match.start()
            end_pos = match.end()
            
            # Skip if we've already found a citation at this position
            position_key = (start_pos, end_pos)
            if position_key in seen_positions:
                continue
            seen_positions.add(position_key)
            
            citation_text = match.group(0)
            
            # Extract match groups
            match_groups = {}
            for i, group_name in enumerate(group_names, start=1):
                if i <= len(match.groups()):
                    match_groups[group_name] = match.group(i)
            
            # Parse citation components
            year = parse_year(citation_text)
            jurisdiction = parse_jurisdiction(citation_text, citation_type)
            court = parse_court(citation_text, match_groups)
            reporter = parse_reporter(citation_text, match_groups)
            confidence = determine_confidence(pattern_name, match)
            
            # For Pakistani citations, extract reporter from text if not found
            if not reporter:
                text_lower = citation_text.lower()
                for abbrev in REPORTER_ABBREVIATIONS.keys():
                    if abbrev in text_lower:
                        reporter = abbrev.upper()
                        break
            
            # Extract context
            context = extract_context(text, start_pos, end_pos)
            
            # For statutes, extract section/article number
            section_or_article = None
            if citation_type == "statute":
                section_or_article = (
                    match_groups.get("section")
                    or match_groups.get("article")
                    or match_groups.get("chapter")
                    or match_groups.get("act_number")
                )

            citation_data = {
                "document_id": document_id,
                "citation_text": citation_text,
                "citation_type": citation_type,
                "jurisdiction": jurisdiction or "PK",
                "year": year,
                "court": court,
                "volume": match_groups.get("volume"),
                "reporter": reporter or match_groups.get("reporter") or match_groups.get("act_name"),
                "page": match_groups.get("page") or match_groups.get("page2") or section_or_article,
                "position_start": start_pos,
                "position_end": end_pos,
                "context": context,
                "confidence_score": confidence,
            }
            
            citations.append(citation_data)
    
    # Sort by position in document
    citations.sort(key=lambda x: x["position_start"])
    
    return citations


def save_citations(
    local_db: Session, 
    citations: List[Dict], 
    document_id: int = None,
    supabase_db: Optional[Session] = None
) -> List[Citation]:
    """
    Save detected citations to Local PostgreSQL and create validation entries in Supabase.
    
    Args:
        local_db: Local PostgreSQL database session
        citations: List of citation dictionaries
        document_id: Document ID
        supabase_db: Optional Supabase database session
        
    Returns:
        List of Citation objects from Local PostgreSQL
    """
    db_citations = []
    supabase_doc_id = None
    
    # Get Supabase document ID if Supabase is available
    if supabase_db and document_id:
        try:
            supabase_doc_id = get_supabase_doc_id(document_id, local_db)
        except Exception as e:
            print(f"Warning: Could not get Supabase document ID: {e}")
    
    for citation_data in citations:
        # Save to Local PostgreSQL first
        db_citation = Citation(**citation_data)
        local_db.add(db_citation)
        local_db.flush()  # Get the IDs without committing
        
        # Create Supabase validation entry if Supabase is available
        if supabase_db and supabase_doc_id:
            try:
                # Convert confidence_score string to float if needed
                confidence = citation_data.get("confidence_score")
                if isinstance(confidence, str):
                    confidence_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
                    confidence = confidence_map.get(confidence.lower(), 0.5)
                
                supabase_citation_id = create_supabase_citation_metadata(
                    supabase_db=supabase_db,
                    local_citation_id=str(db_citation.local_citation_uuid),
                    document_id=supabase_doc_id,
                    citation_text_preview=citation_data.get("citation_text", "")[:200],
                    citation_type=citation_data.get("citation_type", "other"),
                    court=citation_data.get("court"),
                    year=citation_data.get("year"),
                    volume=citation_data.get("volume"),
                    reporter=citation_data.get("reporter"),
                    page=citation_data.get("page"),
                    jurisdiction=citation_data.get("jurisdiction", "PK"),
                    confidence_score=confidence,
                    case_name=None  # Could be extracted from citation_text if needed
                )
                
                # Link to Supabase
                db_citation.supabase_citation_id = supabase_citation_id
            except Exception as e:
                # Log but don't fail if Supabase creation fails
                print(f"Warning: Failed to create Supabase citation metadata: {e}")
                if supabase_db:
                    supabase_db.rollback()
        
        db_citations.append(db_citation)
    
    # Commit all citations at once
    local_db.commit()
    for db_citation in db_citations:
        local_db.refresh(db_citation)
    
    # Save citations to JSON file if document_id is provided
    if document_id and db_citations:
        citations_filename = f"document_{document_id}_citations.json"
        citations_file_path = CITATIONS_DIR / citations_filename
        
        citations_data = [{
            "id": c.id,
            "document_id": c.document_id,
            "citation_text": c.citation_text,
            "citation_type": c.citation_type,
            "jurisdiction": c.jurisdiction,
            "year": c.year,
            "court": c.court,
            "reporter": c.reporter,
            "page": c.page,
            "position_start": c.position_start,
            "position_end": c.position_end,
            "context": c.context,
            "confidence_score": c.confidence_score,
            "supabase_citation_id": str(c.supabase_citation_id) if c.supabase_citation_id else None,
            "created_at": c.created_at.isoformat() if c.created_at else None
        } for c in db_citations]
        
        with open(citations_file_path, "w", encoding="utf-8") as f:
            json.dump(citations_data, f, indent=2, ensure_ascii=False)
    
    return db_citations


def extract_citations_from_document(
    local_db: Session, 
    document_id: int,
    supabase_db: Optional[Session] = None
) -> List[Citation]:
    """
    Extract citations from a document's OCR text.
    
    Flow:
    1. Detect citations in Local PostgreSQL (where document content is)
    2. Save citations to Local PostgreSQL with position tracking
    3. Create validation entries in Supabase (if available)
    4. Link records via supabase_citation_id
    
    Args:
        local_db: Local PostgreSQL database session
        document_id: ID of the document
        supabase_db: Optional Supabase database session
        
    Returns:
        List of Citation objects from Local PostgreSQL
    """
    # Get document from Local PostgreSQL
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not document.ocr_text:
        raise HTTPException(status_code=400, detail="Document has no OCR text. Please extract text first.")
    
    # Check if citations already exist
    existing_citations = local_db.query(Citation).filter(Citation.document_id == document_id).all()
    if existing_citations:
        # Optionally: delete existing and re-detect, or return existing
        # For now, return existing citations
        return existing_citations
    
    # Detect citations
    citations_data = detect_citations(document.ocr_text, document_id)
    
    # Save to Local PostgreSQL and create Supabase entries
    if citations_data:
        citations = save_citations(local_db, citations_data, document_id, supabase_db)
        return citations
    
    return []


def get_citations_by_document(local_db: Session, document_id: int) -> List[Citation]:
    """Get all citations for a document from Local PostgreSQL."""
    return local_db.query(Citation).filter(Citation.document_id == document_id).all()


def get_citation_by_id(local_db: Session, citation_id: int) -> Citation:
    """Get a specific citation by ID from Local PostgreSQL."""
    citation = local_db.query(Citation).filter(Citation.id == citation_id).first()
    if not citation:
        raise HTTPException(status_code=404, detail="Citation not found")
    return citation


def delete_citations_by_document(
    local_db: Session, 
    document_id: int,
    supabase_db: Optional[Session] = None
) -> int:
    """
    Delete all citations for a document from both databases.
    
    Args:
        local_db: Local PostgreSQL database session
        document_id: Document ID
        supabase_db: Optional Supabase database session
        
    Returns:
        Number of citations deleted from Local PostgreSQL
    """
    # Get citations to delete (to get Supabase IDs)
    citations = local_db.query(Citation).filter(Citation.document_id == document_id).all()
    
    # Delete from Supabase if linked
    if supabase_db and citations:
        supabase_citation_ids = [
            str(c.supabase_citation_id) 
            for c in citations 
            if c.supabase_citation_id
        ]
        
        if supabase_citation_ids:
            try:
                from sqlalchemy import text
                for supabase_id in supabase_citation_ids:
                    supabase_db.execute(
                        text("DELETE FROM citations_metadata WHERE id = :id"),
                        {"id": supabase_id}
                    )
                supabase_db.commit()
            except Exception as e:
                print(f"Warning: Failed to delete Supabase citations: {e}")
                if supabase_db:
                    supabase_db.rollback()
    
    # Delete from Local PostgreSQL
    deleted_count = local_db.query(Citation).filter(Citation.document_id == document_id).delete()
    local_db.commit()
    return deleted_count
