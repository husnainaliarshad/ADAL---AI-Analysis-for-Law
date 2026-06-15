from pathlib import Path
from datetime import datetime
from fastapi import UploadFile, HTTPException
import pytesseract
from pdf2image import convert_from_path
from sqlalchemy import text
try:
    from pdf2image import pdfinfo_from_path
except ImportError:
    # Fallback if pdfinfo_from_path is not available
    pdfinfo_from_path = None
from pdf2image.exceptions import (
    PDFInfoNotInstalledError,
    PDFPageCountError,
    PDFSyntaxError
)
from PIL import Image
from sqlalchemy.orm import Session
from app.models.document_model import Document
from app.models.user_model import User
from app.utils.database_helpers import create_supabase_document_metadata, get_supabase_user_id
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Dict, Any, Tuple, Optional
from dotenv import load_dotenv  # <--- Make sure this is here!

load_dotenv()

# Base directory for all file storage from Environment Variable
BASE_STORAGE_DIR = Path(os.getenv("ADAL_DATA_DIR", "../Data")).resolve()
UPLOAD_DIR = BASE_STORAGE_DIR / "uploads"
OCR_TEXT_DIR = BASE_STORAGE_DIR / "ocr_text"
CITATIONS_DIR = BASE_STORAGE_DIR / "citations"
CLAIMS_DIR = BASE_STORAGE_DIR / "claims"

# Dataset directory for retrieving full text (Supreme Court Judgments)
DATASET_DIR = Path(os.getenv("ADAL_DATASET_DIR", "../Dataset/Supreme_court_Of_Pakistan_judgments")).resolve()

# Create all directories
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OCR_TEXT_DIR.mkdir(parents=True, exist_ok=True)
CITATIONS_DIR.mkdir(parents=True, exist_ok=True)
CLAIMS_DIR.mkdir(parents=True, exist_ok=True)
# TEMP: Presentation mode — serve local files directly from data/uploads without DB latency.
# Set to False to restore DB-backed listing.
LOCAL_PRESENTATION_MODE = False
DEFAULT_MAX_UPLOAD_SIZE_MB = 25

def _local_files_metadata():
    files = []
    for path in UPLOAD_DIR.glob("*"):
        if path.is_file():
            file_size = path.stat().st_size
            created_ts = path.stat().st_mtime
            files.append({
                "id": path.stem,  # use filename stem as id
                "document_id": path.stem,
                "filename": path.name,
                "path": str(path),
                "file_type": _infer_file_type(path.name),
                "file_size": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 3),
                "has_ocr_text": False,
                "ocr_text_length": 0,
                "created_at": datetime.fromtimestamp(created_ts).isoformat(),
            })
    return files

def _local_list_response(skip: int, limit: int):
    files = _local_files_metadata()
    sliced = files[skip: skip + limit]
    return {
        "total_files": len(files),
        "count": len(sliced),
        "skip": skip,
        "limit": limit,
        "files": sliced,
    }


def sanitize_filename(raw_name: str) -> str:
    """Sanitize incoming filenames and reject traversal/path inputs."""
    if not raw_name:
        raise HTTPException(status_code=400, detail="Filename is required")

    filename = raw_name.strip()
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    # Reject path-like names instead of silently rewriting traversal inputs.
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", filename)
    safe_name = safe_name.strip("._")
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid filename")

    if len(safe_name) > 255:
        safe_name = safe_name[:255]

    return safe_name


