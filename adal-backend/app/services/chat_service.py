"""
Chat Service for ADAL Backend — LangGraph Agentic Pipeline

Architecture:
  send_message() → 4-node LangGraph StateGraph:
    1. Intent Analyst  (LLM)  — classifies query, generates search terms
    2. Retriever       (Python) — pgvector cosine search on legal_library
    3. Legal Drafter   (LLM)  — writes grounded legal memo
    4. DB Writer       (Python) — persists assistant message

Embedding model : BAAI/bge-m3 (1024-dim) — matches legal_library vectors
LLM             : DeepSeek (OpenAI-compatible SDK)
Vector DB       : pgvector on LOCAL_DATABASE_URL (legal_library table)
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

from app.models.chat_model import Conversation, Message

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DeepSeek client (OpenAI-compatible)
# ---------------------------------------------------------------------------
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("LLM_MODEL_NAME", "deepseek-chat")

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    """Lazy-initialise the DeepSeek client once."""
    global _client
    if _client is None:
        if not DEEPSEEK_API_KEY:
            raise HTTPException(
                status_code=503,
                detail="DEEPSEEK_API_KEY is not set. Chat service unavailable.",
            )
        _client = OpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com",
        )
    return _client


# ---------------------------------------------------------------------------
# Retrieval model (BAAI/bge-m3, 1024-dim)
# ---------------------------------------------------------------------------
from app.services.vector_retrieval_service import search_legal_library


# Vector engine and model now handled by vector_retrieval_service


# ---------------------------------------------------------------------------
# Token counting helper
# ---------------------------------------------------------------------------
_encoder = None

MAX_CONTEXT_TOKENS = 4000  # Reserve ~4K tokens for retrieved context


def _count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken (gpt-4 encoding as approximation for DeepSeek)."""
    global _encoder
    if _encoder is None:
        try:
            _encoder = tiktoken.encoding_for_model("gpt-4")
        except Exception:
            _encoder = tiktoken.get_encoding("cl100k_base")
    return len(_encoder.encode(text))


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------
class AgentState(TypedDict):
    # Inputs
    db: Any  # SQLAlchemy Session (not serialized)
    user_id: int
    conversation_id: int
    user_message: str
    message_history: list  # OpenAI-format dicts

    # Node 1 — Intent Analyst
    search_queries: list  # str items
    skip_retrieval: bool

    # Node 2 — Retriever
    retrieved_context: list  # dict items

    # Node 3 — Legal Drafter
    final_response: str
    response_metadata: dict

    # Node 4 — DB Writer
    message_id: int


# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------
INTENT_ANALYST_PROMPT = """\
You are an intent classification engine for a Pakistani legal assistant called ADAL.

Given the user's latest message and conversation history, do TWO things:
1. Decide if the message is a **casual/greeting** (e.g. "hi", "thanks", "how are you") \
or a **legal query** that needs statutory/case-law retrieval.
2. If it's a legal query, generate 2-4 diverse search queries covering:
   - Exact legal terms used in the message
   - Broader legal concepts and related statutes
   - Alternative phrasings that might match legal text

Respond with ONLY a JSON object — no markdown, no explanation:
{"is_casual": true/false, "queries": ["query1", "query2", ...]}

If casual → {"is_casual": true, "queries": []}

EXAMPLE:
User: "What is the punishment for murder under PPC?"
Response: {"is_casual": false, "queries": [
    "Pakistan Penal Code Section 302 murder punishment",
    "PPC homicide death penalty life imprisonment",
    "murder punishment Pakistani criminal law"
]}
"""

LEGAL_DRAFTER_PROMPT = """\
You are ADAL, an AI legal assistant specialising in Pakistani law.
You assist lawyers, judges, and legal researchers.

{context_block}

INSTRUCTIONS:
- Use ONLY the legal sources provided above to ground your response.
- Cite sources inline using [Source X] format (e.g. [Source 1]).
- If no legal sources are provided, state this clearly and answer from general knowledge.
- Be precise, professional, and concise.

FORMAT YOUR RESPONSE WITH THESE EXACT HEADERS:

### ⚖️ Assessing the Inquiry
[Brief assessment of the legal question]

### 🔍 Analysis & Framework
[Detailed legal analysis with inline citations like [Source 1]]

### 📚 Legal Precedents & Citations
[Relevant laws, statutes, and cases with proper citations]

### 💡 Practitioner Application
[Practical advice for legal practitioners]

EXAMPLE CITATION: "Under Section 302 of the Pakistan Penal Code [Source 1], murder is defined as..."
"""

