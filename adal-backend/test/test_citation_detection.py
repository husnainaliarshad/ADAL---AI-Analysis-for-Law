"""
Test cases for Citation Detection using Pakistan Laws Dataset
"""
import pytest
import json
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Skip this integration suite in lightweight environments missing ML deps.
pytest.importorskip("numpy")

from app.main import app
from app.database.database_main import Base, get_db
from app.models.document_model import Document
from app.models.citation_model import Citation
from app.services.citation_service import detect_citations, extract_citations_from_document
from app.services.file_service import extract_text_from_json

# Create file-based SQLite database for testing
# Using file-based instead of :memory: to ensure all connections see the same database
# (SQLite :memory: databases are connection-specific)
import tempfile
import os
_test_db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
_test_db_path = _test_db_file.name
_test_db_file.close()

TEST_DATABASE_URL = f"sqlite:///{_test_db_path}"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables once before any tests run
Base.metadata.create_all(bind=test_engine)

# Override get_db dependency for testing
def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# Cleanup function to delete test database file after all tests
def pytest_sessionfinish(session, exitstatus):
    """Clean up test database file after all tests complete"""
    try:
        if os.path.exists(_test_db_path):
            os.unlink(_test_db_path)
    except Exception:
        pass

# Test client
client = TestClient(app)

# Dataset path
DATASET_PATH = Path(__file__).parent.parent.parent / "Dataset" / "Pakistan_Laws_Dataset" / "pdf_data.json"


@pytest.fixture
def db_session():
    """Create a test database session"""
    # Tables are already created at module level, just create session
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Clean up: delete all data but keep tables for other tests
        # Note: We don't drop tables here to avoid issues with concurrent test runs


@pytest.fixture
def sample_document(db_session: Session):
    """Create a sample document for testing"""
    document = Document(
        filename="test_document.json",
        path="/test/path",
        ocr_text=""
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)
    return document


@pytest.fixture
def sample_legal_text():
    """Sample legal text with Pakistani citations"""
    return """
    This is a legal document regarding criminal offenses in Pakistan.
    As stated in Pakistan Penal Code (XLV of 1860), S.302, murder is punishable by law.
    The Supreme Court in PLD 2025 SC 123 held that the right to life is fundamental.
    See also 2025 SCMR 456 for related jurisprudence.
    The Lahore High Court in PLD 2025 Lah. 321 affirmed this principle.
    Constitution of Pakistan, Art.25 guarantees equality before law.
    Refer to Criminal Procedure Code (V of 1898), S.154 for procedure.
    """


