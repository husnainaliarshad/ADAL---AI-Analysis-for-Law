"""
Case-Aware Agentic Pipeline for ADAL Backend

Unified LangGraph agent that can use all tools within a case context:
  - RAG search (Pakistani legal statutes)
  - Citation extraction (from uploaded case documents)
  - Claim segmentation (InLegalBERT-based)
  - Evidence retrieval (FAISS on Supreme Court judgments)
  - Claim verification (Ollama LLM)
  - Draft generation (HTML legal drafts)
  - Case summary (structured case brief)

Architecture:
  START -> intent_router -> [tool node] -> response_synthesizer -> db_writer -> END

The agent resolves case context automatically and injects it into prompts.
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, List, Optional

import tiktoken
from fastapi import HTTPException
from langgraph.graph import END, START, StateGraph
from openai import OpenAI
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from typing_extensions import TypedDict

from app.models.case_model import Case
from app.models.chat_model import Conversation, Message
from app.models.document_model import Document
from app.models.claim_model import Claim
from app.models.citation_model import Citation
from app.models.evidence_model import Evidence
from app.models.verification_report_model import VerificationReport
from app.models.draft_model import Draft, DocumentVersion

logger = logging.getLogger(__name__)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("LLM_MODEL_NAME", "deepseek-chat")

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not DEEPSEEK_API_KEY:
            raise HTTPException(status_code=503, detail="DEEPSEEK_API_KEY not set.")
        _client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
    return _client


# Token counting
_encoder = None


def _count_tokens(text: str) -> int:
    global _encoder
    if _encoder is None:
        try:
            _encoder = tiktoken.encoding_for_model("gpt-4")
        except Exception:
            _encoder = tiktoken.get_encoding("cl100k_base")
    return len(_encoder.encode(text))


# ── Available tools ──
TOOLS = [
    {
        "name": "rag_search",
        "description": "Search Pakistani legal statutes and case law for a legal question. Use for general legal principles, section lookups, and statutory interpretation.",
        "params": {"query": "the legal question to search for"},
    },
    {
        "name": "extract_citations",
        "description": "Find and extract Pakistani legal citations from an uploaded case document (PLD, SCMR, PPC, CPC, YLR, etc.)",
        "params": {"document_id": "ID of the document to scan"},
    },
    {
        "name": "segment_claims",
        "description": "Break an uploaded document into distinct factual claims using AI segmentation. Required before evidence retrieval or verification.",
        "params": {"document_id": "ID of the document to segment"},
    },
    {
        "name": "retrieve_evidence",
        "description": "Find supporting or contradicting precedent from the Supreme Court of Pakistan judgments dataset for a specific claim.",
        "params": {"claim_id": "ID of the claim to find evidence for"},
    },
    {
        "name": "verify_claim",
        "description": "Verify whether a claim is legally supported, contradicted, or uncertain based on retrieved evidence. Uses LLM reasoning.",
        "params": {"claim_id": "ID of the claim to verify"},
    },
    {
        "name": "case_summary",
        "description": "Generate a structured brief of the entire case including facts, claims, evidence, and verification status.",
        "params": {},
    },
    {
        "name": "draft_document",
        "description": "Write or edit a legal document (plaint, written statement, bail application, etc.) using case facts and legal sources.",
        "params": {"draft_id": "ID of the draft to edit (optional)", "instructions": "what to draft"},
    },
    {
        "name": "chat",
        "description": "General conversation, clarification, or guidance. No tool execution needed.",
        "params": {},
    },
]


# ── Agent State ──
class CaseAgentState(TypedDict):
    db: Any
    user_id: int
    conversation_id: int
    case_id: Optional[int]
    user_message: str
    message_history: list

    # Intent router output
    selected_tool: str
    tool_params: dict
    tool_reason: str

    # Tool outputs
    tool_results: dict

    # Response
    final_response: str
    response_metadata: dict
    message_id: int


# ── Case context builder ──
def _build_case_context(db: Session, case_id: int) -> str:
    """Read case state from DB and build a context block for LLM prompts."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        return ""

    doc_count = db.query(Document).filter(Document.case_id == case_id).count()
    docs = db.query(Document).filter(Document.case_id == case_id).all()
    citation_count = 0
    claim_count = 0
    evidence_count = 0
    verified_count = 0

    for doc in docs:
        citation_count += db.query(Citation).filter(Citation.document_id == doc.id).count()
        claims = db.query(Claim).filter(Claim.document_id == doc.id).all()
        claim_count += len(claims)
        for claim in claims:
            evidence_count += db.query(Evidence).filter(Evidence.claim_id == claim.id).count()
            verified_count += db.query(VerificationReport).filter(
                VerificationReport.claim_id == claim.id
            ).count()

    doc_list = "\n".join(f"  - [{d.id}] {d.filename}" for d in docs[:10])
    if len(docs) > 10:
        doc_list += f"\n  - ... and {len(docs) - 10} more"

    return f"""CASE CONTEXT:
  Case: {case.title}
  Case Number: {case.case_number or 'N/A'}
  Type: {case.case_type or 'civil'}
  Status: {case.status}
  Documents ({doc_count}): 
{doc_list}
  Citations: {citation_count} found
  Claims: {claim_count} segmented
  Evidence: {evidence_count} paragraphs retrieved
  Verified: {verified_count}/{claim_count} claims verified
"""


