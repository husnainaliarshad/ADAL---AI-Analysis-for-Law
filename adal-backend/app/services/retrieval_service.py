"""
Retrieval Service using FAISS Vector Database
Performs similarity search for claims, citations, and evidence
"""
import os
import json
import faiss
import numpy as np
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.services.embedding_service import (
    load_bge_model,
    get_embedding_dimension,
    generate_embedding_for_query,
    generate_embeddings_batch,
    get_faiss_index_path,
    get_metadata_path
)

load_dotenv()

# Global index cache
_index_cache: Dict[str, faiss.Index] = {}
_metadata_cache: Dict[str, List[Dict]] = {}


class FAISSIndexManager:
    """
    Manages FAISS indices with metadata tracking.
    """
    
    def __init__(self, index_name: str = "default", dimension: Optional[int] = None):
        """
        Initialize FAISS index manager.
        
        Args:
            index_name: Name of the index
            dimension: Embedding dimension (auto-detected if None)
        """
        self.index_name = index_name
        self.dimension = dimension or get_embedding_dimension()
        self.index_path = get_faiss_index_path(index_name)
        self.metadata_path = get_metadata_path(index_name)
        self.index: Optional[faiss.Index] = None
        self.metadata: List[Dict] = []
        
    def create_index(self, index_type: str = "flat") -> faiss.Index:
        """
        Create a new FAISS index.
        
        Args:
            index_type: Type of index ("flat", "ivf", "hnsw")
        
        Returns:
            FAISS index instance
        """
        if index_type == "flat":
            # Flat index (exact search, slower but accurate)
            index = faiss.IndexFlatL2(self.dimension)
        elif index_type == "ivf":
            # IVF (Inverted File Index) - faster approximate search
            nlist = 100  # Number of clusters
            quantizer = faiss.IndexFlatL2(self.dimension)
            index = faiss.IndexIVFFlat(quantizer, self.dimension, nlist)
        elif index_type == "hnsw":
            # HNSW (Hierarchical Navigable Small World) - very fast approximate search
            M = 32  # Number of connections
            index = faiss.IndexHNSWFlat(self.dimension, M)
        else:
            raise ValueError(f"Unknown index type: {index_type}")
        
        self.index = index
        return index
    
    def load_index(self) -> Optional[faiss.Index]:
        """
        Load index from disk if it exists.
        
        Returns:
            FAISS index or None if not found
        """
        if self.index_path.exists():
            try:
                self.index = faiss.read_index(str(self.index_path))
                print(f"Loaded FAISS index from {self.index_path}")
                return self.index
            except Exception as e:
                print(f"Error loading index: {e}")
                return None
        return None
    
    def load_metadata(self) -> List[Dict]:
        """
        Load metadata from disk if it exists.
        
        Returns:
            List of metadata dictionaries
        """
        if self.metadata_path.exists():
            try:
                with open(self.metadata_path, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
                print(f"Loaded metadata from {self.metadata_path}")
                return self.metadata
            except Exception as e:
                print(f"Error loading metadata: {e}")
                return []
        return []
    
    def save_index(self):
        """Save index to disk."""
        if self.index is not None:
            try:
                faiss.write_index(self.index, str(self.index_path))
                print(f"Saved FAISS index to {self.index_path}")
            except Exception as e:
                print(f"Error saving index: {e}")
    
    def save_metadata(self):
        """Save metadata to disk."""
        try:
            with open(self.metadata_path, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, indent=2, ensure_ascii=False)
            print(f"Saved metadata to {self.metadata_path}")
        except Exception as e:
            print(f"Error saving metadata: {e}")
    
    def add_vectors(self, vectors: np.ndarray, metadata: List[Dict]):
        """
        Add vectors and their metadata to the index.
        
        Args:
            vectors: Numpy array of embeddings (shape: [n, dimension])
            metadata: List of metadata dictionaries (one per vector)
        """
        if self.index is None:
            self.create_index()
        
        if len(vectors) != len(metadata):
            raise ValueError("Number of vectors must match number of metadata entries")
        
        # Convert to float32 (required by FAISS)
        vectors = vectors.astype('float32')
        
        # Train index if needed (for IVF)
        if isinstance(self.index, faiss.IndexIVFFlat) and not self.index.is_trained:
            print("Training IVF index...")
            self.index.train(vectors)
        
        # Add vectors to index
        self.index.add(vectors)
        
        # Add metadata
        self.metadata.extend(metadata)
        
        print(f"Added {len(vectors)} vectors to index")
    
    def search(self, query_vector: np.ndarray, k: int = 10, threshold: Optional[float] = None) -> List[Dict]:
        """
        Search for similar vectors.
        
        Args:
            query_vector: Query embedding vector
            k: Number of results to return
            threshold: Minimum similarity threshold (L2 distance)
        
        Returns:
            List of results with metadata and scores
        """
        if self.index is None:
            raise ValueError("Index not initialized. Call load_index() or create_index() first.")
        
        if self.index.ntotal == 0:
            return []
        
        # Convert to float32 and reshape
        query_vector = query_vector.astype('float32').reshape(1, -1)
        
        # Search
        distances, indices = self.index.search(query_vector, min(k, self.index.ntotal))
        
        results = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx == -1:  # Invalid index
                continue
            
            # Convert L2 distance to similarity score (lower distance = higher similarity)
            # For normalized vectors, similarity = 1 - (distance / 2)
            similarity = 1.0 - (distance / 2.0) if distance <= 2.0 else 0.0
            
            # Apply threshold if specified
            if threshold is not None and similarity < threshold:
                continue
            
            if idx < len(self.metadata):
                result = {
                    "metadata": self.metadata[idx],
                    "distance": float(distance),
                    "similarity": float(similarity),
                    "rank": i + 1
                }
                results.append(result)
        
        return results
    
    def get_index_stats(self) -> Dict:
        """Get statistics about the index."""
        if self.index is None:
            return {"status": "not_initialized"}
        
        return {
            "status": "initialized",
            "total_vectors": int(self.index.ntotal),
            "dimension": int(self.index.d),
            "is_trained": bool(self.index.is_trained) if hasattr(self.index, 'is_trained') else True,
            "metadata_count": len(self.metadata)
        }


def get_or_create_index(index_name: str = "default") -> FAISSIndexManager:
    """
    Get or create a FAISS index manager (cached).
    
    Args:
        index_name: Name of the index
    
    Returns:
        FAISSIndexManager instance
    """
    if index_name not in _index_cache:
        manager = FAISSIndexManager(index_name)
        # Try to load existing index
        manager.load_index()
        manager.load_metadata()
        _index_cache[index_name] = manager
    
    return _index_cache[index_name]


def add_claims_to_index(
    local_db: Session,
    document_id: int,
    index_name: str = "default"
) -> int:
    """
    Add all claims from a document to the FAISS index.
    
    FAISS index metadata is stored in Local PostgreSQL only.
    
    Args:
        local_db: Local PostgreSQL database session
        document_id: Document ID
        index_name: Name of the index
    
    Returns:
        Number of claims added
    """
    from app.models.claim_model import Claim
    
    # Get claims from Local PostgreSQL
    claims = local_db.query(Claim).filter(Claim.document_id == document_id).all()
    
    if not claims:
        return 0
    
    # Generate embeddings
    claim_texts = [claim.claim_text for claim in claims]
    embeddings = generate_embeddings_batch(claim_texts, batch_size=32)
    
    # Create metadata
    metadata = [
        {
            "entity_type": "claim",
            "entity_id": claim.id,
            "document_id": claim.document_id,
            "text": claim.claim_text[:200],  # Preview
            "claim_type": claim.claim_type
        }
        for claim in claims
    ]
    
    # Add to index
    manager = get_or_create_index(index_name)
    manager.add_vectors(embeddings, metadata)
    manager.save_index()
    manager.save_metadata()
    
    return len(claims)


def search_similar_claims(
    query_text: str,
    k: int = 10,
    threshold: float = 0.5,
    index_name: str = "default"
) -> List[Dict]:
    """
    Search for claims similar to the query.
    
    Args:
        query_text: Query text
        k: Number of results
        threshold: Minimum similarity threshold
        index_name: Name of the index
    
    Returns:
        List of similar claims with scores
    """
    # Generate query embedding
    query_embedding = generate_embedding_for_query(query_text)
    
    # Search
    manager = get_or_create_index(index_name)
    results = manager.search(query_embedding, k=k, threshold=threshold)
    
    return results


def search_similar_citations(
    query_text: str,
    k: int = 10,
    threshold: float = 0.5,
    index_name: str = "default"
) -> List[Dict]:
    """
    Search for citations similar to the query.
    
    Args:
        query_text: Query text
        k: Number of results
        threshold: Minimum similarity threshold
        index_name: Name of the index
    
    Returns:
        List of similar citations with scores
    """
    # Generate query embedding
    query_embedding = generate_embedding_for_query(query_text)
    
    # Search
    manager = get_or_create_index(index_name)
    results = manager.search(query_embedding, k=k, threshold=threshold)
    
    # Filter for citations only
    citation_results = [r for r in results if r["metadata"].get("entity_type") == "citation"]
    
    return citation_results


def get_index_stats(index_name: str = "default") -> Dict:
    """
    Get statistics about an index.
    
    Args:
        index_name: Name of the index
    
    Returns:
        Dictionary with index statistics
    """
    manager = get_or_create_index(index_name)
    return manager.get_index_stats()