class TestCitationDetection:
    """Test citation detection functionality"""
    
    def test_detect_pld_citations(self, sample_legal_text):
        """Test detection of PLD citations"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        # Should detect PLD citations
        pld_citations = [c for c in citations if c['reporter'] == 'PLD']
        assert len(pld_citations) >= 2, "Should detect at least 2 PLD citations"
        
        # Check first PLD citation
        pld_sc = [c for c in pld_citations if 'SC' in c['citation_text']]
        assert len(pld_sc) > 0, "Should detect PLD SC citation"
        if pld_sc:
            assert pld_sc[0]['court'] == "Supreme Court of Pakistan"
            assert pld_sc[0]['year'] == 2025
            assert pld_sc[0]['page'] == "123"
    
    def test_detect_scmr_citations(self, sample_legal_text):
        """Test detection of SCMR citations"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        scmr_citations = [c for c in citations if c['reporter'] == 'SCMR']
        assert len(scmr_citations) >= 1, "Should detect SCMR citation"
        
        if scmr_citations:
            assert scmr_citations[0]['year'] == 2025
            assert scmr_citations[0]['page'] == "456"
    
    def test_detect_ppc_statutes(self, sample_legal_text):
        """Test detection of Pakistan Penal Code citations"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        ppc_citations = [c for c in citations if 'PPC' in c['citation_text'] or 'Pakistan Penal Code' in c['citation_text']]
        assert len(ppc_citations) >= 1, "Should detect PPC citation"
        
        if ppc_citations:
            assert ppc_citations[0]['citation_type'] == 'statute'
            assert '302' in ppc_citations[0]['page'] or '302' in ppc_citations[0]['citation_text']
    
    def test_detect_constitution_articles(self, sample_legal_text):
        """Test detection of Constitution articles"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        constitution_citations = [c for c in citations if 'Constitution' in c['citation_text'] or 'Art.' in c['citation_text']]
        assert len(constitution_citations) >= 1, "Should detect Constitution citation"
    
    def test_detect_cpc_statutes(self, sample_legal_text):
        """Test detection of Civil Procedure Code citations"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        cpc_citations = [c for c in citations if 'Criminal Procedure Code' in c['citation_text'] or 'CPC' in c['citation_text']]
        assert len(cpc_citations) >= 1, "Should detect CPC citation"
    
    def test_jurisdiction_detection(self, sample_legal_text):
        """Test that all citations are marked as Pakistani (PK)"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        for citation in citations:
            assert citation['jurisdiction'] == 'PK', f"Citation {citation['citation_text']} should have jurisdiction PK"
    
    def test_citation_position_tracking(self, sample_legal_text):
        """Test that citation positions are tracked correctly"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        for citation in citations:
            assert citation['position_start'] < citation['position_end']
            assert citation['position_start'] >= 0
            assert citation['position_end'] <= len(sample_legal_text)
    
    def test_citation_context_extraction(self, sample_legal_text):
        """Test that context is extracted around citations"""
        citations = detect_citations(sample_legal_text, document_id=1)
        
        for citation in citations:
            assert citation['context'] is not None
            assert len(citation['context']) > 0
            # Context should include the citation text
            assert citation['citation_text'].lower() in citation['context'].lower()


class TestDatasetIntegration:
    """Test integration with actual dataset"""
    
    def test_load_dataset_structure(self):
        """Test that dataset file exists and has correct structure"""
        assert DATASET_PATH.exists(), f"Dataset file not found at {DATASET_PATH}"
        
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert isinstance(data, list), "Dataset should be a list"
        assert len(data) > 0, "Dataset should not be empty"
        
        # Check first entry structure
        first_entry = data[0]
        assert 'file_name' in first_entry, "Entry should have 'file_name' field"
        # Dataset uses 'text' field, but extract_text_from_json handles both 'text' and 'content'
        assert 'text' in first_entry or 'content' in first_entry, "Entry should have 'text' or 'content' field"
        text_field = first_entry.get('text') or first_entry.get('content')
        assert isinstance(text_field, str), "Text field should be a string"
    
    def test_extract_text_from_dataset_json(self):
        """Test extracting text from dataset JSON format"""
        if not DATASET_PATH.exists():
            pytest.skip("Dataset file not found")
        
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Test with first entry
        first_entry = data[0]
        extracted_text = extract_text_from_json(first_entry)
        
        assert isinstance(extracted_text, str)
        assert len(extracted_text) > 0
        # Should extract from 'text' or 'content' field (dataset uses 'text')
        source_text = first_entry.get('text') or first_entry.get('content', '')
        assert source_text in extracted_text or extracted_text in source_text or len(extracted_text) > 0
    
    def test_citation_detection_on_dataset_entry(self, db_session: Session):
        """Test citation detection on actual dataset entry"""
        if not DATASET_PATH.exists():
            pytest.skip("Dataset file not found")
        
        with open(DATASET_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Find an entry with substantial content
        test_entry = None
        for entry in data[:10]:  # Check first 10 entries
            # Dataset uses 'text' field, not 'content'
            text_content = entry.get('text') or entry.get('content', '')
            if len(text_content) > 500:
                test_entry = entry
                break
        
        if not test_entry:
            pytest.skip("No suitable test entry found in dataset (need entry with >500 characters of text)")
        
        # Create document
        text_content = test_entry.get('text') or test_entry.get('content', '')
        document = Document(
            filename=test_entry['file_name'],
            path="/test/path",
            ocr_text=text_content
        )
        db_session.add(document)
        db_session.commit()
        db_session.refresh(document)
        
        # Extract citations
        citations = extract_citations_from_document(db_session, document.id)
        
        # Should detect at least some citations if the document contains legal text
        # (Some documents might not have citations, so we just check the process works)
        assert isinstance(citations, list)
        
        # If citations found, verify they're valid
        for citation in citations:
            assert citation.document_id == document.id
            assert citation.citation_text is not None
            assert citation.jurisdiction == 'PK'
            assert citation.citation_type in ['case', 'statute', 'regulation', 'article', 'other']
        
        # Cleanup
        db_session.delete(document)
        db_session.commit()


class TestAPIIntegration:
    """Test API endpoints for citation detection"""
    
    def test_upload_file_endpoint(self):
        """Test file upload endpoint"""
        # Create a test JSON file
        test_data = {
            "file_name": "test_law.pdf",
            "content": "This is a test legal document. See PLD 2025 SC 123. As per Pakistan Penal Code (XLV of 1860), S.302."
        }
        
        # Note: This would require actual file upload, simplified for now
        # In real test, you'd create a temporary file and upload it
        pass
    
    def test_extract_citations_endpoint(self, db_session: Session, sample_document: Document):
        """Test citation extraction endpoint"""
        # Set OCR text
        sample_document.ocr_text = "See PLD 2025 SC 123. Refer to 2025 SCMR 456."
        db_session.commit()
        
        # Call API endpoint
        response = client.post(f"/api/citations/documents/{sample_document.id}/extract")
        
        # Debug: Print error if status is not 200
        if response.status_code != 200:
            print(f"Error response: {response.status_code}")
            print(f"Error detail: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Error: {response.text}"
        data = response.json()
        assert 'document_id' in data
        assert 'total_citations' in data
        assert 'citations' in data
        assert data['document_id'] == sample_document.id
        assert data['total_citations'] >= 0  # May be 0 if no citations found


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_empty_text(self):
        """Test citation detection on empty text"""
        citations = detect_citations("", document_id=1)
        assert citations == []
    
    def test_text_without_citations(self):
        """Test citation detection on text without citations"""
        text = "This is a regular document without any legal citations."
        citations = detect_citations(text, document_id=1)
        assert citations == []
    
    def test_malformed_citations(self):
        """Test handling of malformed citations"""
        text = "PLD 2025 SC (incomplete citation)"
        citations = detect_citations(text, document_id=1)
        # Should not crash, may or may not detect incomplete citations
        assert isinstance(citations, list)
    
    def test_multiple_citations_same_line(self):
        """Test detection of multiple citations in same line"""
        text = "See PLD 2025 SC 123 and 2025 SCMR 456 for reference."
        citations = detect_citations(text, document_id=1)
        assert len(citations) >= 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
