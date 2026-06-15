# Test Suite for Citation Detection

## Overview
This test suite validates the citation detection functionality using the Pakistan Laws Dataset.

## Test Files

### 1. `test_citation_detection.py`
Comprehensive test suite covering:
- **TestCitationDetection**: Unit tests for citation pattern detection
  - PLD citations (Supreme Court and High Courts)
  - SCMR citations
  - PPC (Pakistan Penal Code) statutes
  - Constitution articles
  - CPC (Civil Procedure Code) statutes
  - Jurisdiction detection
  - Position tracking
  - Context extraction

- **TestDatasetIntegration**: Integration tests with actual dataset
  - Dataset structure validation
  - JSON text extraction
  - Citation detection on real data

- **TestAPIIntegration**: API endpoint tests
  - File upload
  - Citation extraction endpoints

- **TestEdgeCases**: Edge case handling
  - Empty text
  - Text without citations
  - Malformed citations
  - Multiple citations per line

### 2. `test_dataset_format.py`
Standalone script to verify dataset format:
- Validates JSON structure
- Checks required fields (`file_name`, `content`)
- Analyzes citation patterns in dataset
- Creates sample test data

### 3. `test_main.py`
Basic FastAPI application tests

## Running Tests

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run All Tests
```bash
pytest test/ -v
```

### Run Specific Test File
```bash
pytest test/test_citation_detection.py -v
```

### Run Specific Test Class
```bash
pytest test/test_citation_detection.py::TestCitationDetection -v
```

### Run Dataset Format Check
```bash
python test/test_dataset_format.py
```

## Dataset Format

The dataset (`Dataset/Pakistan_Laws_Dataset/pdf_data.json`) should have the following structure:

```json
[
  {
    "file_name": "Constitution_of_Pakistan.pdf",
    "content": "Full text content of the legal document..."
  },
  {
    "file_name": "Pakistan_Penal_Code.pdf",
    "content": "Full text content..."
  }
]
```

## Test Data

Sample test data is created automatically by `test_dataset_format.py` in `test/sample_dataset.json`.

## Expected Test Results

### Citation Detection Tests
- ✅ Should detect PLD citations (Supreme Court and High Courts)
- ✅ Should detect SCMR citations
- ✅ Should detect PPC statutes
- ✅ Should detect Constitution articles
- ✅ Should detect CPC statutes
- ✅ All citations should have jurisdiction "PK"
- ✅ Citations should have position tracking
- ✅ Citations should have context extraction

### Dataset Integration Tests
- ✅ Dataset file should exist
- ✅ Dataset should be valid JSON array
- ✅ Each entry should have `file_name` and `content`
- ✅ Text extraction from JSON should work
- ✅ Citation detection on real data should work

## Notes

- Tests use a temporary in-memory database for isolation
- Dataset path is relative to project root: `Dataset/Pakistan_Laws_Dataset/pdf_data.json`
- Some tests may be skipped if dataset file is not found
- Tests are designed to work with Pakistani legal citation formats only