# ── Node 1: Intent Router ──
ROUTER_PROMPT = """\
You are ADAL's case workflow router. The user is working on a Pakistani legal case.

{case_context}

AVAILABLE TOOLS:
{tool_list}

RULES:
- The case context lists documents with IDs in [brackets]. Use those IDs.
- If the user says "my document" or "the uploaded file", use the most recent document ID from the case context.
- Select the BEST tool for the user's request.
- Prefer specific tools over generic chat when applicable.
- If the user mentions a document_id, claim_id, or draft_id, use it.
- For legal questions about statutes, use rag_search.
- For document analysis, guide them to extract_citations then segment_claims then retrieve_evidence then verify_claim (in order).
- If the request is ambiguous, ask for clarification with tool=chat.

Respond with JSON only:
{{"tool": "tool_name", "reason": "brief reason", "params": {{"key": "value"}}}}
"""


def intent_router_node(state: CaseAgentState) -> dict:
    """Node 1 — Routes user intent to the correct tool."""
    client = _get_client()

    case_context = ""
    if state.get("case_id"):
        case_context = _build_case_context(state["db"], state["case_id"])

    tool_list = "\n".join(
        f"- {t['name']}: {t['description']}" for t in TOOLS
    )

    prompt = ROUTER_PROMPT.format(
        case_context=case_context or "(No active case — user is outside a case workflow)",
        tool_list=tool_list,
    )

    messages = [{"role": "system", "content": prompt}]
    for msg in state["message_history"][-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        resp = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=256,
        )
        raw = resp.choices[0].message.content.strip()
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        parsed = json.loads(json_match.group() if json_match else raw)

        tool_name = parsed.get("tool", "chat")
        tool_params = parsed.get("params", {})
        tool_reason = parsed.get("reason", "")

        # Validate tool exists
        valid_tools = {t["name"] for t in TOOLS}
        if tool_name not in valid_tools:
            tool_name = "chat"
            tool_params = {}
            tool_reason = "Fallback: unknown tool requested"

        return {
            "selected_tool": tool_name,
            "tool_params": tool_params,
            "tool_reason": tool_reason,
        }
    except Exception as e:
        logger.warning("Router failed: %s, defaulting to chat", e)
        return {
            "selected_tool": "chat",
            "tool_params": {},
            "tool_reason": "Router error, defaulting to chat",
        }


# ── Tool Nodes ──

def rag_search_node(state: CaseAgentState) -> dict:
    """Tool: Search Pakistani legal library with vector similarity."""
    from app.services.vector_retrieval_service import search_legal_library


    params = state.get("tool_params", {})
    query = params.get("query", state["user_message"])

    all_results = []
    seen = set()

    try:
        results = search_legal_library(query, k=10, threshold=0.5)
        for res in results:
            h = hash(res["content"][:200])
            if h not in seen:
                seen.add(h)
                all_results.append({
                    "law_title": res["law_title"], 
                    "content": res["content"],
                    "url": res["metadata"].get("url", ""), 
                    "similarity": round(res["similarity"], 4),
                })
    except Exception as e:
        logger.error("RAG search failed: %s", e)


    all_results.sort(key=lambda x: x["similarity"], reverse=True)
    all_results = all_results[:10]

    return {"tool_results": {
        "tool": "rag_search",
        "query": query,
        "results": all_results,
        "count": len(all_results),
    }}


def _resolve_document_id(state, doc_id):
    if doc_id:
        try:
            return int(str(doc_id))
        except (ValueError, TypeError):
            pass
    case_id = state.get("case_id")
    if case_id:
        from app.models.document_model import Document
        doc = state["db"].query(Document).filter(Document.case_id == case_id).order_by(Document.id.desc()).first()
        if doc:
            return doc.id
    return None



