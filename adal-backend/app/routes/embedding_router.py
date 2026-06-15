"""
Embedding and Retrieval API Routes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.database_manager import get_local_db
from app.services.embedding_service import (
    generate_embedding,
    generate_embeddings_batch,
    get_embedding_dimension
)
from app.services.retrieval_service import (
    add_claims_to_index,
    search_similar_claims,
    search_similar_citations,
    get_index_stats,
    get_or_create_index
)
from pydantic import BaseModel

router = APIRouter(prefix="/embeddings", tags=["Embeddings & Retrieval"])


# Request/Response Models
class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    dimension: int


class BatchEmbeddingRequest(BaseModel):
    texts: List[str]


class BatchEmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    dimension: int
    count: int


class SearchRequest(BaseModel):
    query: str
    k: int = 10
    threshold: float = 0.5
    index_name: str = "default"


class SearchResult(BaseModel):
    metadata: dict
    distance: float
    similarity: float
    rank: int


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int


class IndexStatsResponse(BaseModel):
    status: str
    total_vectors: Optional[int] = None
    dimension: Optional[int] = None
    is_trained: Optional[bool] = None
    metadata_count: Optional[int] = None


@router.post("/generate", response_model=EmbeddingResponse)
async def generate_embedding_endpoint(
    request: EmbeddingRequest
):
    """
    Generate embedding for a single text.
    """
    try:
        embedding = generate_embedding(request.text)
        return EmbeddingResponse(
            embedding=embedding.tolist(),
            dimension=len(embedding)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {str(e)}")


@router.post("/generate-batch", response_model=BatchEmbeddingResponse)
async def generate_embeddings_batch_endpoint(
    request: BatchEmbeddingRequest
):
    """
    Generate embeddings for multiple texts (batch processing).
    """
    try:
        embeddings = generate_embeddings_batch(request.texts, batch_size=32)
        dimension = get_embedding_dimension()
        return BatchEmbeddingResponse(
            embeddings=[emb.tolist() for emb in embeddings],
            dimension=dimension,
            count=len(embeddings)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")


@router.post("/documents/{document_id}/index-claims")
async def index_document_claims(
    document_id: int,
    index_name: str = Query(default="default", description="Name of the FAISS index"),
    local_db: Session = Depends(get_local_db)
):
    """
    Add all claims from a document to the FAISS index.
    
    FAISS index metadata is stored in Local PostgreSQL only.
    """
    try:
        count = add_claims_to_index(local_db, document_id, index_name=index_name)
        return {
            "message": f"Indexed {count} claims",
            "document_id": document_id,
            "index_name": index_name,
            "count": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to index claims: {str(e)}")


@router.post("/search/claims", response_model=SearchResponse)
async def search_claims(
    request: SearchRequest
):
    """
    Search for claims similar to the query text.
    
    FAISS index metadata is stored in Local PostgreSQL only.
    """
    try:
        results = search_similar_claims(
            request.query,
            k=request.k,
            threshold=request.threshold,
            index_name=request.index_name
        )
        
        search_results = [
            SearchResult(
                metadata=r["metadata"],
                distance=r["distance"],
                similarity=r["similarity"],
                rank=r["rank"]
            )
            for r in results
        ]
        
        return SearchResponse(
            query=request.query,
            results=search_results,
            total_results=len(search_results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search claims: {str(e)}")


@router.post("/search/citations", response_model=SearchResponse)
async def search_citations(
    request: SearchRequest
):
    """
    Search for citations similar to the query text.
    
    FAISS index metadata is stored in Local PostgreSQL only.
    """
    try:
        results = search_similar_citations(
            request.query,
            k=request.k,
            threshold=request.threshold,
            index_name=request.index_name
        )
        
        search_results = [
            SearchResult(
                metadata=r["metadata"],
                distance=r["distance"],
                similarity=r["similarity"],
                rank=r["rank"]
            )
            for r in results
        ]
        
        return SearchResponse(
            query=request.query,
            results=search_results,
            total_results=len(search_results)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search citations: {str(e)}")


@router.get("/index/stats", response_model=IndexStatsResponse)
async def get_index_statistics(
    index_name: str = Query(default="default", description="Name of the FAISS index")
):
    """
    Get statistics about a FAISS index.
    """
    try:
        stats = get_index_stats(index_name)
        return IndexStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get index stats: {str(e)}")


@router.get("/dimension")
async def get_embedding_dimension_endpoint():
    """
    Get the embedding dimension of the current model.
    """
    try:
        dimension = get_embedding_dimension()
        return {"dimension": dimension}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dimension: {str(e)}")