CASUAL_DRAFTER_PROMPT = """\
You are ADAL, a friendly AI legal assistant for Pakistani law.
The user sent a casual message (greeting, thanks, small talk).
Respond warmly and briefly. Offer to help with any legal questions.
Do NOT use the legal memo format for casual messages.
"""


# ═══════════════════════════════════════════════════════════════════════════
# LangGraph Nodes
# ═══════════════════════════════════════════════════════════════════════════

def intent_analyst_node(state: AgentState) -> dict:
    """
    Node 1 — Intent Analyst (LLM)
    Classifies the query and generates expanded search terms.
    """
    client = _get_client()

    messages = [
        {"role": "system", "content": INTENT_ANALYST_PROMPT},
    ]
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
        if json_match:
            parsed = json.loads(json_match.group())
        else:
            parsed = json.loads(raw)

        is_casual = parsed.get("is_casual", False)
        queries = parsed.get("queries", [])

        if is_casual or not queries:
            return {"skip_retrieval": True, "search_queries": []}

        queries = [str(q) for q in queries if q][:4]
        return {"skip_retrieval": False, "search_queries": queries}

    except Exception as e:
        logger.warning("Intent analyst failed (%s), falling back to direct query", e)
        return {
            "skip_retrieval": False,
            "search_queries": [state["user_message"]],
        }


def retriever_node(state: AgentState) -> dict:
    """
    Node 2 — Retriever (Python, no LLM)
    Uses pgvector search via the centralized vector retrieval service.
    """
    queries = state.get("search_queries", [])
    if not queries:
        return {"retrieved_context": []}

    all_results = []
    seen_content = set()

    for query_text in queries:
        try:
            # Call centralized service
            results = search_legal_library(query_text, k=5, threshold=0.5)
            
            for res in results:
                content = res["content"]
                content_hash = hash(content[:200])
                if content_hash not in seen_content:
                    seen_content.add(content_hash)
                    all_results.append({
                        "id": res["id"],
                        "law_title": res["law_title"],
                        "content": content,
                        "url": res["metadata"].get("url", ""),
                        "similarity": round(res["similarity"], 4),
                    })
        except Exception as e:
            logger.error("Query retrieval failed for %s: %s", query_text, e)

    # Re-sort and take top 10
    all_results.sort(key=lambda x: x["similarity"], reverse=True)
    all_results = all_results[:10]

    logger.info("Retrieved %d legal context chunks", len(all_results))
    return {"retrieved_context": all_results}


def legal_drafter_node(state: AgentState) -> dict:
    """
    Node 3 — Legal Drafter (LLM)
    Writes the final response using retrieved context within a token budget.
    """
    client = _get_client()
    context_chunks = state.get("retrieved_context", [])
    is_casual = state.get("skip_retrieval", False) and not context_chunks

    # Build context block with token budget
    if context_chunks:
        included_count, context_block, used_sources = _build_context_with_budget(context_chunks)
        system_prompt = LEGAL_DRAFTER_PROMPT.format(context_block=context_block)
    elif is_casual:
        system_prompt = CASUAL_DRAFTER_PROMPT
        used_sources = []
    else:
        system_prompt = LEGAL_DRAFTER_PROMPT.format(
            context_block="(No matching statutes were found in the legal library. "
            "Answer from your general knowledge of Pakistani law, "
            "but note the limitation.)"
        )
        used_sources = []

    # Build chat messages — cap history to keep total under context window
    messages = [{"role": "system", "content": system_prompt}]
    history_tokens = 0
    for msg in reversed(state["message_history"]):
        msg_tokens = _count_tokens(msg["content"])
        if history_tokens + msg_tokens > 8000:  # Reserve ~8K for history
            break
        messages.insert(1, {"role": msg["role"], "content": msg["content"]})
        history_tokens += msg_tokens

    try:
        resp = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=2048,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"DeepSeek API error: {str(e)}")

    raw_content = resp.choices[0].message.content

    cleaned = re.sub(r"^```(?:markdown|html)?\s*\n?", "", raw_content.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)

    # Verify which sources were actually cited
    citation_info = _verify_source_usage(cleaned, used_sources)

    # Build status steps
    status_steps = ["Analyzing legal intent"]
    if not is_casual:
        status_steps.append("Retrieving from Legal Library")
    if context_chunks:
        status_steps.append(f"Found {len(context_chunks)} relevant sources")
    status_steps.append("Drafting legal response")
    status_steps.append("Saving response")

    # Build sources_found from retrieved context
    sources_found = []
    seen_titles = set()
    for chunk in context_chunks:
        title = chunk["law_title"]
        if title not in seen_titles:
            seen_titles.add(title)
            sources_found.append({
                "title": title,
                "link": chunk["url"],
                "similarity": chunk["similarity"],
            })

    usage = resp.usage
    response_metadata = {
        "model": DEEPSEEK_MODEL,
        "prompt_tokens": usage.prompt_tokens if usage else None,
        "completion_tokens": usage.completion_tokens if usage else None,
        "total_tokens": usage.total_tokens if usage else None,
        "status_steps": status_steps,
        "sources_found": sources_found,
        "sources_cited": citation_info["cited_sources"],
        "citation_rate": citation_info["citation_rate"],
    }

    return {
        "final_response": cleaned,
        "response_metadata": response_metadata,
    }