def extract_citations_node(state: CaseAgentState) -> dict:
    """Tool: Extract citations from a case document."""
    params = state.get("tool_params", {})
    raw_doc_id = params.get("document_id")
    doc_id = _resolve_document_id(state, raw_doc_id)

    if not doc_id:
        return {"tool_results": {"tool": "extract_citations", "error": "No document found. Upload a file to the case first.", "citations": []}}

    try:
        from app.services.citation_service import extract_citations_from_document
        citations = extract_citations_from_document(state["db"], doc_id)
        cit_list = [
            {"text": c.citation_text, "type": c.citation_type, "confidence": c.confidence_score}
            for c in citations
        ]
        return {"tool_results": {
            "tool": "extract_citations",
            "document_id": doc_id,
            "citations": cit_list,
            "count": len(cit_list),
        }}
    except Exception as e:
        logger.error("Citation extraction failed: %s", e)
        return {"tool_results": {"tool": "extract_citations", "error": str(e), "citations": []}}


def segment_claims_node(state: CaseAgentState) -> dict:
    """Tool: Segment a document into factual claims."""
    params = state.get("tool_params", {})
    raw_doc_id = params.get("document_id")
    doc_id = _resolve_document_id(state, raw_doc_id)

    if not doc_id:
        return {"tool_results": {"tool": "segment_claims", "error": "No document found. Upload a file to the case first.", "claims": []}}

    try:
        from app.services.claim_service import segment_claims_with_citations
        claims = segment_claims_with_citations(state["db"], doc_id)
        claim_list = [
            {"id": c.id, "text": c.claim_text[:200], "type": c.claim_type}
            for c in claims
        ]
        return {"tool_results": {
            "tool": "segment_claims",
            "document_id": doc_id,
            "claims": claim_list,
            "count": len(claim_list),
        }}
    except Exception as e:
        logger.error("Claim segmentation failed: %s", e)
        return {"tool_results": {"tool": "segment_claims", "error": str(e), "claims": []}}


def retrieve_evidence_node(state: CaseAgentState) -> dict:
    """Tool: Retrieve Supreme Court evidence for a claim."""
    params = state.get("tool_params", {})
    claim_id = params.get("claim_id")

    if not claim_id:
        return {"tool_results": {"tool": "retrieve_evidence", "error": "No claim_id provided", "evidence": []}}

    try:
        from app.services.evidence_service import retrieve_evidence_for_claim
        evidence = retrieve_evidence_for_claim(state["db"], int(claim_id))
        ev_list = [
            {"id": e.id, "text": e.paragraph_text[:300], "relevance": e.relevance_score}
            for e in evidence
        ]
        return {"tool_results": {
            "tool": "retrieve_evidence",
            "claim_id": claim_id,
            "evidence": ev_list,
            "count": len(ev_list),
        }}
    except Exception as e:
        logger.error("Evidence retrieval failed: %s", e)
        return {"tool_results": {"tool": "retrieve_evidence", "error": str(e), "evidence": []}}


def verify_claim_node(state: CaseAgentState) -> dict:
    """Tool: Verify a claim against evidence using LLM."""
    params = state.get("tool_params", {})
    claim_id = params.get("claim_id")

    if not claim_id:
        return {"tool_results": {"tool": "verify_claim", "error": "No claim_id provided"}}

    try:
        from app.services.verification_service import verify_claim
        report = verify_claim(state["db"], int(claim_id))
        return {"tool_results": {
            "tool": "verify_claim",
            "claim_id": claim_id,
            "status": report.verification_status,
            "report": report.report_data,
        }}
    except Exception as e:
        logger.error("Claim verification failed: %s", e)
        return {"tool_results": {"tool": "verify_claim", "error": str(e)}}


def case_summary_node(state: CaseAgentState) -> dict:
    """Tool: Generate a structured case brief."""
    client = _get_client()
    case_id = state.get("case_id")

    if not case_id:
        return {"tool_results": {"tool": "case_summary", "error": "No active case"}}

    case_context = _build_case_context(state["db"], case_id)
    if not case_context:
        return {"tool_results": {"tool": "case_summary", "error": "Case not found"}}

    prompt = f"""\
{case_context}

Generate a structured case brief with these sections:

### Case Overview
2-3 sentences summarizing the matter.

### Key Facts
Bullet list of material facts.

### Legal Issues
The legal questions raised.

### Citations Found
Key statutes and case law cited.

### Evidence Summary
What evidence was retrieved from precedent.

### Verification Status
Which claims were verified and their status.

### Recommended Next Steps
What the practitioner should do next (file, research, draft).

Be concise and professional. Use the context data provided above."""

    try:
        resp = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": "You are a Pakistani legal assistant generating case briefs."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1500,
        )
        summary = resp.choices[0].message.content.strip()
        return {"tool_results": {"tool": "case_summary", "summary": summary}}
    except Exception as e:
        logger.error("Case summary failed: %s", e)
        return {"tool_results": {"tool": "case_summary", "error": str(e)}}


