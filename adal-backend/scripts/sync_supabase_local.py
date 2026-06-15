"""
Script to sync and link records between Supabase and Local PostgreSQL

This script helps establish links between:
- Supabase documents_metadata ↔ Local PostgreSQL documents
- Supabase citations_metadata ↔ Local PostgreSQL citations
- Supabase users ↔ Local PostgreSQL users

Usage:
    # Link all documents
    python scripts/sync_supabase_local.py --link-documents

    # Link all citations
    python scripts/sync_supabase_local.py --link-citations

    # Link all users
    python scripts/sync_supabase_local.py --link-users

    # Link everything
    python scripts/sync_supabase_local.py --link-all

    # Dry run (show what would be linked without making changes)
    python scripts/sync_supabase_local.py --link-all --dry-run
"""
import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlparse

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

load_dotenv()


def get_database_engines():
    """Get database engines for Supabase and Local PostgreSQL."""
    supabase_url = os.getenv("SUPABASE_DATABASE_URL")
    local_url = os.getenv("LOCAL_DATABASE_URL")
    
    if not supabase_url:
        raise ValueError("SUPABASE_DATABASE_URL not set in .env")
    if not local_url:
        raise ValueError("LOCAL_DATABASE_URL not set in .env")
    
    supabase_engine = create_engine(
        supabase_url,
        pool_pre_ping=True,
        connect_args={"sslmode": "require"}
    )
    
    local_engine = create_engine(
        local_url,
        pool_pre_ping=True
    )
    
    return supabase_engine, local_engine


def link_documents(supabase_engine, local_engine, dry_run=False):
    """
    Link documents between Supabase and Local PostgreSQL.
    Matches by filename or creates links based on metadata.
    """
    print("=" * 60)
    print("Linking Documents")
    print("=" * 60)
    
    supabase_session = sessionmaker(bind=supabase_engine)()
    local_session = sessionmaker(bind=local_engine)()
    
    try:
        # Get all Supabase documents
        supabase_docs = supabase_session.execute(text("""
            SELECT id, file_name, created_at
            FROM documents_metadata
            ORDER BY created_at DESC
        """)).fetchall()
        
        # Get all Local PostgreSQL documents
        local_docs = local_session.execute(text("""
            SELECT id, filename, created_at, supabase_document_id
            FROM documents
            ORDER BY created_at DESC
        """)).fetchall()
        
        print(f"Found {len(supabase_docs)} documents in Supabase")
        print(f"Found {len(local_docs)} documents in Local PostgreSQL")
        print()
        
        linked_count = 0
        created_count = 0
        
        for supabase_doc in supabase_docs:
            supabase_id, supabase_filename, supabase_created = supabase_doc
            
            # Try to find matching local document by filename
            matching_local = None
            for local_doc in local_docs:
                local_id, local_filename, local_created, local_supabase_id = local_doc
                
                if local_filename == supabase_filename:
                    matching_local = local_doc
                    break
            
            if matching_local:
                local_id, local_filename, local_created, local_supabase_id = matching_local
                
                if local_supabase_id is None:
                    if not dry_run:
                        local_session.execute(
                            text("UPDATE documents SET supabase_document_id = :supabase_id WHERE id = :local_id"),
                            {"supabase_id": str(supabase_id), "local_id": local_id}
                        )
                        local_session.commit()
                    
                    print(f"✓ Linked: {local_filename} (Local ID: {local_id} ↔ Supabase ID: {supabase_id})")
                    linked_count += 1
                else:
                    print(f"  Already linked: {local_filename} (Local ID: {local_id} ↔ Supabase ID: {local_supabase_id})")
            else:
                print(f"  No match found for Supabase document: {supabase_filename} (ID: {supabase_id})")
        
        print()
        print(f"Linked {linked_count} documents")
        if dry_run:
            print("(Dry run - no changes made)")
        
    finally:
        supabase_session.close()
        local_session.close()