def db_writer_node(state: AgentState) -> dict:
    """
    Node 4 — DB Writer (Python, no LLM)
    Persists the assistant message to the database.
    """
    assistant_message = add_message(
        state["db"],
        state["conversation_id"],
        role="assistant",
        content=state["final_response"],
        metadata=state["response_metadata"],
    )
    return {"message_id": assistant_message.id}


# ═══════════════════════════════════════════════════════════════════════════
# Graph assembly
# ═══════════════════════════════════════════════════════════════════════════
_compiled_graph = None


def _build_graph():
    """Build and compile the LangGraph StateGraph (cached)."""
    global _compiled_graph
    if _compiled_graph is not None:
        return _compiled_graph

    graph = StateGraph(AgentState)

    graph.add_node("intent_analyst", intent_analyst_node)
    graph.add_node("retriever", retriever_node)
    graph.add_node("legal_drafter", legal_drafter_node)
    graph.add_node("db_writer", db_writer_node)

    graph.add_edge(START, "intent_analyst")

    graph.add_conditional_edges(
        "intent_analyst",
        lambda state: "legal_drafter" if state.get("skip_retrieval") else "retriever",
        {"legal_drafter": "legal_drafter", "retriever": "retriever"},
    )

    graph.add_edge("retriever", "legal_drafter")
    graph.add_edge("legal_drafter", "db_writer")
    graph.add_edge("db_writer", END)

    _compiled_graph = graph.compile()
    logger.info("LangGraph chat pipeline compiled successfully")
    return _compiled_graph


# ---------------------------------------------------------------------------
# Context building with token budget
# ---------------------------------------------------------------------------

def _build_context_with_budget(context_chunks: list, max_tokens: int = MAX_CONTEXT_TOKENS) -> tuple:
    """Build context block within token budget. Returns (count, block, sources_list)."""
    context_lines = []
    total_tokens = 0
    included = 0
    used_sources = []

    for i, chunk in enumerate(context_chunks, 1):
        chunk_text = (
            f"[Source {i}] {chunk['law_title']}\n"
            f"Content:\n{chunk['content'][:1000]}\n\n"
        )
        chunk_tokens = _count_tokens(chunk_text)

        if total_tokens + chunk_tokens > max_tokens:
            break

        context_lines.append(chunk_text)
        total_tokens += chunk_tokens
        included += 1
        used_sources.append({
            "index": i,
            "title": chunk["law_title"],
            "url": chunk["url"],
            "similarity": chunk["similarity"],
        })

    if included == 0 and context_chunks:
        # At least include the first chunk
        chunk = context_chunks[0]
        context_lines.append(
            f"[Source 1] {chunk['law_title']}\n"
            f"Content:\n{chunk['content'][:800]}\n\n"
        )
        included = 1
        used_sources.append({
            "index": 1,
            "title": chunk["law_title"],
            "url": chunk["url"],
            "similarity": chunk["similarity"],
        })

    header = "You have been provided with the following legal sources. Use them to ground your response:\n\n"
    context_block = header + "".join(context_lines)

    return included, context_block, used_sources


# ---------------------------------------------------------------------------
# Source citation verification
# ---------------------------------------------------------------------------

