from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.citation_model import Citation
from app.models.document_model import Document
from app.models.draft_model import Draft


CITATION_SAMPLE_LIMIT = 12
RECENT_DOCUMENT_LIMIT = 24
NOTIFICATION_DEFAULT_LIMIT = 20


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _now_utc() -> datetime:
    return datetime.utcnow()


def _start_of_day(value: datetime) -> datetime:
    return datetime(value.year, value.month, value.day)


def _has_ocr_text(document: Document) -> bool:
    return bool((document.ocr_text or "").strip())


def _format_filename(filename: str | None) -> str:
    if not filename:
        return "Untitled document"
    return filename.replace("_", " ").replace("-", " ")


def _ocr_ready_filters():
    return (func.coalesce(func.length(func.trim(Document.ocr_text)), 0) > 0,)


def _load_recent_documents(local_db: Session) -> list[Document]:
    return (
        local_db.query(Document)
        .order_by(Document.created_at.desc(), Document.id.desc())
        .limit(RECENT_DOCUMENT_LIMIT)
        .all()
    )


def _load_recent_drafts(local_db: Session, user_id: int) -> list[Draft]:
    return (
        local_db.query(Draft)
        .filter(Draft.user_id == user_id)
        .order_by(Draft.updated_at.desc(), Draft.id.desc())
        .all()
    )


def _build_daily_upload_bars(local_db: Session) -> list[int]:
    now = _now_utc()
    start_of_today = _start_of_day(now)
    window_start = start_of_today - timedelta(days=6)

    recent_uploads = (
        local_db.query(Document.created_at)
        .filter(Document.created_at >= window_start)
        .all()
    )

    day_counts = {(_start_of_day(window_start + timedelta(days=index))): 0 for index in range(7)}
    for (created_at,) in recent_uploads:
        if not created_at:
            continue
        day_key = _start_of_day(created_at)
        if day_key in day_counts:
            day_counts[day_key] += 1

    return [day_counts[_start_of_day(window_start + timedelta(days=index))] for index in range(7)]


def _count_documents_this_week(local_db: Session) -> int:
    window_start = _now_utc() - timedelta(days=7)
    return (
        local_db.query(func.count(Document.id))
        .filter(Document.created_at >= window_start)
        .scalar()
        or 0
    )


def _count_pending_documents_this_week(local_db: Session) -> int:
    window_start = _now_utc() - timedelta(days=7)
    ocr_ready_this_week = (
        local_db.query(func.count(Document.id))
        .filter(Document.created_at >= window_start, *_ocr_ready_filters())
        .scalar()
        or 0
    )
    total_this_week = (
        local_db.query(func.count(Document.id))
        .filter(Document.created_at >= window_start)
        .scalar()
        or 0
    )
    return (
        max(total_this_week - ocr_ready_this_week, 0)
    )


def _sampled_citation_counts(local_db: Session, sampled_document_ids: list[int]) -> dict[int, int]:
    if not sampled_document_ids:
        return {}

    rows = (
        local_db.query(Citation.document_id, func.count(Citation.id))
        .filter(Citation.document_id.in_(sampled_document_ids))
        .group_by(Citation.document_id)
        .all()
    )
    return {document_id: count for document_id, count in rows}


