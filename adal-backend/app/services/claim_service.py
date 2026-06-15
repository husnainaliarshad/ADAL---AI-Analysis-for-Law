import os
from dotenv import load_dotenv
load_dotenv()

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")

import re
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.tokenize import sent_tokenize

from transformers import AutoTokenizer, AutoModel
import torch

from app.models.claim_model import Claim, ClaimCitationMapping
from app.models.citation_model import Citation
from app.models.document_model import Document
from app.services.citation_service import get_citations_by_document
from typing import Optional


# Define the base data directory from the environment variable
DATA_ROOT = Path(os.getenv("ADAL_DATA_DIR", "../Data")).resolve()

# Refactored Claims Directory
CLAIMS_DIR = DATA_ROOT / "claims"
CLAIMS_DIR.mkdir(parents=True, exist_ok=True)

# Hugging Face model loading configuration
HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN") or None
CLAIM_MODEL_NAME = os.getenv("CLAIM_MODEL_NAME", "law-ai/InLegalBERT")
HF_MODEL_CACHE_DIR = Path(
    os.getenv("HF_MODEL_CACHE_DIR", str(Path.home() / ".cache" / "huggingface" / "hub"))
).resolve()
CLAIM_MODEL_LOCAL_FILES_ONLY = os.getenv("CLAIM_MODEL_LOCAL_FILES_ONLY", "false").strip().lower() in {"1", "true", "yes", "on"}

# Download NLTK data if not already downloaded
try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    try:
        nltk.download('punkt_tab', quiet=True)
    except:
        # Fallback to older punkt if punkt_tab fails
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt', quiet=True)

