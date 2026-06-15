# Quick Start Guide

## Step 1: Install Dependencies

Activate your virtual environment and install required packages:

```powershell
# Activate virtual environment (if not already activated)
.\venv\Scripts\Activate.ps1

# Install dependencies
# From adal-backend/sum
pip install -r ..\requirements.txt
# or lightweight WSL install:
pip install -r ../requirements-wsl.txt
```

## Step 2: Set Up Your API Key

Create a `.env` file in the project root:

1. Create a new file named `.env` (no extension)
2. Add your API key:
   ```
   OPENAPI_KEY=sk-your-actual-api-key-here
   ```

## Step 3: Prepare Your Legal Document

You need a text file containing the legal document. If you have a PDF:

**Option A: Use the PDF extractor (if you installed pdfplumber/PyPDF2)**
```powershell
python pdf_extractor.py your_document.pdf -o legal_document.txt
```

**Option B: Manually extract text from PDF** using any PDF to text converter

## Step 4: Run the Summarizer

```powershell
# Basic usage
python legal_summarizer.py legal_document.txt

# With custom output file
python legal_summarizer.py legal_document.txt -o my_summary.txt

# With custom model (faster/cheaper)
python legal_summarizer.py legal_document.txt -m gpt-3.5-turbo

# With API key from command line (if not using .env)
python legal_summarizer.py legal_document.txt -k your-api-key-here
```

## Example Workflow

```powershell
# 1. Activate virtual environment
.\venv\Scripts\Activate.ps1

# 2. Extract text from PDF (if needed)
python pdf_extractor.py judgment.pdf -o judgment.txt

# 3. Generate summary
python legal_summarizer.py judgment.txt -o judgment_summary.txt
```

The summary will be:
- Saved to the output file
- Displayed in the console

## Troubleshooting

**Error: "API key not provided"**
- Make sure you created a `.env` file with `OPENAPI_KEY=your-key`
- Or pass it via `-k` flag: `python legal_summarizer.py input.txt -k your-key`

**Error: "openai package not found"**
- Run: `pip install -r ../requirements.txt` (or `../requirements-wsl.txt` for WSL)

**Error: "File not found"**
- Check that your input file path is correct
- Use absolute path if needed: `python legal_summarizer.py "C:\path\to\file.txt"`

