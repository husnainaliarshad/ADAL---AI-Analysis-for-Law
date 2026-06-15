"""
LLM Service for Verification Reasoning
Uses Ollama for local LLM inference (free, no API keys needed)
"""
import os
import json
import re
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

load_dotenv()

from openai import OpenAI
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# LLM configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("LLM_MODEL_NAME", "deepseek-chat")
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "llama2")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")

_client = None

def _get_client():
    global _client
    if _client is None:
        if LLM_PROVIDER == "deepseek":
            if not DEEPSEEK_API_KEY:
                logger.warning("DEEPSEEK_API_KEY not set, falling back to Ollama")
            else:
                _client = OpenAI(
                    api_key=DEEPSEEK_API_KEY,
                    base_url="https://api.deepseek.com",
                )
    return _client



def get_llm_provider():
    """Get the configured LLM provider name."""
    return "ollama"


def get_llm_model_name():
    """Get the configured LLM model name."""
    return LLM_MODEL_NAME


def verify_claim_with_llm(
    claim_text: str,
    evidence_paragraphs: List[str],
    citations: Optional[List[Dict]] = None,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Verify a claim using LLM reasoning.
    """
    client = _get_client()
    if client and LLM_PROVIDER == "deepseek":
        return _verify_with_deepseek(claim_text, evidence_paragraphs, citations, system_prompt)
    return _verify_with_ollama(claim_text, evidence_paragraphs, citations, system_prompt)


def _verify_with_deepseek(
    claim_text: str,
    evidence_paragraphs: List[str],
    citations: Optional[List[Dict]] = None,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """Verify claim using DeepSeek API."""
    client = _get_client()
    
    full_prompt = _build_verification_prompt(
        claim_text, evidence_paragraphs, citations, system_prompt
    )
    
    try:
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt or "You are a legal expert. Verify the claim based on evidence. Respond with JSON."},
                {"role": "user", "content": full_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        result_text = response.choices[0].message.content
        result = json.loads(result_text)
        return _normalize_verification_result(result)
    except Exception as e:
        logger.error(f"DeepSeek verification failed: {e}")
        # Fallback to Ollama if DeepSeek fails
        return _verify_with_ollama(claim_text, evidence_paragraphs, citations, system_prompt)



def _build_verification_prompt(
    claim_text: str,
    evidence_paragraphs: List[str],
    citations: Optional[List[Dict]] = None,
    system_prompt: Optional[str] = None
) -> str:
    """
    Build the prompt for claim verification.
    
    Returns:
        Full prompt string for Ollama
    """
    if system_prompt is None:
        system_prompt = """Legal expert. Verify claims. Respond with JSON only."""

    # Build evidence section - limit to 3 and truncate each to 300 chars
    evidence_text = "\n\n".join([
        f"E{i+1}: {evidence[:300]}{'...' if len(evidence) > 300 else ''}" 
        for i, evidence in enumerate(evidence_paragraphs[:3])  # Only top 3 for speed
    ])
    
    # Build citations section if available
    citations_text = ""
    if citations:
        citations_list = [
            f"- {cit.get('citation_text', cit.get('text', str(cit)))}"
            for cit in citations[:5]  # Limit to top 5
        ]
        citations_text = f"\n\nRelevant Citations:\n" + "\n".join(citations_list)
    
    # Truncate claim text
    claim_short = claim_text[:400] + ('...' if len(claim_text) > 400 else '')
    
    user_prompt = f"""Claim: {claim_short}

Evidence:
{evidence_text}
{citations_text}

JSON:
{{
    "verdict": "supported|contradicted|insufficient_evidence|uncertain",
    "confidence": 0.0-1.0,
    "reasoning": "Brief",
    "supporting_evidence": ["1"],
    "contradicting_evidence": [],
    "citations_used": []
}}"""

    # Combine system and user prompt for Ollama
    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    
    return full_prompt


def _verify_with_ollama(
    claim_text: str,
    evidence_paragraphs: List[str],
    citations: Optional[List[Dict]] = None,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """Verify claim using Ollama (local LLM)."""
    try:
        import requests
        
        full_prompt = _build_verification_prompt(
            claim_text, evidence_paragraphs, citations, system_prompt
        )
        
        # Limit evidence to top 3 to prevent timeout (local models are slow)
        limited_evidence = evidence_paragraphs[:3] if len(evidence_paragraphs) > 3 else evidence_paragraphs
        
        # Rebuild prompt with limited evidence
        full_prompt = _build_verification_prompt(
            claim_text, limited_evidence, citations, system_prompt
        )
        
        # Further optimize: limit prompt length
        if len(full_prompt) > 2000:
            # Truncate prompt if too long
            full_prompt = full_prompt[:2000] + "\n\n[Prompt truncated for speed]"
        
        response = requests.post(
            f"{LLM_BASE_URL}/api/generate",
            json={
                "model": LLM_MODEL_NAME,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,  # Lower for faster, more deterministic
                    "num_predict": 300  # Very short response (just JSON)
                }
            },
            timeout=180  # 3 minutes timeout
        )
        
        if response.status_code != 200:
            raise ValueError(f"Ollama API error: {response.status_code} - {response.text}")
        
        result_text = response.json().get("response", "")
        
        if not result_text:
            raise ValueError("Empty response from Ollama")
        
        # Try to extract JSON from response
        try:
            # Find JSON in response (might have extra text before/after)
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(0)
            result = json.loads(result_text)
        except json.JSONDecodeError:
            # Fallback: try to parse as text and create structured response
            print(f"Warning: Could not parse JSON from Ollama response. Raw response: {result_text[:200]}")
            result = {
                "verdict": "uncertain",
                "confidence": 0.5,
                "reasoning": result_text[:1000] if len(result_text) > 1000 else result_text,
                "supporting_evidence": [],
                "contradicting_evidence": [],
                "citations_used": []
            }
        
        return _normalize_verification_result(result)
        
    except ImportError:
        raise ValueError("requests library not installed. Install with: pip install requests")
    except Exception as e:
        raise ValueError(f"Ollama API error: {str(e)}")


def _normalize_verification_result(result: Dict) -> Dict[str, Any]:
    """Normalize and validate verification result."""
    # Helper to convert list items to strings
    def to_string_list(items):
        if not items:
            return []
        return [str(item) for item in items]
    
    # Default values
    normalized = {
        "verdict": result.get("verdict", "uncertain"),
        "confidence": float(result.get("confidence", 0.5)),
        "reasoning": result.get("reasoning", ""),
        "supporting_evidence": to_string_list(result.get("supporting_evidence", [])),
        "contradicting_evidence": to_string_list(result.get("contradicting_evidence", [])),
        "citations_used": to_string_list(result.get("citations_used", []))
    }
    
    # Validate verdict
    valid_verdicts = ["supported", "contradicted", "insufficient_evidence", "uncertain"]
    if normalized["verdict"] not in valid_verdicts:
        normalized["verdict"] = "uncertain"
    
    # Clamp confidence
    normalized["confidence"] = max(0.0, min(1.0, normalized["confidence"]))
    
    return normalized