# Global variables for model (loaded once, reused)
_model = None
_tokenizer = None
_device = None
_model_lock = threading.Lock()
_status_lock = threading.Lock()
_warmup_thread = None
_model_status = {
    "state": "idle",
    "model_name": CLAIM_MODEL_NAME,
    "device": None,
    "cache_dir": str(HF_MODEL_CACHE_DIR),
    "local_files_only": CLAIM_MODEL_LOCAL_FILES_ONLY,
    "started_at": None,
    "ready_at": None,
    "last_error": None,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_present() -> bool:
    try:
        return any(HF_MODEL_CACHE_DIR.rglob("config.json"))
    except Exception:
        return False


def _set_model_status(**updates):
    with _status_lock:
        _model_status.update(updates)


def get_claim_model_status() -> Dict:
    with _status_lock:
        status = dict(_model_status)

    is_loaded = _model is not None and _tokenizer is not None
    if is_loaded:
        status["state"] = "ready"
        status["device"] = str(_device) if _device is not None else status.get("device")

    status["is_loaded"] = is_loaded
    status["cache_present"] = _cache_present()
    return status


def _load_hf_artifact(loader, model_name: str):
    kwargs = {
        "local_files_only": CLAIM_MODEL_LOCAL_FILES_ONLY,
    }
    if HF_TOKEN:
        try:
            return loader(model_name, token=HF_TOKEN, **kwargs)
        except TypeError:
            return loader(model_name, use_auth_token=HF_TOKEN, **kwargs)
    return loader(model_name, **kwargs)


def load_inlegalbert_model():
    """Load InLegalBERT model and tokenizer (lazy loading)."""
    global _model, _tokenizer, _device
    
    if _model is not None and _tokenizer is not None:
        _set_model_status(
            state="ready",
            device=str(_device) if _device is not None else None,
            ready_at=_model_status.get("ready_at") or _utc_now_iso(),
            last_error=None,
        )
        return _model, _tokenizer, _device

    with _model_lock:
        if _model is None or _tokenizer is None:
            model_name = CLAIM_MODEL_NAME
            print(f"Loading InLegalBERT model: {model_name}")
            _set_model_status(
                state="loading",
                model_name=model_name,
                started_at=_utc_now_iso(),
                last_error=None,
            )

            try:
                _tokenizer = _load_hf_artifact(
                    AutoTokenizer.from_pretrained,
                    model_name,
                )
                _model = _load_hf_artifact(
                    AutoModel.from_pretrained,
                    model_name,
                )
                _model.eval()
                
                # Set device (GPU if available, else CPU)
                _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                _model = _model.to(_device)
                
                print(f"InLegalBERT loaded on device: {_device}")
                print(f"Hugging Face cache dir: {HF_MODEL_CACHE_DIR}")
                _set_model_status(
                    state="ready",
                    device=str(_device),
                    ready_at=_utc_now_iso(),
                    last_error=None,
                )
            except Exception as exc:
                _set_model_status(
                    state="error",
                    device=str(_device) if _device is not None else None,
                    last_error=str(exc),
                )
                raise
    
    return _model, _tokenizer, _device


def warm_inlegalbert_model():
    """Preload InLegalBERT so the first claim-segmentation request doesn't pay the cold-start cost."""
    try:
        load_inlegalbert_model()
    except Exception as exc:
        print(f"[WARNING] InLegalBERT warmup failed: {exc}")


def start_claim_model_warmup() -> Dict:
    """Start background warmup if needed and return current status."""
    global _warmup_thread

    status = get_claim_model_status()
    if status["is_loaded"] or status["state"] == "loading":
        return status

    with _status_lock:
        if _model is not None and _tokenizer is not None:
            snapshot = dict(_model_status)
            snapshot["state"] = "ready"
            snapshot["is_loaded"] = True
            snapshot["cache_present"] = _cache_present()
            return snapshot
        if _model_status.get("state") == "loading":
            snapshot = dict(_model_status)
            snapshot["is_loaded"] = False
            snapshot["cache_present"] = _cache_present()
            return snapshot
        if _warmup_thread is not None and _warmup_thread.is_alive():
            _model_status["state"] = "loading"
            snapshot = dict(_model_status)
            snapshot["is_loaded"] = False
            snapshot["cache_present"] = _cache_present()
            return snapshot

        _model_status.update({
            "state": "loading",
            "started_at": _utc_now_iso(),
            "last_error": None,
        })
        _warmup_thread = threading.Thread(target=warm_inlegalbert_model, daemon=True, name="claim-model-warmup")
        _warmup_thread.start()
        snapshot = dict(_model_status)
        snapshot["is_loaded"] = False
        snapshot["cache_present"] = _cache_present()
        return snapshot


def get_embeddings(text: str, max_length: int = 512) -> np.ndarray:
    """
    Get semantic embeddings from InLegalBERT for a text segment.
    
    Args:
        text: Text string to embed
        max_length: Maximum sequence length (512 is BERT limit)
    
    Returns:
        Embedding vector (768 dimensions for base model)
    """
    model, tokenizer, device = load_inlegalbert_model()
    
    # Tokenize
    encoded = tokenizer(
        text,
        max_length=max_length,
        padding="max_length",
        truncation=True,
        return_tensors="pt"
    )
    encoded = {k: v.to(device) for k, v in encoded.items()}
    
    # Get embeddings (no gradient needed for inference)
    with torch.no_grad():
        outputs = model(**encoded)
        # Use [CLS] token embedding
        embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy()
    
    return embeddings[0]  # Remove batch dimension


def prepare_text_segments(document_text: str, citations: List[Citation], window_size: int = 500) -> List[Dict]:
    """
    Extract text segments around citations for claim segmentation.
    
    Args:
        document_text: Full OCR text from document
        citations: List of Citation objects with position info
        window_size: Characters before/after citation to include
    
    Returns:
        List of text segments with metadata
    """
    segments = []
    
    for citation in citations:
        # Extract context window around citation
        start = max(0, citation.position_start - window_size)
        end = min(len(document_text), citation.position_end + window_size)
        
        segment_text = document_text[start:end]
        
        segments.append({
            "text": segment_text,
            "citation_id": citation.id,
            "absolute_start": start,
            "absolute_end": end,
            "citation_position": citation.position_start
        })
    
    return segments


def find_sentence_boundaries_around_position(
    document_text: str, 
    position: int, 
    sentences_before: int = 2, 
    sentences_after: int = 2,
    min_chars_before: int = 200,
    min_chars_after: int = 200
) -> Tuple[int, int]:
    """
    Find sentence boundaries around a character position.
    Extends to include complete sentences before and after the position.
    
    Args:
        document_text: Full document text
        position: Character position to center around
        sentences_before: Number of sentences to include before
        sentences_after: Number of sentences to include after
        min_chars_before: Minimum characters to include before (fallback)
        min_chars_after: Minimum characters to include after (fallback)
    
    Returns:
        Tuple of (start_position, end_position) aligned to sentence boundaries
    """
    # Tokenize into sentences
    sentences = sent_tokenize(document_text)
    
    if not sentences:
        # Fallback to character-based window
        return (
            max(0, position - min_chars_before),
            min(len(document_text), position + min_chars_after)
        )
    
    # Find character positions for each sentence
    sentence_positions = []
    current_pos = 0
    
    for sent in sentences:
        # Find sentence in text starting from current position
        sent_start = document_text.find(sent, current_pos)
        if sent_start == -1:
            # Fallback: estimate position
            sent_start = current_pos
        sent_end = sent_start + len(sent)
        sentence_positions.append((sent_start, sent_end))
        current_pos = sent_end
    
    # Find which sentence contains the position
    sentence_idx = None
    for i, (start, end) in enumerate(sentence_positions):
        if start <= position <= end:
            sentence_idx = i
            break
    
    # If position not found in any sentence, find nearest
    if sentence_idx is None:
        for i, (start, end) in enumerate(sentence_positions):
            if position < start:
                sentence_idx = max(0, i - 1)
                break
        if sentence_idx is None:
            sentence_idx = len(sentence_positions) - 1
    
    # Extend to include sentences before and after
    start_sentence_idx = max(0, sentence_idx - sentences_before)
    end_sentence_idx = min(len(sentence_positions) - 1, sentence_idx + sentences_after)
    
    # Get character positions from sentence boundaries
    start_pos = sentence_positions[start_sentence_idx][0]
    end_pos = sentence_positions[end_sentence_idx][1]
    
    # Calculate minimum required positions
    min_start = max(0, position - min_chars_before)
    min_end = min(len(document_text), position + min_chars_after)
    
    # Prefer sentence boundaries, but extend if needed to meet minimum
    # This ensures we get complete sentences while still having enough context
    if start_pos > min_start:
        # Sentence starts after minimum - extend backwards to nearest sentence
        for i in range(start_sentence_idx - 1, -1, -1):
            if sentence_positions[i][0] <= min_start:
                start_pos = sentence_positions[i][0]
                break
        # If still not enough, use minimum (but this is less ideal)
        if start_pos > min_start:
            start_pos = min_start
    
    if end_pos < min_end:
        # Sentence ends before minimum - extend forwards to nearest sentence
        for i in range(end_sentence_idx + 1, len(sentence_positions)):
            if sentence_positions[i][1] >= min_end:
                end_pos = sentence_positions[i][1]
                break
        # If still not enough, use minimum (but this is less ideal)
        if end_pos < min_end:
            end_pos = min_end
    
    return (start_pos, end_pos)


def group_citations_by_proximity(citations: List[Citation], window_size: int = 500) -> List[List[Citation]]:
    """
    Group citations by proximity to identify claim boundaries.
    
    Args:
        citations: List of Citation objects
        window_size: Maximum distance between citations in same claim
    
    Returns:
        List of citation groups
    """
    if not citations:
        return []
    
    # Sort citations by position
    sorted_citations = sorted(citations, key=lambda c: c.position_start)
    
    citation_groups = []
    current_group = [sorted_citations[0]]
    
    for citation in sorted_citations[1:]:
        last_citation = current_group[-1]
        distance = citation.position_start - last_citation.position_end
        
        if distance <= window_size:
            current_group.append(citation)
        else:
            citation_groups.append(current_group)
            current_group = [citation]
    
    citation_groups.append(current_group)
    
    return citation_groups


def segment_claims_boundary_detection(
    document_text: str, 
    citations: List[Citation],
    similarity_threshold: float = 0.65,
    min_claim_length: int = 50
) -> List[Dict]:
    """
    Detect claim boundaries using citation positions and InLegalBERT embeddings.
    
    Steps:
    1. Split document into sentences
    2. Get embeddings for each sentence
    3. Identify boundaries where semantic similarity drops
    4. Group sentences into claims
    5. Filter and merge short fragments
    
    Args:
        document_text: Full document text
        citations: List of Citation objects
        similarity_threshold: Threshold for identifying boundaries (lower = less aggressive)
        min_claim_length: Minimum character length for a valid claim
    
    Returns:
        List of claim dictionaries with text and positions
    """
    # Split into sentences
    sentences = sent_tokenize(document_text)
    
    if not sentences:
        return []
    
    # Filter out very short sentences (likely OCR errors or fragments)
    filtered_sentences = []
    filtered_indices = []
    for i, sent in enumerate(sentences):
        if len(sent.strip()) >= 10:  # At least 10 characters
            filtered_sentences.append(sent)
            filtered_indices.append(i)
    
    if not filtered_sentences:
        return []
    
    sentences = filtered_sentences
    
    # Get embeddings for each sentence
    sentence_embeddings = []
    for sent in sentences:
        try:
            emb = get_embeddings(sent)
            sentence_embeddings.append(emb)
        except Exception as e:
            print(f"Error embedding sentence: {e}")
            # Use zero vector as fallback
            sentence_embeddings.append(np.zeros(768))
    
    if not sentence_embeddings:
        return []
    
    sentence_embeddings = np.array(sentence_embeddings)
    
    # Calculate similarity between consecutive sentences
    similarities = []
    for i in range(len(sentence_embeddings) - 1):
        sim = cosine_similarity(
            [sentence_embeddings[i]],
            [sentence_embeddings[i + 1]]
        )[0][0]
        similarities.append(sim)
    
    if not similarities:
        # Single sentence or no similarities
        if len(document_text.strip()) >= min_claim_length:
            return [{
                "text": document_text,
                "start": 0,
                "end": len(document_text),
                "start_sentence": 0,
                "end_sentence": len(sentences)
            }]
        return []
    
    # Identify boundaries (low similarity = new claim)
    # Use percentile-based threshold - less aggressive (25% instead of 30%)
    threshold = np.percentile(similarities, 25)  # Bottom 25% = boundaries
    # Also use absolute threshold as backup
    absolute_threshold = max(threshold, similarity_threshold)
    boundaries = [i for i, sim in enumerate(similarities) if sim < absolute_threshold]
    
    # Group sentences into claims
    claims = []
    start_idx = 0
    
    # Calculate character positions for sentences
    char_positions = []
    current_pos = 0
    for sent in sentences:
        start_char = document_text.find(sent, current_pos)
        if start_char == -1:
            start_char = current_pos
        end_char = start_char + len(sent)
        char_positions.append((start_char, end_char))
        current_pos = end_char
    
    for boundary in boundaries:
        if start_idx <= boundary < len(sentences):
            claim_sentences = sentences[start_idx:boundary + 1]
            claim_text = " ".join(claim_sentences).strip()
            
            # Skip if too short
            if len(claim_text) < min_claim_length:
                start_idx = boundary + 1
                continue
            
            # Get character positions
            if start_idx < len(char_positions) and boundary < len(char_positions):
                start_char = char_positions[start_idx][0]
                end_char = char_positions[boundary][1]
            else:
                start_char = 0
                end_char = len(claim_text)
            
            claims.append({
                "text": claim_text,
                "start": start_char,
                "end": end_char,
                "start_sentence": start_idx,
                "end_sentence": boundary + 1
            })
            start_idx = boundary + 1
    
    # Add last claim
    if start_idx < len(sentences):
        claim_sentences = sentences[start_idx:]
        claim_text = " ".join(claim_sentences).strip()
        
        # Only add if long enough
        if len(claim_text) >= min_claim_length:
            if start_idx < len(char_positions):
                start_char = char_positions[start_idx][0]
                end_char = char_positions[-1][1] if char_positions else len(claim_text)
            else:
                start_char = 0
                end_char = len(claim_text)
            
            claims.append({
                "text": claim_text,
                "start": start_char,
                "end": end_char,
                "start_sentence": start_idx,
                "end_sentence": len(sentences)
            })
    
    # Merge adjacent short claims
    merged_claims = []
    i = 0
    while i < len(claims):
        current_claim = claims[i]
        
        # If current claim is short, try to merge with next
        if len(current_claim["text"]) < min_claim_length * 2 and i + 1 < len(claims):
            next_claim = claims[i + 1]
            merged_text = current_claim["text"] + " " + next_claim["text"]
            
            # Merge if combined is reasonable length
            if len(merged_text) < 2000:  # Max 2000 chars per claim
                merged_claim = {
                    "text": merged_text.strip(),
                    "start": current_claim["start"],
                    "end": next_claim["end"],
                    "start_sentence": current_claim["start_sentence"],
                    "end_sentence": next_claim["end_sentence"]
                }
                merged_claims.append(merged_claim)
                i += 2  # Skip both claims
                continue
        
        merged_claims.append(current_claim)
        i += 1
    
    # Final filter: remove claims that are still too short
    final_claims = [c for c in merged_claims if len(c["text"].strip()) >= min_claim_length]
    
    # Post-process: clean up fragments and merge continuations
    cleaned_claims = _clean_and_merge_claims(final_claims, document_text)
    
    return cleaned_claims


def _clean_and_merge_claims(claims: List[Dict], document_text: str) -> List[Dict]:
    """
    Clean up claims by:
    1. Removing claims that start with fragments (single letters, numbers, continuation words)
    2. Removing claims that end mid-word
    3. Merging claims that are clearly continuations
    """
    if not claims:
        return []
    
    cleaned = []
    i = 0
    
    while i < len(claims):
        claim = claims[i]
        text = claim["text"].strip()
        
        # Check if claim starts with a fragment
        words = text.split()
        first_word = words[0] if words else ""
        
        starts_with_fragment = (
            len(text) > 0 and (
                # Single lowercase letter followed by space (e.g., "e opinion")
                (len(first_word) == 1 and first_word.islower() and first_word.isalpha()) or
                # Starts with number (e.g., "12 weight")
                (text[0].isdigit() and (len(first_word) <= 3 or first_word.isdigit())) or
                # Starts with continuation words (e.g., "Because:", "But ")
                first_word.lower() in ["because:", "but", "and", "or"] or
                text.lower().startswith(("because:", "but ", "and ", "or "))
            )
        )
        
        # Check if claim ends mid-word or mid-sentence
        last_word = words[-1] if words else ""
        ends_mid_word = (
            len(text) > 0 and (
                # Ends with single letter (e.g., "the J", "and t")
                (len(last_word) == 1 and last_word.isalpha()) or
                # Ends with incomplete word that looks cut off (e.g., "premie" from "premier")
                (len(last_word) > 0 and len(last_word) <= 5 and 
                 not last_word.lower() in ['the', 'and', 'for', 'but', 'are', 'was', 'has', 'had', 'with', 'from', 'this', 'that', 'court', 'case', 'law', 'judge', 'judges'] and
                 not text[-1] in '.!?;:,') or
                # Ends without proper punctuation and last word is suspiciously short
                (not text[-1] in '.!?;:,' and len(last_word) < 6 and len(words) > 1 and
                 last_word.lower() not in ['court', 'case', 'law', 'judge', 'judges', 'act', 'code', 'article', 'section'])
            )
        )
        
        # If claim is a fragment, try to merge with next
        if (starts_with_fragment or ends_mid_word) and i + 1 < len(claims):
            next_claim = claims[i + 1]
            merged_text = text + " " + next_claim["text"].strip()
            
            # Clean the merged text
            merged_text = _clean_claim_text(merged_text)
            
            # Merge if combined length is reasonable
            if len(merged_text) < 3000:  # Max 3000 chars
                merged_claim = {
                    "text": merged_text,
                    "start": claim["start"],
                    "end": next_claim["end"],
                    "start_sentence": claim.get("start_sentence", 0),
                    "end_sentence": next_claim.get("end_sentence", 0)
                }
                cleaned.append(merged_claim)
                i += 2
                continue
        
        # If claim ends mid-word, try to merge with previous claim
        if ends_mid_word and len(cleaned) > 0:
            prev_claim = cleaned[-1]
            merged_text = prev_claim["text"] + " " + text
            merged_text = _clean_claim_text(merged_text)
            
            if len(merged_text) < 3000:
                prev_claim["text"] = merged_text
                prev_claim["end"] = claim["end"]
                prev_claim["end_sentence"] = claim.get("end_sentence", 0)
                i += 1
                continue
        
        # If still a fragment after potential merge, skip it
        if starts_with_fragment and len(text) < 100:
            i += 1
            continue
        
        # Clean up the text: remove leading/trailing fragments
        cleaned_text = _clean_claim_text(text)
        
        if len(cleaned_text) >= 50:  # Minimum length after cleaning
            claim["text"] = cleaned_text
            cleaned.append(claim)
        
        i += 1
    
    return cleaned


def _clean_claim_text(text: str) -> str:
    """
    Clean up claim text by removing leading fragments and fixing common issues.
    """
    text = text.strip()
    words = text.split()
    
    if not words:
        return text
    
    # Remove leading single letters (e.g., "e opinion" -> "opinion")
    while len(words) > 0 and len(words[0]) == 1 and words[0].islower() and words[0].isalpha():
        words = words[1:]
    
    # Remove leading numbers that are likely page numbers (e.g., "12 weight" -> "weight")
    while len(words) > 0 and words[0].isdigit() and len(words[0]) <= 3:
        words = words[1:]
    
    # Remove standalone numbers in the middle (e.g., "opinion 12 weight" -> "opinion weight")
    cleaned_words = []
    for i, word in enumerate(words):
        # Skip standalone numbers that are likely page numbers
        if word.isdigit() and len(word) <= 3:
            # Check if it's between two words (likely a page number)
            if i > 0 and i < len(words) - 1:
                continue
        cleaned_words.append(word)
    words = cleaned_words
    
    # Remove trailing incomplete words (single letters, very short words, incomplete endings)
    while len(words) > 0:
        last_word = words[-1]
        # Remove single letters
        if len(last_word) == 1 and last_word.isalpha():
            words = words[:-1]
        # Remove "the", "and", "or", "for" at the end if no punctuation (likely incomplete)
        elif last_word.lower() in ['the', 'and', 'or', 'for', 'but', 'with', 'from'] and not last_word[-1] in '.!?;:,':
            words = words[:-1]
        # Remove very short incomplete words (unless they're common words)
        elif len(last_word) <= 5 and last_word.lower() not in ['the', 'and', 'for', 'but', 'are', 'was', 'has', 'had', 'act', 'law', 'court', 'case', 'code']:
            # Check if it looks incomplete (no punctuation, not a common word)
            if not last_word[-1] in '.!?;:,':
                words = words[:-1]
            else:
                break
        # Remove words that look incomplete (e.g., "premie" from "premier")
        elif len(last_word) > 0 and len(last_word) <= 6 and not last_word[-1] in '.!?;:,':
            # Check if it's a known incomplete word pattern
            if last_word.lower() in ['premie', 'remuner', 'appoint', 'consult']:
                words = words[:-1]
            else:
                break
        else:
            break
    
    text = ' '.join(words).strip()
    
    # Capitalize first letter if it's lowercase (after removing fragments)
    if len(text) > 0 and text[0].islower():
        text = text[0].upper() + text[1:]
    
    # Remove trailing incomplete fragments (e.g., "and t", "some premie")
    if len(text) > 0:
        # If ends with very short word without punctuation, might be incomplete
        last_word = text.split()[-1] if text.split() else ""
        if len(last_word) <= 4 and not text[-1] in '.!?;:,' and last_word.lower() not in ['court', 'case', 'law', 'act', 'code']:
            # Might be incomplete, but we'll keep it if it's the only content
            if len(text.split()) > 1:
                # Remove if it looks incomplete
                if last_word.lower() in ['t', 'j', 'a', 'i']:
                    text = ' '.join(text.split()[:-1])
    
    return text.strip()


def calculate_mapping_confidence(claim: Claim, citation: Citation) -> float:
    """
    Calculate confidence score for claim-citation mapping.
    
    Args:
        claim: Claim object
        citation: Citation object
    
    Returns:
        Confidence score (0.0-1.0)
    """
    # Proximity-based confidence
    # Citations within claim boundaries get higher confidence
    if claim.position_start <= citation.position_start <= claim.position_end:
        # Citation is within claim
        distance = min(
            abs(citation.position_start - claim.position_start),
            abs(citation.position_end - claim.position_end)
        )
        # Normalize distance (closer = higher confidence)
        max_distance = claim.position_end - claim.position_start
        if max_distance > 0:
            proximity_score = 1.0 - (distance / max_distance)
            return max(0.5, min(1.0, proximity_score))
        return 0.8
    else:
        # Citation is outside claim but nearby
        distance = min(
            abs(citation.position_start - claim.position_start),
            abs(citation.position_start - claim.position_end)
        )
        # Further away = lower confidence
        if distance < 200:  # Within 200 characters
            return 0.6
        elif distance < 500:  # Within 500 characters
            return 0.4
        else:
            return 0.2


def segment_claims_with_citations(
    local_db: Session,
    document_id: int,
    use_citation_guidance: bool = True
) -> List[Claim]:
    """
    Segment claims using InLegalBERT, guided by citation information.
    
    Claims are stored in Local PostgreSQL only (AI/ML processing data).
    
    Args:
        local_db: Local PostgreSQL database session
        document_id: Document ID
        use_citation_guidance: Whether to use citation positions for guidance
    
    Returns:
        List of Claim objects
    """
    # 1. Get document and citations from Local PostgreSQL
    document = local_db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not document.ocr_text:
        raise HTTPException(status_code=400, detail="No OCR text available")
    
    citations = get_citations_by_document(local_db, document_id)
    
    # 2. Use citation-guided segmentation or full text
    if use_citation_guidance and citations:
        # Group citations by proximity
        citation_groups = group_citations_by_proximity(citations, window_size=500)
        
        # Extract potential claim segments using sentence-aware boundaries
        all_claims = []
        for group in citation_groups:
            # Find sentence boundaries around the citation group
            # Use the first citation's start and last citation's end
            first_citation_pos = group[0].position_start
            last_citation_pos = group[-1].position_end
            
            # Find sentence boundaries around first citation
            start, _ = find_sentence_boundaries_around_position(
                document.ocr_text,
                first_citation_pos,
                sentences_before=2,
                sentences_after=0,  # Will extend to last citation
                min_chars_before=200,
                min_chars_after=0
            )
            
            # Find sentence boundaries around last citation
            _, end = find_sentence_boundaries_around_position(
                document.ocr_text,
                last_citation_pos,
                sentences_before=0,  # Already covered by first citation
                sentences_after=2,
                min_chars_before=0,
                min_chars_after=200
            )
            
            # Ensure we have a reasonable window
            if end - start < 100:  # Too small, use minimum window
                start = max(0, first_citation_pos - 200)
                end = min(len(document.ocr_text), last_citation_pos + 200)
            
            segment_text = document.ocr_text[start:end]
            
            # Use boundary detection on this segment
            segment_claims = segment_claims_boundary_detection(
                segment_text,
                group,
                similarity_threshold=0.65,  # Less aggressive
                min_claim_length=50  # Minimum 50 characters
            )
            
            # Adjust positions to absolute document positions
            for claim in segment_claims:
                claim["start"] = start + claim.get("start", 0)
                claim["end"] = start + claim.get("end", len(segment_text))
                all_claims.append(claim)
    else:
        # Fallback: Use full text segmentation
        all_claims = segment_claims_boundary_detection(
            document.ocr_text,
            citations,
            similarity_threshold=0.65,  # Less aggressive
            min_claim_length=50  # Minimum 50 characters
        )
    
    # 3. Create Claim objects
    claim_objects = []
    for claim_data in all_claims:
        # Determine claim type (simple heuristic - can be improved)
        claim_text_lower = claim_data["text"].lower()
        claim_type = "general"
        if any(word in claim_text_lower for word in ["criminal", "murder", "theft", "robbery"]):
            claim_type = "criminal"
        elif any(word in claim_text_lower for word in ["civil", "contract", "tort"]):
            claim_type = "civil"
        elif any(word in claim_text_lower for word in ["constitution", "article", "fundamental"]):
            claim_type = "constitutional"
        
        # Calculate confidence (can be improved with actual model confidence)
        confidence = 0.85  # Default confidence
        
        claim = Claim(
            document_id=document_id,
            claim_text=claim_data["text"],
            position_start=claim_data["start"],
            position_end=claim_data["end"],
            claim_type=claim_type,
            confidence_score=confidence
        )
        claim_objects.append(claim)
    
    # 4. Save claims in batches to avoid connection timeouts
    BATCH_SIZE = 5  # Insert 5 claims at a time
    saved_claims = []
    
    for i in range(0, len(claim_objects), BATCH_SIZE):
        batch = claim_objects[i:i + BATCH_SIZE]
        try:
            local_db.add_all(batch)
            local_db.commit()
            
            # Refresh to get IDs
            for claim in batch:
                local_db.refresh(claim)
                saved_claims.append(claim)
        except Exception as e:
            local_db.rollback()
            # Try individual inserts if batch fails
            print(f"Batch insert failed, trying individual inserts: {e}")
            for claim in batch:
                try:
                    local_db.add(claim)
                    local_db.commit()
                    local_db.refresh(claim)
                    saved_claims.append(claim)
                except Exception as individual_error:
                    local_db.rollback()
                    print(f"Failed to insert claim: {individual_error}")
                    # Continue with next claim
                    continue
    
    # Update claim_objects to only include successfully saved claims
    claim_objects = saved_claims
    
    # 5. Save claims to JSON file
    claims_filename = f"document_{document_id}_claims.json"
    claims_file_path = CLAIMS_DIR / claims_filename
    
    claims_data = [{
        "id": c.id,
        "document_id": c.document_id,
        "claim_text": c.claim_text,
        "claim_type": c.claim_type,
        "position_start": c.position_start,
        "position_end": c.position_end,
        "confidence_score": float(c.confidence_score) if c.confidence_score else None,
        "created_at": c.created_at.isoformat() if c.created_at else None
    } for c in claim_objects]
    
    with open(claims_file_path, "w", encoding="utf-8") as f:
        json.dump(claims_data, f, indent=2, ensure_ascii=False)
    
    # 6. Create claim-citation mappings in batches
    mapping_batch = []
    for claim in claim_objects:
        # Find citations within or near this claim
        for citation in citations:
            # Check if citation is within claim or nearby
            if (claim.position_start - 200 <= citation.position_start <= claim.position_end + 200):
                confidence = calculate_mapping_confidence(claim, citation)
                
                mapping = ClaimCitationMapping(
                    claim_id=claim.id,
                    citation_id=citation.id,
                    relationship_type="supports",
                    confidence_score=confidence
                )
                mapping_batch.append(mapping)
    
    # Insert mappings in batches with proper error tracking
    successful_mappings = 0
    failed_mappings = 0
    mapping_errors = []
    
    if mapping_batch:
        MAPPING_BATCH_SIZE = 10
        for i in range(0, len(mapping_batch), MAPPING_BATCH_SIZE):
            batch = mapping_batch[i:i + MAPPING_BATCH_SIZE]
            try:
                local_db.add_all(batch)
                local_db.commit()
                successful_mappings += len(batch)
            except Exception as e:
                local_db.rollback()
                error_msg = f"Failed to insert mapping batch: {e}"
                print(error_msg)
                mapping_errors.append(error_msg)
                
                # Try individual inserts
                for mapping in batch:
                    try:
                        local_db.add(mapping)
                        local_db.commit()
                        successful_mappings += 1
                    except Exception as individual_error:
                        local_db.rollback()
                        failed_mappings += 1
                        error_detail = f"Failed to insert mapping (claim_id={mapping.claim_id}, citation_id={mapping.citation_id}): {individual_error}"
                        print(error_detail)
                        mapping_errors.append(error_detail)
        
        # Log summary
        total_mappings = len(mapping_batch)
        success_rate = (successful_mappings / total_mappings * 100) if total_mappings > 0 else 0
        
        print(f"Mapping insertion summary: {successful_mappings}/{total_mappings} successful ({success_rate:.1f}%)")
        
        # If too many mappings failed, raise a warning
        # This ensures data integrity - if most mappings fail, something is wrong
        if failed_mappings > 0:
            failure_rate = (failed_mappings / total_mappings * 100) if total_mappings > 0 else 0
            if failure_rate > 50:  # More than 50% failed
                error_summary = f"Critical: {failed_mappings}/{total_mappings} claim-citation mappings failed ({failure_rate:.1f}%). Data integrity compromised."
                print(f"⚠️  {error_summary}")
                # Optionally raise an exception - uncomment if you want strict enforcement
                # raise HTTPException(
                #     status_code=500,
                #     detail=f"Failed to create claim-citation mappings: {error_summary}"
                # )
            elif failure_rate > 20:  # More than 20% failed
                print(f"⚠️  Warning: {failed_mappings}/{total_mappings} claim-citation mappings failed ({failure_rate:.1f}%). Some claims may be missing citation mappings.")
    
    return claim_objects


def get_all_claims(local_db: Session, skip: int = 0, limit: int = 100) -> List[Claim]:
    """Get all claims across all documents from Local PostgreSQL."""
    return local_db.query(Claim).offset(skip).limit(limit).all()


def get_claims_by_document(local_db: Session, document_id: int) -> List[Claim]:
    """Get all claims for a document from Local PostgreSQL."""
    return local_db.query(Claim).filter(Claim.document_id == document_id).all()


def get_claim_by_id(local_db: Session, claim_id: int) -> Claim:
    """Get a specific claim by ID from Local PostgreSQL."""
    claim = local_db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim


def delete_claims_by_document(local_db: Session, document_id: int) -> int:
    """Delete all claims for a document from Local PostgreSQL."""
    # Also delete mappings
    claims = local_db.query(Claim).filter(Claim.document_id == document_id).all()
    claim_ids = [claim.id for claim in claims]
    
    if claim_ids:
        local_db.query(ClaimCitationMapping).filter(
            ClaimCitationMapping.claim_id.in_(claim_ids)
        ).delete()
    
    deleted_count = local_db.query(Claim).filter(Claim.document_id == document_id).delete()
    local_db.commit()
    return deleted_count


def get_claim_citation_mappings(local_db: Session, claim_id: int) -> List[ClaimCitationMapping]:
    """Get all citation mappings for a claim from Local PostgreSQL."""
    return local_db.query(ClaimCitationMapping).filter(
        ClaimCitationMapping.claim_id == claim_id
    ).all()