def draft_document_node(state: CaseAgentState) -> dict:
    """Tool: Generate legal draft HTML using case facts."""
    client = _get_client()
    params = state.get("tool_params", {})
    instructions = params.get("instructions", state["user_message"])
    case_id = state.get("case_id")

    case_context = ""
    if case_id:
        case_context = _build_case_context(state["db"], case_id)

    prompt = f"""\
{case_context}

DRAFTING INSTRUCTIONS:
{instructions}

Generate a properly formatted HTML legal document. Use:
- <h2> for headings
- <p> for paragraphs
- <ol>/<li> for numbered clauses
- <strong> for emphasis
- Proper legal formatting and spacing

The document should be ready for insertion into a legal drafting editor.
Return ONLY the HTML content, no explanation."""

    try:
        resp = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": "You are a Pakistani legal drafter. Output clean HTML only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
        html = resp.choices[0].message.content.strip()
        # Strip markdown wrappers
        html = re.sub(r"^```(?:html)?\s*\n?", "", html)
        html = re.sub(r"\n?```\s*$", "", html)
        return {"tool_results": {"tool": "draft_document", "html": html, "instructions": instructions}}
    except Exception as e:
        logger.error("Draft generation failed: %s", e)
        return {"tool_results": {"tool": "draft_document", "error": str(e)}}


def chat_node(state: CaseAgentState) -> dict:
    """Tool: General chat — no tool execution, passes through to synthesizer."""
    return {"tool_results": {"tool": "chat"}}


# ── Node: Response Synthesizer ──
SYNTHESIZER_PROMPT = """\
You are ADAL, a Pakistani legal AI assistant. The user is working on a legal case.

{case_context}

The user asked: "{user_message}"

A tool was used: **{tool_name}** — {tool_reason}

TOOL RESULTS:
{tool_results}

INSTRUCTIONS:
- Summarize the tool results in a clear, professional manner.
- If the tool errored, explain what went wrong and suggest next steps.
- If this is case analysis, suggest the next logical step in the workflow.
- Format with Markdown headers where appropriate.
- Be concise and action-oriented.
- **CRITICAL**: You have a backend system that CAN read PDFs, extract OCR text, extract citations, segment claims, and search databases. NEVER say "I cannot access PDFs" or "I am just a text-based AI". If a user asks to extract citations or claims, assure them you have the tools to do so and tell them what to do next (e.g., upload a document).
"""


def response_synthesizer_node(state: CaseAgentState) -> dict:
    """Node: Synthesize tool results into a coherent response."""
    client = _get_client()
    tool_results = state.get("tool_results", {})
    tool_name = state.get("selected_tool", "chat")

    case_context = ""
    if state.get("case_id"):
        case_context = _build_case_context(state["db"], state["case_id"])

    results_text = json.dumps(tool_results, indent=2, default=str)
    if _count_tokens(results_text) > 3000:
        results_text = json.dumps(tool_results, indent=0, default=str)[:4000]

    prompt = SYNTHESIZER_PROMPT.format(
        case_context=case_context or "(No active case)",
        user_message=state["user_message"],
        tool_name=tool_name,
        tool_reason=state.get("tool_reason", ""),
        tool_results=results_text,
    )

    messages = [{"role": "system", "content": prompt}]
    for msg in state["message_history"][-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        resp = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )
        raw = resp.choices[0].message.content.strip()
        cleaned = re.sub(r"^```(?:markdown|html)?\s*\n?", "", raw)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)

        usage = resp.usage
        response_metadata = {
            "model": DEEPSEEK_MODEL,
            "prompt_tokens": usage.prompt_tokens if usage else None,
            "completion_tokens": usage.completion_tokens if usage else None,
            "total_tokens": usage.total_tokens if usage else None,
            "tool_used": tool_name,
            "tool_reason": state.get("tool_reason", ""),
            "tool_results_summary": {
                k: v for k, v in tool_results.items()
                if k in ("tool", "count", "status", "error")
            },
        }

        return {
            "final_response": cleaned,
            "response_metadata": response_metadata,
        }
    except Exception as e:
        logger.error("Synthesizer failed: %s", e)
        return {
            "final_response": f"I encountered an error while processing your request: {str(e)}",
            "response_metadata": {"error": str(e)},
        }