def _build_notifications(
    recent_draft: Draft | None,
    processed_documents: list[Document],
    pending_documents: list[Document],
    citation_review_gap: int,
    limit: int = NOTIFICATION_DEFAULT_LIMIT,
) -> list[dict[str, Any]]:
    notifications: list[dict[str, Any]] = []

    if recent_draft:
        notifications.append(
            {
                "id": f"draft-{recent_draft.id}",
                "type": "draft",
                "text": f"Draft ready to continue: {recent_draft.title}",
                "read": False,
                "created_at": _iso(recent_draft.updated_at),
            }
        )

    for document in processed_documents[:3]:
        notifications.append(
            {
                "id": f"ocr-{document.id}",
                "type": "ocr",
                "text": f"OCR complete: {_format_filename(document.filename)}",
                "read": False,
                "created_at": _iso(document.created_at),
            }
        )

    for document in pending_documents[:3]:
        notifications.append(
            {
                "id": f"document-{document.id}",
                "type": "doc",
                "text": f"Document uploaded: {_format_filename(document.filename)}",
                "read": False,
                "created_at": _iso(document.created_at),
            }
        )

    if citation_review_gap > 0:
        notifications.append(
            {
                "id": "citations-pending",
                "type": "system",
                "text": f"Citation review still pending on {citation_review_gap} OCR-ready file(s).",
                "read": False,
                "created_at": _iso(_now_utc()),
            }
        )

    if not notifications:
        notifications.append(
            {
                "id": "welcome",
                "type": "system",
                "text": "Welcome to ADAL. Your workspace is ready.",
                "read": False,
                "created_at": _iso(_now_utc()),
            }
        )

    notifications.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    for index, item in enumerate(notifications):
        item["read"] = index >= 3

    return notifications[:limit]


