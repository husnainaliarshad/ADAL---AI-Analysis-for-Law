# Test Suite Summary

This document lists all available tests in the ADAL backend test suite.

## Test Files

### 1. `test/test_simple.py`
- **test_simple**: Basic test to verify pytest is working

### 2. `test/test_citation_detection.py`

#### TestCitationDetection Class
Tests for citation detection functionality:

1. **test_detect_pld_citations**: Tests detection of PLD (Pakistan Law Digest) citations
2. **test_detect_scmr_citations**: Tests detection of SCMR (Supreme Court Monthly Review) citations
3. **test_detect_ppc_statutes**: Tests detection of Pakistan Penal Code citations
4. **test_detect_constitution_articles**: Tests detection of Constitution of Pakistan articles
5. **test_detect_cpc_statutes**: Tests detection of Civil Procedure Code citations
6. **test_jurisdiction_detection**: Verifies all citations are marked as Pakistani (PK)
7. **test_citation_position_tracking**: Tests that citation positions are tracked correctly
8. **test_citation_context_extraction**: Tests that context is extracted around citations

#### TestDatasetIntegration Class
Tests for integration with the actual dataset:

9. **test_load_dataset_structure**: Verifies dataset file exists and has correct structure
10. **test_extract_text_from_dataset_json**: Tests extracting text from dataset JSON format
11. **test_citation_detection_on_dataset_entry**: Tests citation detection on actual dataset entry

#### TestAPIIntegration Class
Tests for API endpoints:

12. **test_upload_file_endpoint**: Tests file upload endpoint (placeholder)
13. **test_extract_citations_endpoint**: Tests citation extraction API endpoint

#### TestEdgeCases Class
Tests for edge cases and error handling:

14. **test_empty_text**: Tests citation detection on empty text
15. **test_text_without_citations**: Tests citation detection on text without citations
16. **test_malformed_citations**: Tests handling of malformed citations
17. **test_multiple_citations_same_line**: Tests detection of multiple citations in same line

### 3. `test/test_dataset_format.py`

18. **test_dataset_format**: Verifies the dataset format matches expected structure

## Running Tests

### Run All Tests
```bash
cd adal-backend
python -m pytest test/ -v
```

### Run Specific Test File
```bash
python -m pytest test/test_citation_detection.py -v
```

### Run Specific Test Class
```bash
python -m pytest test/test_citation_detection.py::TestCitationDetection -v
```

### Run Specific Test
```bash
python -m pytest test/test_citation_detection.py::TestCitationDetection::test_detect_pld_citations -v
```

### Run with Detailed Output
```bash
python -m pytest test/ -v -s --tb=long
```

### Run and Generate Coverage Report
```bash
python -m pytest test/ --cov=app --cov-report=html
```

## Test Configuration

- Tests use an **in-memory SQLite database** for isolation
- FastAPI's `get_db` dependency is overridden for testing
- Tests are independent of the main PostgreSQL database configuration
- Dataset path: `Dataset/Pakistan_Laws_Dataset/pdf_data.json`

## Expected Results

All tests should pass if:
- The dataset file exists at the expected path
- All dependencies are installed (`pytest`, `pytest-asyncio`)
- The application code is correctly implemented

## Troubleshooting

If tests fail:
1. Check that the dataset file exists: `Dataset/Pakistan_Laws_Dataset/pdf_data.json`
2. Verify all dependencies are installed: `pip install -r requirements.txt`
3. Check that the database models are correctly defined
4. Ensure the citation detection patterns match Pakistani legal citation formats
