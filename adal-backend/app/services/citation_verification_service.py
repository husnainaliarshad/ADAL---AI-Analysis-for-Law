import logging
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.citation_model import Citation
from app.services.vector_retrieval_service import _get_vector_engine, search_legal_library
from app.services.llm_service import verify_claim_with_llm

logger = logging.getLogger(__name__)

def verify_citation(db: Session, citation_id: int) -> Dict:
    """
    Verify a citation by looking up the actual legal text in the legal_library.
    
    Steps:
    1. Retrieve the citation from the local DB.
    2. Search for the actual legal text in the pgvector legal_library table.
    3. Use LLM to cross-reference the document context with the actual law.
    """
    citation = db.query(Citation).filter(Citation.id == citation_id).first()
    if not citation:
        return {"error": "Citation not found"}

    engine = _get_vector_engine()
    found_law = None
    legal_text = ""
    law_title = ""

    # 1. Search for the law/section in legal_library
    try:
        if citation.citation_type == "statute":
            # Search by law name and section number in metadata
            # We use ILIKE for law name to handle minor variations
            sql = text("""
                SELECT content, law_title, metadata
                FROM legal_library
                WHERE metadata->>'doc_type' = 'statute'
                AND (law_title ILIKE :law OR metadata->>'law_name' ILIKE :law)
                AND metadata->>'section_number' = :section
                LIMIT 1
            """)
            # reporter usually contains the act name, page contains the section/article
            law_query = f"%{citation.reporter}%" if citation.reporter else f"%{citation.citation_text}%"
            section_query = citation.page or ""
            
            with engine.connect() as conn:
                row = conn.execute(sql, {"law": law_query, "section": section_query}).fetchone()
                if row:
                    legal_text, law_title, metadata = row
                    if not law_title:
                        law_title = metadata.get("law_name", "Statute")

        if not legal_text and citation.citation_type == "case":
            # Search for judgments using vector similarity on the citation string
            results = search_legal_library(citation.citation_text, k=1, threshold=0.5, doc_type_filter="judgement")
            if results:
                legal_text = results[0]["content"]
                law_title = results[0]["law_title"] or results[0]["metadata"].get("source", "Judgment")

        # Fallback: Keyword search in content
        if not legal_text:
            sql = text("""
                SELECT content, law_title, metadata
                FROM legal_library
                WHERE content ILIKE :query
                LIMIT 1
            """)
            # Look for the citation text or a portion of it
            search_query = f"%{citation.citation_text}%"
            with engine.connect() as conn:
                row = conn.execute(sql, {"query": search_query}).fetchone()
                if row:
                    legal_text, law_title, metadata = row
                    if not law_title:
                        law_title = metadata.get("law_name", metadata.get("source", "Legal Source"))

    except Exception as e:
        logger.error(f"Error searching legal library for citation {citation_id}: {e}")

    if not legal_text:
        return {
            "citation_id": citation_id,
            "verdict": "not_found",
            "reasoning": "Could not find the text for this citation in the legal library. It may be missing from our database.",
            "citation_text": citation.citation_text
        }

    # 2. Use LLM to verify if the document context matches the actual law
    try:
        # We ask the LLM to verify if the claim made in the document (context) 
        # is actually what the law (legal_text) says.
        prompt_context = f"The document uses the citation '{citation.citation_text}' in this context: '{citation.context}'"
        
        llm_result = verify_claim_with_llm(
            claim_text=prompt_context,
            evidence_paragraphs=[legal_text],
            system_prompt="""You are a Pakistani legal expert. 
            Compare the 'context' (how the citation is used in a document) with the 'actual law' provided.
            Determine if the document accurately represents the law.
            Verdicts: 'supported' (matches), 'contradicted' (misrepresented), 'uncertain' (unclear).
            Respond in JSON."""
        )
        
        return {
            "citation_id": citation_id,
            "citation_text": citation.citation_text,
            "verdict": llm_result["verdict"],
            "confidence": llm_result["confidence"],
            "reasoning": llm_result["reasoning"],
            "legal_text_preview": legal_text[:500] + "...",
            "found_in_library": True,
            "law_title": law_title
        }
    except Exception as e:
        logger.error(f"LLM verification failed for citation {citation_id}: {e}")
        return {
            "citation_id": citation_id,
            "verdict": "error",
            "reasoning": f"Verification process failed: {str(e)}",
            "citation_text": citation.citation_text
        }
