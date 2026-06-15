"""
Test cases for Embedding and Retrieval functionality
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
from app.models.claim_model import Claim
from app.models.citation_model import Citation
from app.services.embedding_service import (
    load_bge_model,
    generate_embedding,
    generate_embeddings_batch,
    get_embedding_dimension
)
from app.services.retrieval_service import (
    add_claims_to_index,
    search_similar_claims,
    get_index_stats,
    get_or_create_index
)

# Create test database
import tempfile
import os
_test_db_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
_test_db_path = _test_db_file.name
_test_db_file.close()

TEST_DATABASE_URL = f"sqlite:///{_test_db_path}"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables
Base.metadata.create_all(bind=test_engine)

# Override get_db dependency
def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture
def sample_document(db: Session):
    """Create a sample document for testing."""
    doc = Document(
        filename="test_doc.pdf",
        path="/test/path",
        ocr_text="This is a test legal document. It contains claims about criminal law. The defendant violated Section 302 of the Pakistan Penal Code. The court found the defendant guilty."
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@pytest.fixture
def sample_claims(db: Session, sample_document):
    """Create sample claims for testing."""
    claims = [
        Claim(
            document_id=sample_document.id,
            claim_text="The defendant violated Section 302 of the Pakistan Penal Code",
            position_start=50,
            position_end=100,
            claim_type="criminal",
            confidence_score=0.9
        ),
        Claim(
            document_id=sample_document.id,
            claim_text="The court found the defendant guilty",
            position_start=101,
            position_end=150,
            claim_type="criminal",
            confidence_score=0.85
        ),
        Claim(
            document_id=sample_document.id,
            claim_text="This is a test legal document about criminal law",
            position_start=0,
            position_end=49,
            claim_type="criminal",
            confidence_score=0.8
        )
    ]
    for claim in claims:
        db.add(claim)
    db.commit()
    for claim in claims:
        db.refresh(claim)
    return claims


def test_load_bge_model():
    """Test loading BGE model."""
    model = load_bge_model()
    assert model is not None
    print(f"✓ BGE model loaded successfully")


def test_get_embedding_dimension():
    """Test getting embedding dimension."""
    dimension = get_embedding_dimension()
    assert dimension in [768, 1024]  # base or large model
    print(f"✓ Embedding dimension: {dimension}")


def test_generate_embedding():
    """Test generating a single embedding."""
    text = "This is a test sentence for embedding."
    embedding = generate_embedding(text)
    
    assert embedding is not None
    assert len(embedding.shape) == 1  # 1D array
    assert embedding.shape[0] == get_embedding_dimension()
    print(f"✓ Generated embedding with shape: {embedding.shape}")


def test_generate_embeddings_batch():
    """Test generating embeddings in batch."""
    texts = [
        "First test sentence.",
        "Second test sentence.",
        "Third test sentence."
    ]
    embeddings = generate_embeddings_batch(texts, batch_size=2)
    
    assert embeddings is not None
    assert len(embeddings) == len(texts)
    assert embeddings.shape[1] == get_embedding_dimension()
    print(f"✓ Generated {len(embeddings)} embeddings in batch")


def test_api_generate_embedding():
    """Test embedding generation API endpoint."""
    response = client.post(
        "/api/embeddings/generate",
        json={"text": "Test query for embedding"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert "dimension" in data
    assert len(data["embedding"]) == data["dimension"]
    print(f"✓ API embedding generation successful")


def test_api_generate_embeddings_batch():
    """Test batch embedding generation API endpoint."""
    response = client.post(
        "/api/embeddings/generate-batch",
        json={"texts": ["First text", "Second text", "Third text"]}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "embeddings" in data
    assert "count" in data
    assert len(data["embeddings"]) == data["count"]
    print(f"✓ API batch embedding generation successful")


def test_index_claims(db: Session, sample_document, sample_claims):
    """Test indexing claims in FAISS."""
    count = add_claims_to_index(db, sample_document.id, index_name="test_index")
    
    assert count == len(sample_claims)
    
    # Check index stats
    stats = get_index_stats("test_index")
    assert stats["total_vectors"] == len(sample_claims)
    print(f"✓ Indexed {count} claims successfully")


def test_search_similar_claims(db: Session, sample_document, sample_claims):
    """Test searching for similar claims."""
    # First index the claims
    add_claims_to_index(db, sample_document.id, index_name="test_search_index")
    
    # Search for similar claims
    query = "violation of criminal law"
    results = search_similar_claims(
        query,
        k=5,
        threshold=0.3,
        index_name="test_search_index"
    )
    
    assert len(results) > 0
    assert all("metadata" in r for r in results)
    assert all("similarity" in r for r in results)
    print(f"✓ Found {len(results)} similar claims")


def test_api_index_claims(db: Session, sample_document, sample_claims):
    """Test API endpoint for indexing claims."""
    response = client.post(
        f"/api/embeddings/documents/{sample_document.id}/index-claims",
        params={"index_name": "test_api_index"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert data["count"] == len(sample_claims)
    print(f"✓ API claim indexing successful")


def test_api_search_claims(db: Session, sample_document, sample_claims):
    """Test API endpoint for searching claims."""
    # First index
    client.post(
        f"/api/embeddings/documents/{sample_document.id}/index-claims",
        params={"index_name": "test_api_search"}
    )
    
    # Then search
    response = client.post(
        "/api/embeddings/search/claims",
        json={
            "query": "criminal law violation",
            "k": 5,
            "threshold": 0.3,
            "index_name": "test_api_search"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "total_results" in data
    print(f"✓ API claim search successful, found {data['total_results']} results")


def test_api_index_stats():
    """Test API endpoint for index statistics."""
    # Create an index first
    manager = get_or_create_index("test_stats_index")
    manager.create_index()
    
    response = client.get(
        "/api/embeddings/index/stats",
        params={"index_name": "test_stats_index"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    print(f"✓ API index stats successful")


def test_api_embedding_dimension():
    """Test API endpoint for embedding dimension."""
    response = client.get("/api/embeddings/dimension")
    
    assert response.status_code == 200
    data = response.json()
    assert "dimension" in data
    assert data["dimension"] in [768, 1024]
    print(f"✓ API dimension endpoint successful")


if __name__ == "__main__":
    # Run tests manually
    print("Running embedding and retrieval tests...")
    print("=" * 60)
    
    # Note: These tests require the dependencies to be installed
    # Run with: pytest test_embedding_retrieval.py -v