def resolve_upload_path(safe_name: str) -> Path:
    """Resolve path inside upload directory and enforce containment."""
    upload_root = UPLOAD_DIR.resolve()
    resolved = (upload_root / safe_name).resolve()
    try:
        resolved.relative_to(upload_root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid upload path") from exc
    return resolved


def _max_upload_size_mb() -> int:
    raw = os.getenv("MAX_UPLOAD_SIZE_MB", str(DEFAULT_MAX_UPLOAD_SIZE_MB))
    try:
        parsed = int(raw)
        return parsed if parsed > 0 else DEFAULT_MAX_UPLOAD_SIZE_MB
    except (TypeError, ValueError):
        return DEFAULT_MAX_UPLOAD_SIZE_MB


def _cleanup_temp_file(path: Optional[Path]) -> None:
    if not path:
        return
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass


def _delete_supabase_document_metadata(supabase_db: Optional[Session], supabase_doc_id: Optional[str]) -> None:
    if not supabase_db or not supabase_doc_id:
        return
    try:
        supabase_db.execute(
            text("DELETE FROM documents_metadata WHERE id = :id"),
            {"id": str(supabase_doc_id)}
        )
        supabase_db.commit()
    except Exception as exc:
        supabase_db.rollback()
        print(f"Warning: Failed to compensate Supabase document metadata delete: {exc}")


# Tesseract path (Windows)
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Poppler path configuration (Windows)
# Check if poppler is in the project directory (common setup)
POPPLER_BASE_DIR = Path(__file__).parent.parent.parent.parent / "poppler-25.07.0"
POPPLER_BIN_PATH = None
if POPPLER_BASE_DIR.exists():
    # Windows: poppler binaries are in poppler-XX.XX.X/Library/bin
    poppler_bin = POPPLER_BASE_DIR / "Library" / "bin"
    if poppler_bin.exists():
        POPPLER_BIN_PATH = str(poppler_bin)
        # Add poppler bin directory to PATH for pdf2image to find pdftoppm
        current_path = os.environ.get("PATH", "")
        if str(poppler_bin) not in current_path:
            os.environ["PATH"] = str(poppler_bin) + os.pathsep + current_path

def _extract_text_from_file(file_path: Path, max_retries: int = 3, batch_size: int = 10, page_timeout: int = 300) -> Tuple[str, str]:
    """
    Helper function to extract text from a file based on its extension.
    Returns (text, extraction_method) tuple.
    
    Args:
        file_path: Path to the file to extract text from
        max_retries: Maximum number of retries for failed pages (default: 3)
        batch_size: Number of pages to process in each batch (default: 10)
        page_timeout: Timeout in seconds for processing a single page (default: 300 = 5 minutes)
    """
    ext = file_path.suffix.lower()
    
    if ext == ".pdf":
        # PDF: Use OCR with retry and batch processing for large files
        try:
            # Get total page count first (with fallback)
            total_pages = 0
            if pdfinfo_from_path:
                try:
                    if POPPLER_BIN_PATH:
                        info = pdfinfo_from_path(file_path, poppler_path=POPPLER_BIN_PATH)
                    else:
                        info = pdfinfo_from_path(file_path)
                    total_pages = info.get("Pages", 0)
                except Exception as e:
                    print(f"[OCR] Could not get page count from pdfinfo: {e}, will process all pages")
                    # Fallback: convert first page to get total, or process without knowing count
                    total_pages = 0  # Will process all pages if count unknown
            
            # If we couldn't get page count, try to estimate or process in batches until done
            if total_pages == 0:
                print(f"[OCR] Processing PDF (page count unknown, will process in batches): {file_path.name}")
                # Try to get a reasonable estimate by converting first batch
                try:
                    if POPPLER_BIN_PATH:
                        test_images = convert_from_path(
                            file_path,
                            first_page=1,
                            last_page=batch_size,
                            poppler_path=POPPLER_BIN_PATH,
                            dpi=300
                        )
                    else:
                        test_images = convert_from_path(
                            file_path,
                            first_page=1,
                            last_page=batch_size,
                            dpi=300
                        )
                    # If we got fewer pages than batch_size, that's the total
                    if len(test_images) < batch_size:
                        total_pages = len(test_images)
                    else:
                        # Estimate: assume at least batch_size pages, will process until done
                        total_pages = batch_size * 10  # Conservative estimate
                        print(f"[OCR] Estimated {total_pages} pages (will process until end)")
                except Exception as e:
                    print(f"[OCR] Could not estimate page count: {e}, using default batch processing")
                    total_pages = batch_size * 10  # Default estimate
            
            print(f"[OCR] Processing PDF with {total_pages} pages: {file_path.name}")
            
            # Process in batches to avoid memory issues and allow progress tracking
            all_text = []
            failed_pages = []
            processed_pages = 0
            
            # Process pages in batches
            batch_start = 0
            while batch_start < total_pages:
                batch_end = min(batch_start + batch_size, total_pages)
                batch_pages = list(range(batch_start, batch_end))
                images = []
                
                print(f"[OCR] Processing pages {batch_start + 1}-{batch_end} of {total_pages}")
                
                try:
                    # Convert batch of pages to images
                    if POPPLER_BIN_PATH:
                        images = convert_from_path(
                            file_path,
                            first_page=batch_start + 1,  # pdf2image uses 1-based indexing
                            last_page=batch_end,
                            poppler_path=POPPLER_BIN_PATH,
                            dpi=300,  # Good quality for OCR
                            thread_count=2  # Use multiple threads for conversion
                        )
                    else:
                        images = convert_from_path(
                            file_path,
                            first_page=batch_start + 1,
                            last_page=batch_end,
                            dpi=300,
                            thread_count=2
                        )
                    
                    # Process each image with timeout and retry
                    for page_idx, img in enumerate(images):
                        actual_page = batch_start + page_idx + 1
                        page_text = ""
                        retry_count = 0
                        
                        while retry_count < max_retries:
                            try:
                                # Process with timeout using ThreadPoolExecutor
                                with ThreadPoolExecutor(max_workers=1) as executor:
                                    future = executor.submit(pytesseract.image_to_string, img)
                                    try:
                                        page_text = future.result(timeout=page_timeout)
                                        break  # Success, exit retry loop
                                    except FutureTimeoutError:
                                        retry_count += 1
                                        if retry_count < max_retries:
                                            print(f"[OCR] Page {actual_page} timed out, retrying ({retry_count}/{max_retries})...")
                                            time.sleep(2)  # Brief delay before retry
                                        else:
                                            print(f"[OCR] Page {actual_page} failed after {max_retries} retries")
                                            failed_pages.append(actual_page)
                                            page_text = ""  # Empty text for failed page
                            except Exception as e:
                                retry_count += 1
                                if retry_count < max_retries:
                                    print(f"[OCR] Page {actual_page} error: {str(e)}, retrying ({retry_count}/{max_retries})...")
                                    time.sleep(2)
                                else:
                                    print(f"[OCR] Page {actual_page} failed after {max_retries} retries: {str(e)}")
                                    failed_pages.append(actual_page)
                                    page_text = ""
                        
                        all_text.append(page_text)
                        if page_text:
                            print(f"[OCR] Page {actual_page}/{total_pages} completed ({len(page_text)} chars)")
                
                except Exception as e:
                    print(f"[OCR] Batch {batch_start + 1}-{batch_end} failed: {str(e)}")
                    # If this is the last expected batch and we got an error, we might have reached the end
                    if batch_start + batch_size >= total_pages and "last_page" in str(e).lower():
                        print(f"[OCR] Reached end of PDF at page {batch_start}")
                        break
                    # Add empty text for failed pages in this batch
                    for page_num in batch_pages:
                        failed_pages.append(page_num + 1)
                        all_text.append("")
                
                # Move to next batch
                batch_start += batch_size
                processed_pages += len(batch_pages)
                
                # If we processed fewer pages than expected in last batch, we're done
                if images and len(images) < batch_size:
                    print(f"[OCR] Reached end of PDF (processed {processed_pages} pages)")
                    break
            
            # Combine all text
            text = "\n".join(all_text)
            
            if failed_pages:
                print(f"[OCR] Warning: {len(failed_pages)} pages failed: {failed_pages}")
                # Add note about failed pages to the text
                text += f"\n\n[OCR Note: {len(failed_pages)} page(s) could not be processed: {failed_pages}]"
            
            print(f"[OCR] Extraction complete: {len(text)} characters extracted from {total_pages} pages")
            return text, "OCR"
            
        except (PDFInfoNotInstalledError, PDFPageCountError) as e:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Poppler is not installed or not found in PATH. "
                    "Please install poppler-utils (Linux/Mac) or poppler for Windows. "
                    "For Windows, you can download from: https://github.com/oschwartz10612/poppler-windows/releases "
                    f"Original error: {str(e)}"
                )
            )
        except PDFSyntaxError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid or corrupted PDF file: {str(e)}"
            )
        except Exception as e:
            # Catch any other errors and provide helpful message
            print(f"[OCR] Unexpected error during PDF processing: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing PDF file: {str(e)}. The file may be too large or corrupted."
            )
    
    elif ext in [".jpg", ".jpeg", ".png"]:
        # Images: Use OCR
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img)
        return text, "OCR"
    
    elif ext in [".txt", ".md", ".markdown"]:
        # Text/Markdown file: Read directly
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
        return text, "direct_read"
    
    elif ext == ".json":
        # JSON file: Parse and extract text
        with open(file_path, "r", encoding="utf-8") as f:
            json_data = json.load(f)
        text = extract_text_from_json(json_data)
        return text, "json_parse"
    
    else:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file type. Supported: PDF, JPG, PNG, TXT, MD, MARKDOWN, JSON"
        )