def build_dashboard_overview(local_db: Session, user_id: int) -> dict[str, Any]:
    recent_documents = _load_recent_documents(local_db)
    drafts = _load_recent_drafts(local_db, user_id)
    recent_draft = drafts[0] if drafts else None

    processed_documents = [document for document in recent_documents if _has_ocr_text(document)]
    pending_documents = [document for document in recent_documents if not _has_ocr_text(document)]

    total_documents = local_db.query(func.count(Document.id)).scalar() or 0
    ocr_ready_documents = (
        local_db.query(func.count(Document.id))
        .filter(*_ocr_ready_filters())
        .scalar()
        or 0
    )
    tracked_citations = local_db.query(func.count(Citation.id)).scalar() or 0
    saved_drafts = len(drafts)

    sampled_ocr_documents = processed_documents[:CITATION_SAMPLE_LIMIT]
    sampled_ids = [document.id for document in sampled_ocr_documents if document.id is not None]
    citation_counts_by_document = _sampled_citation_counts(local_db, sampled_ids)
    documents_with_citations = sum(1 for document_id in sampled_ids if citation_counts_by_document.get(document_id, 0) > 0)
    citation_review_gap = max(0, len(sampled_ids) - documents_with_citations)

    pending_documents_count = max(total_documents - ocr_ready_documents, 0)
    pending_this_week = _count_pending_documents_this_week(local_db)
    files_this_week = _count_documents_this_week(local_db)
    attention_needed = pending_documents_count + citation_review_gap

    recent_activity: list[dict[str, Any]] = []
    if recent_draft:
        recent_activity.append(
            {
                "id": f"draft-{recent_draft.id}",
                "type": "draft.updated",
                "title": f"{recent_draft.title} is ready to continue",
                "copy": "The latest saved draft is available for clause-by-clause review and further edits.",
                "status": "draft",
                "created_at": _iso(recent_draft.updated_at),
                "route": "/drafting-assistant",
            }
        )

    for document in processed_documents[:2]:
        recent_activity.append(
            {
                "id": f"processed-{document.id}",
                "type": "ocr.completed",
                "title": f"{_format_filename(document.filename)} is OCR-ready",
                "copy": "Text extraction completed successfully and the document is ready for summarization, citations, and drafting.",
                "status": "verified",
                "created_at": _iso(document.created_at),
                "route": f"/documents/{document.id}",
            }
        )

    for document in pending_documents[:1]:
        recent_activity.append(
            {
                "id": f"pending-{document.id}",
                "type": "document.uploaded",
                "title": f"{_format_filename(document.filename)} uploaded to workspace",
                "copy": "OCR still needs to run before the file can move into citation extraction or downstream legal analysis.",
                "status": "processing",
                "created_at": _iso(document.created_at),
                "route": f"/documents/{document.id}",
            }
        )

    queue_items: list[dict[str, Any]] = []
    if pending_documents_count > 0:
        queue_items.append(
            {
                "id": "ocr-pending",
                "type": "documents.ocr_pending",
                "title": f"{pending_documents_count} document(s) still need OCR",
                "copy": (
                    f"{pending_this_week} of those were uploaded this week and are still waiting to become analysis-ready."
                    if pending_this_week > 0
                    else "Review image quality or run extraction before downstream analysis depends on these files."
                ),
                "severity": "warning",
                "created_at": _iso(_now_utc()),
                "route": "/documents",
            }
        )

    if citation_review_gap > 0:
        queue_items.append(
            {
                "id": "citation-gap",
                "type": "citations.pending",
                "title": f"{citation_review_gap} OCR-ready file(s) have no sampled citations yet",
                "copy": "Run citation extraction or verify whether these documents should be part of the verification pipeline.",
                "severity": "error",
                "created_at": _iso(_now_utc()),
                "route": "/documents",
            }
        )

    if not queue_items:
        queue_items.append(
            {
                "id": "queue-clear",
                "type": "queue.clear",
                "title": "No urgent blockers are visible from the current backend data",
                "copy": "The workspace looks stable across documents, drafts, and sampled citation coverage.",
                "severity": "success",
                "created_at": _iso(_now_utc()),
                "route": "/dashboard",
            }
        )

    notifications = _build_notifications(
        recent_draft=recent_draft,
        processed_documents=processed_documents,
        pending_documents=pending_documents,
        citation_review_gap=citation_review_gap,
    )

    return {
        "generated_at": _iso(_now_utc()),
        "stats": {
            "total_documents": total_documents,
            "ocr_ready_documents": ocr_ready_documents,
            "tracked_citations": tracked_citations,
            "saved_drafts": saved_drafts,
            "attention_needed": attention_needed,
            "documents_this_week": files_this_week,
            "pending_documents": pending_documents_count,
            "documents_with_citations": documents_with_citations,
            "sampled_documents": len(sampled_ids),
        },
        "recent_activity": recent_activity[:3],
        "queue_items": queue_items,
        "analytics": {
            "workload_split": [
                {"label": "Verified", "value": documents_with_citations},
                {"label": "Processing", "value": pending_documents_count},
                {"label": "Flagged", "value": citation_review_gap},
            ],
            "uploads_last_7_days": _build_daily_upload_bars(local_db),
            "usage_rows": [
                {"label": "Workspace uploads", "value": files_this_week, "unit": "files"},
                {"label": "OCR-ready records", "value": ocr_ready_documents, "unit": "docs"},
                {"label": "Saved drafts", "value": saved_drafts, "unit": "drafts"},
            ],
        },
        "notifications": {
            "items": notifications,
            "unread_count": sum(1 for item in notifications if not item.get("read")),
            "derived": True,
        },
        "snapshot": {
            "latest_document": {
                "id": recent_documents[0].id,
                "filename": recent_documents[0].filename,
                "created_at": _iso(recent_documents[0].created_at),
            }
            if recent_documents
            else None,
            "latest_draft": {
                "id": recent_draft.id,
                "title": recent_draft.title,
                "updated_at": _iso(recent_draft.updated_at),
            }
            if recent_draft
            else None,
        },
    }


def build_notifications_feed(local_db: Session, user_id: int, limit: int = NOTIFICATION_DEFAULT_LIMIT) -> list[dict[str, Any]]:
    recent_documents = _load_recent_documents(local_db)
    drafts = _load_recent_drafts(local_db, user_id)
    recent_draft = drafts[0] if drafts else None
    processed_documents = [document for document in recent_documents if _has_ocr_text(document)]
    pending_documents = [document for document in recent_documents if not _has_ocr_text(document)]
    sampled_ids = [document.id for document in processed_documents[:CITATION_SAMPLE_LIMIT] if document.id is not None]
    citation_counts_by_document = _sampled_citation_counts(local_db, sampled_ids)
    documents_with_citations = sum(1 for document_id in sampled_ids if citation_counts_by_document.get(document_id, 0) > 0)
    citation_review_gap = max(0, len(sampled_ids) - documents_with_citations)

    return _build_notifications(
        recent_draft=recent_draft,
        processed_documents=processed_documents,
        pending_documents=pending_documents,
        citation_review_gap=citation_review_gap,
        limit=limit,
    )
