"""
PDF Text Extractor Helper

This script helps extract text from legal PDF files
so they can be used with the legal summarizer.

Note: This requires additional dependencies (PyPDF2 or pdfplumber).
Install with: pip install PyPDF2 pdfplumber
"""

import sys
from pathlib import Path


def extract_with_pypdf2(pdf_path: str) -> str:
    """Extract text using PyPDF2 library."""
    try:
        import PyPDF2
        
        text = ""
        with open(pdf_path, "rb") as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        
        return text
    except ImportError:
        raise ImportError("PyPDF2 not installed. Install with: pip install PyPDF2")
    except Exception as e:
        raise RuntimeError(f"Error extracting text with PyPDF2: {str(e)}")


def extract_with_pdfplumber(pdf_path: str) -> str:
    """Extract text using pdfplumber library (better for complex layouts)."""
    try:
        import pdfplumber
        
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        
        return text
    except ImportError:
        raise ImportError("pdfplumber not installed. Install with: pip install pdfplumber")
    except Exception as e:
        raise RuntimeError(f"Error extracting text with pdfplumber: {str(e)}")


def extract_pdf_text(pdf_path: str, method: str = "auto") -> str:
    """
    Extract text from a PDF file.
    
    Args:
        pdf_path: Path to the PDF file
        method: Extraction method - "auto", "pypdf2", or "pdfplumber"
        
    Returns:
        Extracted text as string
    """
    if method == "auto":
        # Try pdfplumber first (better quality), fall back to PyPDF2
        try:
            return extract_with_pdfplumber(pdf_path)
        except ImportError:
            try:
                return extract_with_pypdf2(pdf_path)
            except ImportError:
                raise ImportError(
                    "No PDF extraction library found. Install one of:\n"
                    "  pip install pdfplumber\n"
                    "  pip install PyPDF2"
                )
    elif method == "pdfplumber":
        return extract_with_pdfplumber(pdf_path)
    elif method == "pypdf2":
        return extract_with_pypdf2(pdf_path)
    else:
        raise ValueError(f"Unknown method: {method}. Use 'auto', 'pdfplumber', or 'pypdf2'")


def main():
    """Command-line interface for PDF text extraction."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Extract text from PDF files for legal summarization"
    )
    parser.add_argument(
        "pdf_file",
        help="Path to the PDF file"
    )
    parser.add_argument(
        "-o", "--output",
        help="Output text file path (default: pdf_filename.txt)",
        default=None
    )
    parser.add_argument(
        "-m", "--method",
        choices=["auto", "pdfplumber", "pypdf2"],
        default="auto",
        help="Extraction method (default: auto)"
    )
    
    args = parser.parse_args()
    
    # Determine output path
    if args.output is None:
        pdf_path = Path(args.pdf_file)
        output_path = pdf_path.parent / f"{pdf_path.stem}.txt"
    else:
        output_path = args.output
    
    try:
        print(f"Extracting text from: {args.pdf_file}")
        print(f"Using method: {args.method}")
        
        text = extract_pdf_text(args.pdf_file, method=args.method)
        
        # Save to file
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)
        
        print(f"Text extracted and saved to: {output_path}")
        print(f"Extracted {len(text)} characters from PDF")
        
        # Show preview
        preview = text[:500] if len(text) > 500 else text
        print("\nPreview (first 500 characters):")
        print("-" * 80)
        print(preview)
        if len(text) > 500:
            print("...")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

