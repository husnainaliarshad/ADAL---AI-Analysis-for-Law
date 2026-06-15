"""
Database Helper Utilities for Multi-Database Operations

Helper functions for common cross-database operations.
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import os


def get_supabase_doc_id(local_doc_id: int, local_db: Session) -> Optional[str]:
    """
    Get Supabase document ID from Local PostgreSQL document ID.
    
    Args:
        local_doc_id: Local PostgreSQL document ID
        local_db: Local PostgreSQL database session
        
    Returns:
        Supabase document UUID as string, or None if not linked
    """
    result = local_db.execute(
        text("SELECT supabase_document_id FROM documents WHERE id = :id"),
        {"id": local_doc_id}
    )
    row = result.fetchone()
    return str(row[0]) if row and row[0] else None


def get_local_doc_id(supabase_doc_id: str, local_db: Session) -> Optional[int]:
    """
    Get Local PostgreSQL document ID from Supabase document ID.
    
    Args:
        supabase_doc_id: Supabase document UUID as string
        local_db: Local PostgreSQL database session
        
    Returns:
        Local PostgreSQL document ID, or None if not found
    """
    result = local_db.execute(
        text("SELECT id FROM documents WHERE supabase_document_id = :supabase_id"),
        {"supabase_id": supabase_doc_id}
    )
    row = result.fetchone()
    return row[0] if row else None


def get_supabase_citation_id(local_citation_id: int, local_db: Session) -> Optional[str]:
    """
    Get Supabase citation ID from Local PostgreSQL citation ID.
    
    Args:
        local_citation_id: Local PostgreSQL citation ID
        local_db: Local PostgreSQL database session
        
    Returns:
        Supabase citation UUID as string, or None if not linked
    """
    result = local_db.execute(
        text("SELECT supabase_citation_id FROM citations WHERE id = :id"),
        {"id": local_citation_id}
    )
    row = result.fetchone()
    return str(row[0]) if row and row[0] else None


def get_supabase_user_id(local_user_id: int, local_db: Session) -> Optional[str]:
    """
    Get Supabase user ID from Local PostgreSQL user ID.
    
    Args:
        local_user_id: Local PostgreSQL user ID
        local_db: Local PostgreSQL database session
        
    Returns:
        Supabase user UUID as string, or None if not linked
    """
    result = local_db.execute(
        text("SELECT supabase_user_id FROM users WHERE id = :id"),
        {"id": local_user_id}
    )
    row = result.fetchone()
    return str(row[0]) if row and row[0] else None


def create_supabase_document_metadata(
    supabase_db: Session,
    local_document_id: str,
    filename: str,
    file_size: int,
    mime_type: str,
    user_id: str,
    organization_id: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None
) -> str:
    """
    Create document metadata in Supabase.
    
    Args:
        supabase_db: Supabase database session
        filename: File name
        file_size: File size in bytes
        mime_type: MIME type of the file
        user_id: Optional Supabase user UUID
        organization_id: Optional organization UUID
        title: Optional document title (defaults to filename)
        description: Optional document description
        
    Returns:
        Supabase document UUID as string
    """
    from pathlib import Path
    from hashlib import md5
    
    # Generate file hash
    file_hash = md5(filename.encode()).hexdigest()  # Simple hash, can be improved
    
    # Determine document type from extension
    ext = Path(filename).suffix.lower()
    if ext in ['.pdf']:
        doc_type = 'pdf'
    elif ext in ['.txt', '.md', '.markdown']:
        doc_type = 'text'
    elif ext in ['.jpg', '.jpeg', '.png']:
        doc_type = 'image'
    elif ext == '.json':
        doc_type = 'json'
    else:
        doc_type = 'other'
    
    result = supabase_db.execute(
        text("""
            INSERT INTO documents_metadata 
            (local_document_id, title, file_name, file_size, mime_type, file_hash, document_type, 
             user_id, organization_id, description, storage_provider, is_processed)
            VALUES (:local_document_id, :title, :filename, :file_size, :mime_type, :file_hash, :doc_type,
                    :user_id, :org_id, :description, 'local', false)
            RETURNING id
        """),
        {
            "local_document_id": local_document_id,
            "title": title or filename,
            "filename": filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "file_hash": file_hash,
            "doc_type": doc_type,
            "user_id": user_id,
            "org_id": organization_id,
            "description": description
        }
    )
    supabase_doc_id = result.fetchone()[0]
    supabase_db.commit()
    return str(supabase_doc_id)


def create_supabase_citation_metadata(
    supabase_db: Session,
    local_citation_id: str,  # Local citation UUID
    document_id: str,  # Supabase document UUID
    citation_text_preview: str,
    citation_type: str,
    court: Optional[str] = None,
    year: Optional[int] = None,
    volume: Optional[str] = None,
    reporter: Optional[str] = None,
    page: Optional[str] = None,
    jurisdiction: Optional[str] = None,
    confidence_score: Optional[float] = None,
    case_name: Optional[str] = None
) -> str:
    """
    Create citation metadata in Supabase for validation workflow.
    
    Args:
        supabase_db: Supabase database session
        document_id: Supabase document UUID
        citation_text_preview: Preview of citation text (first 200 chars)
        citation_type: Type of citation (case, statute, regulation, other)
        court: Court name if applicable
        year: Year from citation
        volume: Volume number
        reporter: Reporter abbreviation
        page: Page number
        jurisdiction: Jurisdiction (e.g., PK)
        confidence_score: Confidence score (0.0-1.0)
        case_name: Case name if available
        
    Returns:
        Supabase citation UUID as string
    """
    # Convert confidence string to numeric if needed
    confidence_numeric = None
    if confidence_score is not None:
        if isinstance(confidence_score, str):
            # Map string confidence to numeric
            confidence_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
            confidence_numeric = confidence_map.get(confidence_score.lower(), 0.5)
        else:
            confidence_numeric = float(confidence_score)
    
    result = supabase_db.execute(
        text("""
            INSERT INTO citations_metadata 
            (local_citation_id, document_id, citation_text_preview, citation_type, case_name,
             court, year, volume, reporter, page, jurisdiction,
             confidence_score, is_validated, validation_status)
            VALUES (:local_citation_id, :doc_id, :preview, :type, :case_name,
                    :court, :year, :volume, :reporter, :page, :jurisdiction,
                    :confidence, false, 'pending')
            RETURNING id
        """),
        {
            "local_citation_id": local_citation_id,
            "doc_id": document_id,
            "preview": citation_text_preview[:200] if citation_text_preview else None,
            "type": citation_type,
            "case_name": case_name,
            "court": court,
            "year": year,
            "volume": volume,
            "reporter": reporter,
            "page": page,
            "jurisdiction": jurisdiction or "PK",
            "confidence": confidence_numeric
        }
    )
    supabase_citation_id = result.fetchone()[0]
    supabase_db.commit()
    return str(supabase_citation_id)