def _verify_source_usage(response: str, sources: list) -> dict:
    """Check if retrieved sources are actually cited in the response."""
    cited = []
    for source in sources:
        idx = source["index"]
        if f"[Source {idx}]" in response:
            cited.append(idx)

    return {
        "cited_sources": cited,
        "citation_rate": len(cited) / len(sources) if sources else 0,
    }


# ---------------------------------------------------------------------------
# Conversation management
# ---------------------------------------------------------------------------

def create_conversation(
    db: Session,
    user_id: int,
    title: Optional[str] = None,
    model_used: Optional[str] = None,
) -> Conversation:
    """Create a new conversation for a user."""
    conversation = Conversation(
        user_id=user_id,
        title=title or "New Conversation",
        model_used=model_used or DEEPSEEK_MODEL,
        total_messages=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_conversation(db: Session, conversation_id: int, user_id: int) -> Conversation:
    """Fetch a single conversation, enforcing ownership."""
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


def get_user_conversations(
    db: Session,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    case_id: Optional[int] = None,
) -> list[Conversation]:
    """Return all conversations for a user, optionally filtered by case, newest first."""
    query = db.query(Conversation).filter(Conversation.user_id == user_id)
    if case_id is not None:
        query = query.filter(Conversation.case_id == case_id)
    return query.order_by(Conversation.updated_at.desc()).limit(limit).offset(offset).all()


def update_conversation_title(
    db: Session,
    conversation_id: int,
    user_id: int,
    title: str,
) -> Conversation:
    """Rename a conversation."""
    conversation = get_conversation(db, conversation_id, user_id)
    conversation.title = title
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conversation)
    return conversation


def delete_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
    """Delete a conversation and all its messages."""
    conversation = get_conversation(db, conversation_id, user_id)
    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(conversation)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# Message management
# ---------------------------------------------------------------------------

def add_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: str,
    metadata: Optional[dict] = None,
) -> Message:
    """Persist one message and update the parent conversation's counters."""
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        msg_metadata=json.dumps(metadata) if metadata else None,
        created_at=datetime.utcnow(),
    )
    db.add(message)

    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        conversation.total_messages = (conversation.total_messages or 0) + 1
        conversation.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(message)
    return message


def get_conversation_messages(
    db: Session,
    conversation_id: int,
    user_id: int,
    limit: int = 50,
) -> list[Message]:
    """Return messages for a conversation in chronological order."""
    get_conversation(db, conversation_id, user_id)

    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# Core chat — LangGraph entry point
# ---------------------------------------------------------------------------

def send_message(
    db: Session,
    user_id: int,
    content: str,
    conversation_id: Optional[int] = None,
) -> dict:
    """Main entry point called by the chat router."""
    is_new_conversation = conversation_id is None
    if is_new_conversation:
        conversation = create_conversation(db, user_id)
        conversation_id = conversation.id
    else:
        conversation = get_conversation(db, conversation_id, user_id)

    add_message(db, conversation_id, role="user", content=content)

    history = get_conversation_messages(db, conversation_id, user_id, limit=50)
    llm_messages = _build_message_history(history)

    compiled = _build_graph()

    initial_state: AgentState = {
        "db": db,
        "user_id": user_id,
        "conversation_id": conversation_id,
        "user_message": content,
        "message_history": llm_messages,
        "search_queries": [],
        "skip_retrieval": False,
        "retrieved_context": [],
        "final_response": "",
        "response_metadata": {},
        "message_id": 0,
    }

    try:
        final_state = compiled.invoke(initial_state)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("LangGraph pipeline failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Chat pipeline error: {str(e)}",
        )

    if is_new_conversation:
        title = _generate_title(content)
        update_conversation_title(db, conversation_id, user_id, title)

    return {
        "conversation_id": conversation_id,
        "message_id": final_state["message_id"],
        "response": final_state["final_response"],
        "role": "assistant",
        "metadata": final_state["response_metadata"],
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_message_history(messages: list[Message]) -> list[dict]:
    """Convert ORM Message objects into the OpenAI-compatible message list."""
    result = []
    for msg in messages:
        if msg.role in ("user", "assistant"):
            result.append({"role": msg.role, "content": msg.content})
    return result


def _generate_title(first_message: str, max_length: int = 60) -> str:
    """Derive a conversation title from the user's first message."""
    text = first_message.strip()
    if len(text) <= max_length:
        return text
    truncated = text[:max_length]
    last_space = truncated.rfind(" ")
    if last_space > 20:
        truncated = truncated[:last_space]
    return truncated + "..."
