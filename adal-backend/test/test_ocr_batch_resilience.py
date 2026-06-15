from pathlib import Path

from app.services import file_service


def test_pdf_batch_exception_does_not_raise_unbound_images(monkeypatch):
    pdf_path = file_service.UPLOAD_DIR / "ocr_resilience.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n%dummy\n")

    monkeypatch.setattr(
        file_service,
        "pdfinfo_from_path",
        lambda *_args, **_kwargs: {"Pages": 1},
    )

    def _failing_convert(*_args, **_kwargs):
        raise RuntimeError("conversion failed")

    monkeypatch.setattr(file_service, "convert_from_path", _failing_convert)

    try:
        text, method = file_service._extract_text_from_file(
            pdf_path,
            max_retries=1,
            batch_size=1,
            page_timeout=1,
        )
        assert method == "OCR"
        assert isinstance(text, str)
    finally:
        if pdf_path.exists():
            pdf_path.unlink()
