from fastapi import APIRouter, UploadFile, File, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi import Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.database.database_manager import get_local_db
from app.core.auth_dependencies import require_auth, require_websocket_auth
from app.core.realtime import documents_realtime_manager
from app.services.file_service import (
    upload_file, 
    list_files, 
    get_file_text, 
    extract_text_and_save_to_file,
    get_document_by_id,
    delete_document,
    download_document
)

router = APIRouter(prefix="", tags=["files"], dependencies=[Depends(require_auth)])

def get_optional_supabase_db():
    """Get Supabase DB if available, otherwise return None."""
    from app.database.database_manager import SupabaseSessionLocal
    if not SupabaseSessionLocal:
        # Supabase not configured
        yield None
        return

    db = SupabaseSessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.websocket("/ws/updates")
async def route_documents_updates_websocket(
    websocket: WebSocket,
    local_db: Session = Depends(get_local_db),
):
    require_websocket_auth(websocket, local_db)
    await documents_realtime_manager.connect(websocket)

    try:
        await websocket.send_json({
            "type": "documents.ws.connected",
            "message": "Document updates websocket connected",
        })

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        documents_realtime_manager.disconnect(websocket)
    except Exception:
        documents_realtime_manager.disconnect(websocket)

@router.post("/upload")
async def route_upload_file(
    file: UploadFile = File(...),
    user_id: Optional[str] = Query(None, description="Supabase user UUID (required if Supabase metadata is enabled)"),
    organization_id: Optional[str] = Query(None, description="Supabase organization UUID (optional)"),
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Upload a file with multi-database support.
    Creates metadata in Supabase (if available) and stores content in Local PostgreSQL.
    """
    result = await upload_file(file, local_db, supabase_db, user_id=user_id, organization_id=organization_id)
    await documents_realtime_manager.broadcast({
        "type": "documents.updated",
        "action": "uploaded",
        "document_id": result.get("document_id") or result.get("id"),
        "document": result,
    })
    return result

@router.get("/")
async def route_list_files(
    response: Response,
    skip: int = Query(0, ge=0, description="Number of files to skip"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of files to return"),
    case_id: int = Query(None, description="Filter by case ID"),
    local_db: Session = Depends(get_local_db)
):
    """
    List uploaded files with pagination support.
    Returns file metadata including IDs, sizes, and OCR status.
    
    Query Parameters:
    - skip: Number of files to skip (default: 0)
    - limit: Maximum number of files to return (default: 100, max: 1000)
    """
    result = list_files(local_db, skip=skip, limit=limit, case_id=case_id)
    
    # Remove aggressive caching to ensure UI updates after deletes/uploads
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Total-Count"] = str(result["total_files"])
    
    return result

@router.get("/{filename}/text")
async def route_get_file_text(
    filename: str,
    local_db: Session = Depends(get_local_db)
):
    """
    Get text from a file by filename.
    Returns text content along with document ID and file metadata.
    """
    return get_file_text(filename, local_db)

@router.get("/{document_id}")
async def route_get_document(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Get a document by its ID with all metadata including file size, type, and OCR status.
    """
    return get_document_by_id(local_db, document_id)

@router.post("/{document_id}/extract-text")
async def route_extract_text_from_file(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Extract text from an already uploaded file using OCR/text extraction.
    Saves the extracted text as a .txt file in the uploads folder.
    Updates the document's ocr_text field in the database.
    
    Args:
        document_id: The ID of the document (returned from upload endpoint)
    """
    result = extract_text_and_save_to_file(local_db, document_id)
    await documents_realtime_manager.broadcast({
        "type": "documents.updated",
        "action": "ocr_extracted",
        "document_id": result.get("document_id") or result.get("id") or document_id,
        "document": result,
    })
    return result

@router.get("/{document_id}/download")
async def route_download_document(
    document_id: int,
    local_db: Session = Depends(get_local_db)
):
    """
    Download a document file by its ID.
    
    Streams the file to the client with appropriate headers for download.
    
    Args:
        document_id: The ID of the document to download
    """
    file_path, filename = download_document(local_db, document_id)
    
    # Determine media type based on file extension
    media_type_map = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.txt': 'text/plain',
        '.json': 'application/json',
    }
    
    ext = file_path.suffix.lower()
    media_type = media_type_map.get(ext, 'application/octet-stream')
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.delete("/{document_id}")
async def route_delete_document(
    document_id: int,
    local_db: Session = Depends(get_local_db),
    supabase_db: Optional[Session] = Depends(get_optional_supabase_db)
):
    """
    Delete a document and all related data.
    
    This endpoint will:
    1. Delete all related records (citations, claims, evidence, verification reports)
    2. Delete the document from Local PostgreSQL
    3. Delete metadata from Supabase (if linked)
    4. Delete the physical file from disk (if it exists)
    5. Delete the OCR text file (if it exists)
    
    Args:
        document_id: The ID of the document to delete
    """
    result = delete_document(local_db, document_id, supabase_db)
    await documents_realtime_manager.broadcast({
        "type": "documents.updated",
        "action": "deleted",
        "document_id": document_id,
        "document": result,
    })
    return result