# ── Node: DB Writer ──
def db_writer_node(state: CaseAgentState) -> dict:
    """Persist the assistant message."""
    from app.services.chat_service import add_message
    assistant_message = add_message(
        state["db"],
        state["conversation_id"],
        role="assistant",
        content=state["final_response"],
        metadata=state["response_metadata"],
    )
    return {"message_id": assistant_message.id}


# ── Graph Assembly ──
_compiled_graph = None


def _build_graph():
    global _compiled_graph
    if _compiled_graph is not None:
        return _compiled_graph

    graph = StateGraph(CaseAgentState)

    # Register all nodes
    graph.add_node("intent_router", intent_router_node)
    graph.add_node("rag_search", rag_search_node)
    graph.add_node("extract_citations", extract_citations_node)
    graph.add_node("segment_claims", segment_claims_node)
    graph.add_node("retrieve_evidence", retrieve_evidence_node)
    graph.add_node("verify_claim", verify_claim_node)
    graph.add_node("case_summary", case_summary_node)
    graph.add_node("draft_document", draft_document_node)
    graph.add_node("chat", chat_node)
    graph.add_node("response_synthesizer", response_synthesizer_node)
    graph.add_node("db_writer", db_writer_node)

    # Start -> Router
    graph.add_edge(START, "intent_router")

    # Router -> Tool (conditional)
    tool_nodes = {
        "rag_search": "rag_search",
        "extract_citations": "extract_citations",
        "segment_claims": "segment_claims",
        "retrieve_evidence": "retrieve_evidence",
        "verify_claim": "verify_claim",
        "case_summary": "case_summary",
        "draft_document": "draft_document",
        "chat": "chat",
    }

    graph.add_conditional_edges(
        "intent_router",
        lambda state: state.get("selected_tool", "chat"),
        tool_nodes,
    )

    # All tool nodes -> response_synthesizer
    for tool_name in tool_nodes.values():
        graph.add_edge(tool_name, "response_synthesizer")

    # Synthesizer -> DB Writer -> End
    graph.add_edge("response_synthesizer", "db_writer")
    graph.add_edge("db_writer", END)

    _compiled_graph = graph.compile()
    logger.info("Case agent pipeline compiled with %d tool nodes", len(tool_nodes))
    return _compiled_graph


# ── Entry Point ──
def send_case_message(
    db: Session,
    user_id: int,
    content: str,
    conversation_id: Optional[int] = None,
    case_id: Optional[int] = None,
) -> dict:
    """Main entry point for the case-aware agent."""
    from app.services.chat_service import (
        create_conversation, add_message, get_conversation,
        get_conversation_messages, update_conversation_title,
    )

    is_new = conversation_id is None
    if is_new:
        conversation = create_conversation(db, user_id)
        conversation_id = conversation.id
        if case_id:
            conversation.case_id = case_id
            db.commit()
    else:
        conversation = get_conversation(db, conversation_id, user_id)
        if case_id and not conversation.case_id:
            conversation.case_id = case_id
            db.commit()

    add_message(db, conversation_id, role="user", content=content)

    history = get_conversation_messages(db, conversation_id, user_id, limit=50)
    llm_messages = []
    for msg in history:
        if msg.role in ("user", "assistant"):
            llm_messages.append({"role": msg.role, "content": msg.content})

    compiled = _build_graph()

    initial_state: CaseAgentState = {
        "db": db,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "case_id": case_id,
        "user_message": content,
        "message_history": llm_messages,
        "selected_tool": "",
        "tool_params": {},
        "tool_reason": "",
        "tool_results": {},
        "final_response": "",
        "response_metadata": {},
        "message_id": 0,
    }

    try:
        final_state = compiled.invoke(initial_state)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Case agent pipeline failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Agent pipeline error: {str(e)}")

    if is_new:
        title = content.strip()[:60]
        last_space = title.rfind(" ")
        if last_space > 20:
            title = title[:last_space] + "..."
        update_conversation_title(db, conversation_id, user_id, title)

    return {
        "conversation_id": conversation_id,
        "message_id": final_state["message_id"],
        "response": final_state["final_response"],
        "role": "assistant",
        "metadata": final_state["response_metadata"],
    }