def _infer_file_type(filename: str) -> str:
    """
    Infer file type from filename. Safe even when DB doesn't have file_type column.
    """
    if not filename:
        return ""
    file_ext = Path(filename).suffix.lower()
    return file_ext[1:] if file_ext.startswith('.') else file_ext


def _get_file_size(filename: str) -> int:
    """
    Get file size from filesystem; returns 0 if missing.
    """
    if not filename:
        return 0
    file_path = UPLOAD_DIR / filename
    return file_path.stat().st_size if file_path.exists() else 0

# 1️⃣ Upload a file
async def upload_file( 
    file: UploadFile, 
    local_db: Session,
    supabase_db: Optional[Session] = None,
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None
):
    """
    Upload a file with multi-database support.
    
    Flow:
    1. Create document metadata in Supabase (if supabase_db provided)
    2. Store document content and OCR text in Local PostgreSQL
    3. Link records via supabase_document_id
    
    Args:
        file: Uploaded file
        local_db: Local PostgreSQL database session (required)
        supabase_db: Supabase database session (optional, for metadata)
        user_id: Optional Supabase user UUID
        organization_id: Optional organization UUID
    """
    max_upload_mb = _max_upload_size_mb()
    max_file_size = max_upload_mb * 1024 * 1024
    safe_filename = sanitize_filename(file.filename or "")
    final_file_path = resolve_upload_path(safe_filename)
    temp_file_path = resolve_upload_path(f".tmp_{int(time.time() * 1000)}_{safe_filename}")
    supabase_doc_id = None
    local_committed = False
    document = None
    
    try:
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate file size
        if file_size > max_file_size:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum "
                    f"allowed size ({max_upload_mb} MB)"
                ),
            )
        
        if file_size == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        if final_file_path.exists():
            raise HTTPException(status_code=409, detail=f"File '{safe_filename}' already exists")

        # Enforce unique filename before any writes
        existing = local_db.query(Document.id, Document.supabase_document_id, Document.local_document_uuid).filter(
            Document.filename == safe_filename
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"File '{safe_filename}' already exists with id={existing.id}"
            )
        
        # Save to temp file; final move happens only after DB commit succeeds.
        with open(temp_file_path, "wb") as f:
            f.write(content)
        
        # Determine file type and MIME type
        file_type = _infer_file_type(safe_filename)
        mime_type = file.content_type or (f"application/{file_type}" if file_type else "application/octet-stream")
        
        # Step 1: Create local document record (flush only, no early commit)
        document = Document(
            filename=safe_filename,
            path=f"/data/uploads/{safe_filename}",
        )
        local_db.add(document)
        local_db.flush()

        # Step 2: Create metadata in Supabase (if configured)
        if supabase_db:
            # Resolve Supabase user_id:
            # - If a valid UUID string is provided, use it
            # - If a numeric/local ID is provided, map to supabase_user_id
            # - If none provided, auto-pick first linked local user
            resolved_user_id = None
            if user_id:
                try:
                    from uuid import UUID
                    resolved_user_id = str(UUID(user_id))
                except Exception:
                    try:
                        local_user_id = int(user_id)
                        resolved_user_id = get_supabase_user_id(local_user_id, local_db)
                    except Exception:
                        resolved_user_id = None
            else:
                linked = (
                    local_db.query(User.supabase_user_id)
                    .filter(User.supabase_user_id.isnot(None))
                    .order_by(User.id.asc())
                    .first()
                )
                if linked and linked[0]:
                    resolved_user_id = str(linked[0])

            if not resolved_user_id:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Supabase metadata requires a Supabase user link. Please register/login "
                        "to ensure supabase_user_id is set, or provide user_id as a Supabase UUID."
                    ),
                )

            resolved_org_id = None
            if organization_id:
                try:
                    from uuid import UUID
                    resolved_org_id = str(UUID(organization_id))
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail="organization_id must be a valid UUID (Supabase).",
                    ) from exc

            try:
                supabase_doc_id = create_supabase_document_metadata(
                    supabase_db=supabase_db,
                    local_document_id=str(document.local_document_uuid),
                    filename=safe_filename,
                    file_size=file_size,
                    mime_type=mime_type,
                    user_id=resolved_user_id,
                    organization_id=resolved_org_id,
                    title=safe_filename,
                )
                document.supabase_document_id = supabase_doc_id
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Supabase metadata insert failed: {exc}") from exc

        # Step 3: Commit DB transaction first
        local_db.commit()
        local_committed = True
        local_db.refresh(document)

        # Step 4: Move temp file to final location only after DB success
        try:
            temp_file_path.replace(final_file_path)
        except Exception as exc:
            # Compensate to avoid orphaned DB/Supabase records.
            try:
                local_db.query(Document).filter(Document.id == document.id).delete()
                local_db.commit()
            except Exception:
                local_db.rollback()
            _delete_supabase_document_metadata(supabase_db, supabase_doc_id)
            _cleanup_temp_file(temp_file_path)
            raise HTTPException(status_code=500, detail=f"Failed to finalize uploaded file: {exc}") from exc

        # Step 5: Automatically extract text from the uploaded file (best effort)
        try:
            text, _ = _extract_text_from_file(final_file_path)
            document.ocr_text = text
            
            # Save OCR text to file in ocr_text directory
            ocr_filename = f"{document.id}_{final_file_path.stem}.txt"
            ocr_file_path = OCR_TEXT_DIR / ocr_filename
            with open(ocr_file_path, "w", encoding="utf-8") as f:
                f.write(text)
            
            local_db.commit()
            local_db.refresh(document)
        except HTTPException:
            # If text extraction fails, don't fail the upload
            # The document is still saved, just without OCR text
            pass
        except Exception as e:
            # Log the error but don't fail the upload
            # The document is still saved, just without OCR text
            print(f"Warning: Text extraction failed: {e}")
        
        # Return response
        return {
            "id": document.id,
            "document_id": document.id,  # Alias for clarity
            "filename": document.filename,
            "path": document.path,
            "file_type": file_type,
            "file_size": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "has_ocr_text": document.ocr_text is not None and len(document.ocr_text) > 0,
            "ocr_text_length": len(document.ocr_text) if document.ocr_text else 0,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "supabase_document_id": str(supabase_doc_id) if supabase_doc_id else None,
            "message": "File uploaded successfully"
        }
    except HTTPException:
        if supabase_db and not local_committed:
            supabase_db.rollback()
        if not local_committed:
            local_db.rollback()
            _delete_supabase_document_metadata(supabase_db, supabase_doc_id)
        _cleanup_temp_file(temp_file_path)
        raise
    except Exception as e:
        if supabase_db and not local_committed:
            supabase_db.rollback()
        if not local_committed:
            local_db.rollback()
            _delete_supabase_document_metadata(supabase_db, supabase_doc_id)
        _cleanup_temp_file(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

# 2️⃣ List files with pagination
def list_files(local_db: Session, skip: int = 0, limit: int = 100, case_id: int = None):
    """
    List uploaded files with pagination support.
    Returns file metadata including IDs, sizes, and OCR status.
    Optimized to use database-stored file_size and file_type instead of filesystem calls.
    
    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return (default: 100, max: 1000)
    """
    # TEMP: Presentation mode short-circuit to local filesystem (revert when DB/API is ready)
    if LOCAL_PRESENTATION_MODE:
        return _local_list_response(skip, limit)

    try:
        # Validate limit (tighter cap for responsiveness)
        limit = min(max(1, limit), 200)  # Clamp between 1 and 200
        skip = max(0, skip)  # Ensure non-negative
        
        # Optimized query with pagination - uses indexes on created_at
        total_query = local_db.query(Document)
        if case_id is not None:
            total_query = total_query.filter(Document.case_id == case_id)
        total_count = total_query.count()
        query = local_db.query(Document).order_by(Document.created_at.desc())
        if case_id is not None:
            query = query.filter(Document.case_id == case_id)
        documents = query.offset(skip).limit(limit).all()
        
        files_info = []
        for doc in documents:
            # Derived file size and file type (no DB columns required)
            file_size = _get_file_size(doc.filename)
            file_type = _infer_file_type(doc.filename)
            
            files_info.append({
                "id": doc.id,
                "document_id": doc.id,
                "filename": doc.filename,
                "path": doc.path,
                "file_type": file_type,
                "file_size": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
                "has_ocr_text": doc.ocr_text is not None and len(doc.ocr_text) > 0,
                "ocr_text_length": len(doc.ocr_text) if doc.ocr_text else 0,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            })
        
        return {
            "total_files": total_count,
            "count": len(files_info),
            "skip": skip,
            "limit": limit,
            "files": files_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {e}")

def extract_text_from_json(json_data: Dict[str, Any]) -> str:
    """
    Extract text content from JSON structure.
    Looks for common text fields: 'text', 'content', 'body', 'description', 'ocr_text'
    If not found, converts entire JSON to string representation.
    """
    # Common field names that might contain text content
    text_fields = ['text', 'content', 'body', 'description', 'ocr_text', 'document_text', 'legal_text']
    
    for field in text_fields:
        if field in json_data and isinstance(json_data[field], str):
            return json_data[field]
    
    # If no direct text field, try to extract from nested structures
    if isinstance(json_data, dict):
        # Try to find text in nested objects
        for key, value in json_data.items():
            if isinstance(value, str) and len(value) > 50:  # Likely text content
                return value
            elif isinstance(value, dict):
                nested_text = extract_text_from_json(value)
                if nested_text:
                    return nested_text
            elif isinstance(value, list) and len(value) > 0:
                # Try first element if it's a list
                if isinstance(value[0], str):
                    return ' '.join(str(v) for v in value if isinstance(v, str))
                elif isinstance(value[0], dict):
                    nested_text = extract_text_from_json(value[0])
                    if nested_text:
                        return nested_text
    
    # Fallback: convert entire JSON to readable string
    return json.dumps(json_data, indent=2, ensure_ascii=False)


# 3️⃣ Extract text from file
def get_file_text(filename: str, local_db: Session):
    """
    Get text from a file by filename.
    Also returns document ID and other metadata if the file exists in database.
    """
    safe_filename = sanitize_filename(filename)
    file_path = resolve_upload_path(safe_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        text, extraction_method = _extract_text_from_file(file_path)
        
        # Try to find document in database
        document = local_db.query(Document).filter(Document.filename == safe_filename).first()
        document_id = document.id if document else None
        
        file_size = file_path.stat().st_size if file_path.exists() else 0
        file_type = _infer_file_type(safe_filename)
        
        result = {
            "filename": safe_filename,
            "document_id": document_id,
            "text": text,
            "text_length": len(text),
            "extraction_method": extraction_method,
            "file_type": file_type,
            "file_size": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
        }
        
        if document:
            result["created_at"] = document.created_at.isoformat() if document.created_at else None
        
        return result
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    except UnicodeDecodeError as e:
        raise HTTPException(status_code=400, detail=f"File encoding error. Please ensure file is UTF-8 encoded: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

# 4️⃣ Extract text and save to database
def extract_and_save_text(local_db: Session, document_id: int, filename: str):
    """
    Extract text from file and save to document in database.
    Supports multiple file formats:
    - PDF, JPG, PNG: Uses OCR
    - TXT: Direct text reading
    - JSON: Parses JSON and extracts text content
    
    This is required before citation detection can work.
    Note: Text is now automatically extracted during upload, but this function
    can be used to re-extract or update the text.
    """
    safe_filename = sanitize_filename(filename)
    file_path = resolve_upload_path(safe_filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get document
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Extract text using the helper function
        text, extraction_method = _extract_text_from_file(file_path)
        
        # Save to database
        document.ocr_text = text
        local_db.commit()
        local_db.refresh(document)
        
        ext = file_path.suffix.lower()
        file_type = ext[1:] if ext.startswith('.') else ext
        file_size = file_path.stat().st_size if file_path.exists() else 0
        
        return {
            "message": "Text extracted and saved",
            "document_id": document_id,
            "id": document_id,  # Alias for consistency
            "filename": document.filename,
            "path": document.path,
            "text_length": len(text),
            "extraction_method": extraction_method,
            "file_type": file_type,
            "file_size": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "has_ocr_text": True,
            "created_at": document.created_at.isoformat() if document.created_at else None
        }
        
    except json.JSONDecodeError as e:
        local_db.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    except UnicodeDecodeError as e:
        local_db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"File encoding error. Please ensure file is UTF-8 encoded: {str(e)}"
        )
    except HTTPException:
        local_db.rollback()
        raise
    except Exception as e:
        local_db.rollback()
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

# 5️⃣ Extract text from uploaded file, save as .txt file, and update document
def extract_text_and_save_to_file(local_db: Session, document_id: int):
    """
    Extract text from an already uploaded file using OCR/text extraction.
    Saves the extracted text as a .txt file in the uploads folder.
    Updates the document's ocr_text field in the database.
    
    Args:
        db: Database session
        document_id: ID of the document in the database
    
    Returns:
        Dictionary with extraction results and text file info
    """
    # Find document by ID
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found in database")
    
    filename = document.filename
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found in uploads folder")
    
    try:
        # Extract text from the file
        text, extraction_method = _extract_text_from_file(file_path)
        
        # Create text filename (e.g., "document.pdf" -> "document_id_document.txt")
        text_filename = f"{document_id}_{file_path.stem}.txt"
        text_file_path = OCR_TEXT_DIR / text_filename
        
        # Save extracted text to .txt file in ocr_text directory
        with open(text_file_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        # Update document's ocr_text in database
        document.ocr_text = text
        local_db.commit()
        local_db.refresh(document)
        
        file_size = file_path.stat().st_size if file_path.exists() else 0
        file_ext = file_path.suffix.lower()
        file_type = file_ext[1:] if file_ext.startswith('.') else file_ext
        
        return {
            "message": "Text extracted and saved successfully",
            "document_id": document.id,
            "id": document.id,  # Alias for consistency
            "original_filename": filename,
            "text_filename": text_filename,
            "text_file_path": f"/data/ocr_text/{text_filename}",
            "text_length": len(text),
            "extraction_method": extraction_method,
            "file_type": file_type,
            "file_size": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "ocr_text_saved": True,
            "has_ocr_text": True,
            "created_at": document.created_at.isoformat() if document.created_at else None
        }
        
    except json.JSONDecodeError as e:
        local_db.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    except UnicodeDecodeError as e:
        local_db.rollback()
        raise HTTPException(
            status_code=400, 
            detail=f"File encoding error. Please ensure file is UTF-8 encoded: {str(e)}"
        )
    except HTTPException:
        local_db.rollback()
        raise
    except Exception as e:
        local_db.rollback()
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")

# 6️⃣ Get document by ID
def get_document_by_id(local_db: Session, document_id: int):
    """
    Get a document by its ID with all metadata.
    """
    # TEMP: Presentation mode — serve local file metadata without DB
    if LOCAL_PRESENTATION_MODE:
        local = next(
            (f for f in _local_files_metadata() if str(f["id"]) == str(document_id) or str(f["document_id"]) == str(document_id)),
            None,
        )
        if local:
            return local
        # If not found locally, fall through to DB lookup

    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = UPLOAD_DIR / document.filename
    file_size = file_path.stat().st_size if file_path.exists() else 0
    file_type = _infer_file_type(document.filename)
    
    return {
        "id": document.id,
        "document_id": document.id,
        "filename": document.filename,
        "path": document.path,
        "file_type": file_type,
        "file_size": file_size,
        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "has_ocr_text": document.ocr_text is not None and len(document.ocr_text) > 0,
        "ocr_text_length": len(document.ocr_text) if document.ocr_text else 0,
        "ocr_text": document.ocr_text,
        "summary": document.summary,
        "created_at": document.created_at.isoformat() if document.created_at else None,
    }

# 7️⃣ Download document by ID
def download_document(local_db: Session, document_id: int) -> Tuple[Path, str]:
    """
    Get file path and filename for downloading a document.
    
    Args:
        local_db: Database session
        document_id: ID of the document to download
    
    Returns:
        Tuple of (file_path, filename) for streaming
    """
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = UPLOAD_DIR / document.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return file_path, document.filename

# 7️⃣ Delete document by ID
def delete_document(local_db: Session, document_id: int, supabase_db: Optional[Session] = None):
    """
    Delete a document and all related data.
    
    This function:
    1. Deletes related records (citations, claims, evidence, verification reports)
    2. Deletes the document from the database
    3. Deletes the physical file from disk (if it exists)
    4. Deletes the OCR text file (if it exists)
    
    Args:
        db: Database session
        document_id: ID of the document to delete
    
    Returns:
        Dictionary with deletion confirmation and counts
    """
    # Find document
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Import models for deletion
        from app.models.citation_model import Citation
        from app.models.claim_model import Claim, ClaimCitationMapping
        from app.models.evidence_model import Evidence
        from app.models.verification_report_model import VerificationReport
        from app.models.embedding_model import Embedding
        
        # Count related records before deletion
        citations_count = local_db.query(Citation).filter(Citation.document_id == document_id).count()
        claims_count = local_db.query(Claim).filter(Claim.document_id == document_id).count()
        evidence_count = local_db.query(Evidence).filter(Evidence.document_id == document_id).count()
        reports_count = local_db.query(VerificationReport).filter(VerificationReport.document_id == document_id).count()
        embeddings_count = local_db.query(Embedding).filter(Embedding.document_id == document_id).count()
        
        # Delete claim-citation mappings for claims in this document
        claim_ids = [claim.id for claim in local_db.query(Claim).filter(Claim.document_id == document_id).all()]
        if claim_ids:
            local_db.query(ClaimCitationMapping).filter(ClaimCitationMapping.claim_id.in_(claim_ids)).delete()
        
        # Delete related records
        local_db.query(Citation).filter(Citation.document_id == document_id).delete()
        local_db.query(Claim).filter(Claim.document_id == document_id).delete()
        local_db.query(Evidence).filter(Evidence.document_id == document_id).delete()
        local_db.query(VerificationReport).filter(VerificationReport.document_id == document_id).delete()
        local_db.query(Embedding).filter(Embedding.document_id == document_id).delete()
        
        # Delete from Supabase if linked (optional, may want to keep metadata)
        if supabase_db and document.supabase_document_id:
            try:
                from sqlalchemy import text
                supabase_db.execute(
                    text("DELETE FROM documents_metadata WHERE id = :id"),
                    {"id": str(document.supabase_document_id)}
                )
                supabase_db.commit()
            except Exception as e:
                # Log but don't fail if Supabase deletion fails
                print(f"Warning: Failed to delete Supabase metadata: {e}")
                if supabase_db:
                    supabase_db.rollback()
        
        # Delete the document from Local PostgreSQL
        local_db.delete(document)
        local_db.commit()
        
        # Delete physical files
        file_path = UPLOAD_DIR / document.filename
        ocr_text_filename = f"{document_id}_{file_path.stem}.txt"
        ocr_text_path = OCR_TEXT_DIR / ocr_text_filename
        
        files_deleted = []
        if file_path.exists():
            try:
                file_path.unlink()
                files_deleted.append(document.filename)
            except Exception as e:
                # Log but don't fail if file deletion fails
                print(f"Warning: Could not delete file {file_path}: {e}")
        
        if ocr_text_path.exists():
            try:
                ocr_text_path.unlink()
                files_deleted.append(ocr_text_filename)
            except Exception as e:
                # Log but don't fail if OCR file deletion fails
                print(f"Warning: Could not delete OCR file {ocr_text_path}: {e}")
        
        return {
            "message": "Document deleted successfully",
            "document_id": document_id,
            "filename": document.filename,
            "deleted_records": {
                "citations": citations_count,
                "claims": claims_count,
                "evidence": evidence_count,
                "verification_reports": reports_count,
                "embeddings": embeddings_count,
            },
            "files_deleted": files_deleted,
        }
        
    except HTTPException:
        if supabase_db:
            supabase_db.rollback()
        local_db.rollback()
        raise
    except Exception as e:
        if supabase_db:
            supabase_db.rollback()
        local_db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
