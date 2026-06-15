"""
Embedding Service using BGE (BAAI General Embedding) Model
Generates embeddings for claims, citations, and evidence paragraphs
"""
import os
from pathlib import Path
from typing import List, Optional, Union
import numpy as np
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# Global model instance (loaded once, reused)
_model = None
_model_name = None
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 1. The Global Anchor: Get the Root Data Dir from .env
# If not set, it defaults to a folder named 'data' in your current directory
BASE_STORAGE_DIR = Path(os.getenv("ADAL_DATA_DIR", "./data")).resolve()

# 2. FAISS Index (for your Vector Search/RAG)
FAISS_INDEX_DIR = BASE_STORAGE_DIR / "faiss_index"
FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)

# 3. Citations & Claims (referencing the same Base)
CITATIONS_DIR = BASE_STORAGE_DIR / "citations"
CITATIONS_DIR.mkdir(parents=True, exist_ok=True)

CLAIMS_DIR = BASE_STORAGE_DIR / "claims"
CLAIMS_DIR.mkdir(parents=True, exist_ok=True)

def load_bge_model():
    """
    Load BGE model (lazy loading, cached globally).
    
    Returns:
        SentenceTransformer model instance
    """
    global _model, _model_name
    
    model_name = os.getenv("BGE_MODEL_NAME", "BAAI/bge-base-en-v1.5")
    local_files_only = os.getenv("CLAIM_MODEL_LOCAL_FILES_ONLY", "false").strip().lower() in {"1", "true", "yes", "on"}
    
    # Only load if not already loaded or if model name changed
    if _model is None or _model_name != model_name:
        print(f"Loading BGE model: {model_name} (local_files_only={local_files_only})")
        _model = SentenceTransformer(
            model_name,
            local_files_only=local_files_only
        )
        _model_name = model_name
        print(f"BGE model loaded successfully (dimension: {_model.get_sentence_embedding_dimension()})")
    
    return _model


def get_embedding_dimension() -> int:
    """
    Get the embedding dimension for the current model.
    
    Returns:
        Embedding dimension (768 for base, 1024 for large)
    """
    model = load_bge_model()
    return model.get_sentence_embedding_dimension()


def generate_embedding(text: str) -> np.ndarray:
    """
    Generate embedding for a single text.
    
    Args:
        text: Text string to embed
    
    Returns:
        Embedding vector as numpy array
    """
    model = load_bge_model()
    
    # BGE models require specific instruction prefixes for different tasks
    # For retrieval tasks, we use the query instruction
    # For documents, we can use the passage instruction or no instruction
    # Here we use the default encoding (no instruction for general use)
    embedding = model.encode(text, normalize_embeddings=True)
    
    return embedding


def generate_embeddings_batch(texts: List[str], batch_size: int = 32, show_progress: bool = False) -> np.ndarray:
    """
    Generate embeddings for a batch of texts (more efficient).
    
    Args:
        texts: List of text strings to embed
        batch_size: Batch size for processing
        show_progress: Whether to show progress bar
    
    Returns:
        Numpy array of embeddings (shape: [len(texts), embedding_dim])
    """
    model = load_bge_model()
    
    if not texts:
        return np.array([])
    
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=show_progress,
        convert_to_numpy=True
    )
    
    return embeddings


def generate_embedding_for_query(query: str) -> np.ndarray:
    """
    Generate embedding for a query (search input).
    BGE models use specific instruction prefixes for queries.
    
    Args:
        query: Query text
    
    Returns:
        Embedding vector as numpy array
    """
    model = load_bge_model()
    
    # BGE models use instruction prefixes
    # For query: "Represent this sentence for searching relevant passages:"
    # For passage: "Represent this sentence:"
    # The sentence-transformers library handles this automatically based on model
    # But we can explicitly use query mode if needed
    
    # BGE models handle instruction prefixes automatically via sentence-transformers
    # Just encode the query normally
    embedding = model.encode(query, normalize_embeddings=True)
    
    return embedding


def generate_embeddings_for_claims(claim_texts: List[str]) -> np.ndarray:
    """
    Generate embeddings for claim texts.
    
    Args:
        claim_texts: List of claim text strings
    
    Returns:
        Numpy array of embeddings
    """
    return generate_embeddings_batch(claim_texts, batch_size=32)


def generate_embeddings_for_citations(citation_texts: List[str]) -> np.ndarray:
    """
    Generate embeddings for citation texts.
    
    Args:
        citation_texts: List of citation text strings
    
    Returns:
        Numpy array of embeddings
    """
    return generate_embeddings_batch(citation_texts, batch_size=32)


def generate_embeddings_for_paragraphs(paragraphs: List[str]) -> np.ndarray:
    """
    Generate embeddings for evidence paragraphs.
    
    Args:
        paragraphs: List of paragraph text strings
    
    Returns:
        Numpy array of embeddings
    """
    return generate_embeddings_batch(paragraphs, batch_size=32)


def get_faiss_index_path(index_name: str = "default") -> Path:
    """
    Get the file path for a FAISS index.
    
    Args:
        index_name: Name of the index
    
    Returns:
        Path to the index file
    """
    return FAISS_INDEX_DIR / f"{index_name}.index"


def get_metadata_path(index_name: str = "default") -> Path:
    """
    Get the file path for index metadata.
    
    Args:
        index_name: Name of the index
    
    Returns:
        Path to the metadata file
    """
    return FAISS_INDEX_DIR / f"{index_name}_metadata.json"

