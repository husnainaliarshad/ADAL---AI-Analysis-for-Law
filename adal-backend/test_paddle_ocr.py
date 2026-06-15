import fitz  # PyMuPDF
import pytesseract
from concurrent.futures import ProcessPoolExecutor
import os
import time

# --- CONFIGURATION ---
# Point this to your Tesseract executable if it's not in your PATH
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def process_page_tesseract(args):
    """The Worker: Renders one page and runs Tesseract on it"""
    pdf_path, page_num = args
    try:
        doc = fitz.open(pdf_path)
        page = doc.load_page(page_num)
        
        # 1. THE SPEED TRICK: Digital Check
        # If the page has digital text, we extract it in 0.001s and skip OCR
        text = page.get_text().strip()
        if text:
            doc.close()
            return page_num, text

        # 2. OPTIMIZED RENDERING
        # 150 DPI is the 'Goldilocks' zone for Tesseract speed vs accuracy
        pix = page.get_pixmap(dpi=150)
        img_data = pix.tobytes("png") 
        
        # 3. TESSERACT EXECUTION
        # --psm 1: Automatic page segmentation (best for books/legal)
        # --oem 3: Default OCR engine mode
        page_text = pytesseract.image_to_string(
            fitz.Pixmap(fitz.csRGB, pix).tobytes("png"), 
            config='--psm 1 --oem 3'
        )
        
        doc.close()
        return page_num, page_text
    except Exception as e:
        return page_num, f"Error on page {page_num}: {str(e)}"

def fast_tesseract_ocr(pdf_path):
    doc = fitz.open(pdf_path)
    num_pages = len(doc)
    doc.close()

    # Use 75% of your CPU cores to keep Windows from freezing
    num_workers = max(1, os.cpu_count() - 2)
    
    print(f"🚀 Starting Tesseract Mega-Engine")
    print(f"📄 Document: {os.path.basename(pdf_path)}")
    print(f"⚙️  Workers: {num_workers} | Pages: {num_pages}")

    tasks = [(pdf_path, i) for i in range(num_pages)]
    
    # ProcessPoolExecutor is essential for Tesseract because it's an external process
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        results = list(executor.map(process_page_tesseract, tasks))

    # Reassemble in order
    results.sort(key=lambda x: x[0])
    return "\n\n".join([r[1] for r in results])

if __name__ == "__main__":
    path = r"C:\Users\husna\Documents\books\Behind Bars.pdf"
    
    start = time.time()
    final_text = fast_tesseract_ocr(path)
    end = time.time()
    
    print(f"\n--- 🏁 Finished in {end - start:.2f} seconds ---")
    print(f"Sample:\n{final_text[:500]}")