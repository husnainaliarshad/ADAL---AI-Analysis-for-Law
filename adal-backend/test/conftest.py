import sys
import types


def _ensure_optional_runtime_stubs():
    if "multipart" not in sys.modules:
        multipart_stub = types.ModuleType("multipart")
        multipart_stub.__version__ = "0.0-test-stub"
        sys.modules["multipart"] = multipart_stub

    if "multipart.multipart" not in sys.modules:
        multipart_inner_stub = types.ModuleType("multipart.multipart")
        multipart_inner_stub.parse_options_header = lambda value: (value, {})
        sys.modules["multipart.multipart"] = multipart_inner_stub

    if "pytesseract" not in sys.modules:
        pytesseract_stub = types.ModuleType("pytesseract")

        class _Inner:
            tesseract_cmd = ""

        pytesseract_stub.pytesseract = _Inner()
        pytesseract_stub.image_to_string = lambda *_args, **_kwargs: ""
        sys.modules["pytesseract"] = pytesseract_stub

    if "pdf2image" not in sys.modules:
        pdf2image_stub = types.ModuleType("pdf2image")
        pdf2image_stub.convert_from_path = lambda *_args, **_kwargs: []
        pdf2image_stub.pdfinfo_from_path = lambda *_args, **_kwargs: {"Pages": 1}
        sys.modules["pdf2image"] = pdf2image_stub

    if "pdf2image.exceptions" not in sys.modules:
        exceptions_stub = types.ModuleType("pdf2image.exceptions")

        class PDFInfoNotInstalledError(Exception):
            pass

        class PDFPageCountError(Exception):
            pass

        class PDFSyntaxError(Exception):
            pass

        exceptions_stub.PDFInfoNotInstalledError = PDFInfoNotInstalledError
        exceptions_stub.PDFPageCountError = PDFPageCountError
        exceptions_stub.PDFSyntaxError = PDFSyntaxError
        sys.modules["pdf2image.exceptions"] = exceptions_stub

    if "PIL" not in sys.modules:
        pil_stub = types.ModuleType("PIL")
        image_stub = types.ModuleType("PIL.Image")
        image_stub.open = lambda *_args, **_kwargs: object()
        pil_stub.Image = image_stub
        sys.modules["PIL"] = pil_stub
        sys.modules["PIL.Image"] = image_stub


_ensure_optional_runtime_stubs()