def link_citations(supabase_engine, local_engine, dry_run=False):
    """
    Link citations between Supabase and Local PostgreSQL.
    Matches by citation text or document + position.
    """
    print("=" * 60)
    print("Linking Citations")
    print("=" * 60)
    
    supabase_session = sessionmaker(bind=supabase_engine)()
    local_session = sessionmaker(bind=local_engine)()
    
    try:
        # Get all Supabase citations
        supabase_citations = supabase_session.execute(text("""
            SELECT id, document_id, citation_text_preview, created_at
            FROM citations_metadata
            ORDER BY created_at DESC
        """)).fetchall()
        
        # Get all Local PostgreSQL citations
        local_citations = local_session.execute(text("""
            SELECT id, document_id, citation_text, supabase_citation_id
            FROM citations
            ORDER BY created_at DESC
        """)).fetchall()
        
        print(f"Found {len(supabase_citations)} citations in Supabase")
        print(f"Found {len(local_citations)} citations in Local PostgreSQL")
        print()
        
        linked_count = 0
        
        for supabase_citation in supabase_citations:
            supabase_id, supabase_doc_id, supabase_text_preview, _ = supabase_citation
            
            # Try to find matching local citation by text similarity
            # Simple matching: check if supabase preview is in local citation text
            matching_local = None
            for local_citation in local_citations:
                local_id, local_doc_id, local_citation_text, local_supabase_id = local_citation
                
                if local_supabase_id is None and supabase_text_preview:
                    # Simple text matching (can be improved)
                    if supabase_text_preview.lower() in local_citation_text.lower():
                        matching_local = local_citation
                        break
            
            if matching_local:
                local_id, local_doc_id, local_citation_text, _ = matching_local
                
                if not dry_run:
                    local_session.execute(
                        text("UPDATE citations SET supabase_citation_id = :supabase_id WHERE id = :local_id"),
                        {"supabase_id": str(supabase_id), "local_id": local_id}
                    )
                    local_session.commit()
                
                print(f"✓ Linked citation (Local ID: {local_id} ↔ Supabase ID: {supabase_id})")
                print(f"  Preview: {supabase_text_preview[:50]}...")
                linked_count += 1
            else:
                print(f"  No match found for Supabase citation ID: {supabase_id}")
        
        print()
        print(f"Linked {linked_count} citations")
        if dry_run:
            print("(Dry run - no changes made)")
        
    finally:
        supabase_session.close()
        local_session.close()


def link_users(supabase_engine, local_engine, dry_run=False):
    """
    Link users between Supabase and Local PostgreSQL.
    Matches by email.
    """
    print("=" * 60)
    print("Linking Users")
    print("=" * 60)
    
    supabase_session = sessionmaker(bind=supabase_engine)()
    local_session = sessionmaker(bind=local_engine)()
    
    try:
        # Get all Supabase users
        supabase_users = supabase_session.execute(text("""
            SELECT id, email, first_name, last_name
            FROM users
            ORDER BY created_at DESC
        """)).fetchall()
        
        # Get all Local PostgreSQL users
        local_users = local_session.execute(text("""
            SELECT id, email, username, supabase_user_id
            FROM users
            ORDER BY created_at DESC
        """)).fetchall()
        
        print(f"Found {len(supabase_users)} users in Supabase")
        print(f"Found {len(local_users)} users in Local PostgreSQL")
        print()
        
        linked_count = 0
        
        for supabase_user in supabase_users:
            supabase_id, supabase_email, supabase_first_name, supabase_last_name = supabase_user
            
            # Find matching local user by email
            matching_local = None
            for local_user in local_users:
                local_id, local_email, local_username, local_supabase_id = local_user
                
                if local_email and local_email.lower() == supabase_email.lower():
                    matching_local = local_user
                    break
            
            if matching_local:
                local_id, local_email, local_username, local_supabase_id = matching_local
                
                if local_supabase_id is None:
                    if not dry_run:
                        local_session.execute(
                            text("UPDATE users SET supabase_user_id = :supabase_id WHERE id = :local_id"),
                            {"supabase_id": str(supabase_id), "local_id": local_id}
                        )
                        local_session.commit()
                    
                    print(f"✓ Linked: {local_email} (Local ID: {local_id} ↔ Supabase ID: {supabase_id})")
                    linked_count += 1
                else:
                    print(f"  Already linked: {local_email} (Local ID: {local_id} ↔ Supabase ID: {local_supabase_id})")
            else:
                print(f"  No match found for Supabase user: {supabase_email} (ID: {supabase_id})")
        
        print()
        print(f"Linked {linked_count} users")
        if dry_run:
            print("(Dry run - no changes made)")
        
    finally:
        supabase_session.close()
        local_session.close()


def main():
    parser = argparse.ArgumentParser(
        description="Sync and link records between Supabase and Local PostgreSQL"
    )
    parser.add_argument(
        "--link-documents",
        action="store_true",
        help="Link documents between Supabase and Local PostgreSQL"
    )
    parser.add_argument(
        "--link-citations",
        action="store_true",
        help="Link citations between Supabase and Local PostgreSQL"
    )
    parser.add_argument(
        "--link-users",
        action="store_true",
        help="Link users between Supabase and Local PostgreSQL"
    )
    parser.add_argument(
        "--link-all",
        action="store_true",
        help="Link all record types"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be linked without making changes"
    )
    
    args = parser.parse_args()
    
    if not any([args.link_documents, args.link_citations, args.link_users, args.link_all]):
        parser.print_help()
        return 1
    
    try:
        supabase_engine, local_engine = get_database_engines()
        
        if args.link_all:
            link_documents(supabase_engine, local_engine, args.dry_run)
            print()
            link_citations(supabase_engine, local_engine, args.dry_run)
            print()
            link_users(supabase_engine, local_engine, args.dry_run)
        else:
            if args.link_documents:
                link_documents(supabase_engine, local_engine, args.dry_run)
            if args.link_citations:
                link_citations(supabase_engine, local_engine, args.dry_run)
            if args.link_users:
                link_users(supabase_engine, local_engine, args.dry_run)
        
        print()
        print("=" * 60)
        print("✓ Sync completed")
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
