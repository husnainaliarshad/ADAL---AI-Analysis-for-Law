import json
import os
import re
from typing import Dict, List, TypedDict

import psycopg2
from langgraph.graph import END, START, StateGraph
from openai import OpenAI
from pgvector.psycopg2 import register_vector
from sentence_transformers import SentenceTransformer

_embedder = None


def get_embedder():
    """Lazy-load the embedder so backend startup does not preload the model."""
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


class DraftingState(TypedDict):
    message: str
    document_context: str
    intent_analysis: str
    delivery_mode: str
    routing_reason: str
    retrieved_clauses: List[Dict[str, str]]
    drafted_content: str
    assistant_reply: str
    metadata: List[Dict[str, str]]
    user_id: int


class DraftingAgent:
    def __init__(self):
        self.db_url = os.getenv(
            "LOCAL_DATABASE_URL",
            "postgresql://admin:password@127.0.0.1:5433/adalbot",
        )
        self.api_key = os.getenv("DEEPSEEK_API_KEY")
        self.model_name = os.getenv("LLM_MODEL_NAME", "deepseek-chat")

        if not self.api_key:
            print("[WARNING] DEEPSEEK_API_KEY not found in environment, agent may fail.")

        self.llm_client = OpenAI(
            api_key=self.api_key or "dummy_key",
            base_url="https://api.deepseek.com",
        )

        self.graph_builder = StateGraph(DraftingState)
        self.graph_builder.add_node("analyst", self.analyst_node)
        self.graph_builder.add_node("router", self.router_node)
        self.graph_builder.add_node("retriever", self.retriever_node)
        self.graph_builder.add_node("drafter", self.drafter_node)
        self.graph_builder.add_node("chat_responder", self.chat_responder_node)

        self.graph_builder.add_edge(START, "analyst")
        self.graph_builder.add_edge("analyst", "router")
        self.graph_builder.add_edge("router", "retriever")
        self.graph_builder.add_conditional_edges(
            "retriever",
            self.route_after_retrieval,
            {
                "editor": "drafter",
                "chat": "chat_responder",
            },
        )
        self.graph_builder.add_edge("drafter", END)
        self.graph_builder.add_edge("chat_responder", END)

        self.app = self.graph_builder.compile()

    def fallback_delivery_mode(self, message: str) -> str:
        prompt = (message or "").lower()
        editor_keywords = [
            "draft",
            "rewrite",
            "redraft",
            "revise",
            "insert",
            "replace",
            "continue",
            "add clause",
            "add a clause",
            "write this section",
            "improve this paragraph",
            "update this section",
        ]
        chat_keywords = [
            "explain",
            "summarize",
            "summary",
            "analyze",
            "analyse",
            "review",
            "feedback",
            "assess",
            "evaluate",
            "critique",
            "comment on",
            "should we",
            "is this",
            "does this",
            "what does this mean",
            "is this strong",
            "which argument",
            "which authority",
            "review this",
        ]

        if any(keyword in prompt for keyword in editor_keywords):
            return "editor"
        if any(keyword in prompt for keyword in chat_keywords):
            return "chat"
        return "editor"

    def process_document(self, title: str, content_html: str, content_text: str, draft_id: str, db, user_id: int):
        from datetime import datetime

        from fastapi import HTTPException

        from app.models.draft_model import DocumentVersion, Draft

        draft = None
        if draft_id:
            try:
                draft_id_int = int(draft_id)
                draft = db.query(Draft).filter(Draft.id == draft_id_int).first()
                if draft and draft.user_id != user_id:
                    raise HTTPException(status_code=403, detail="Not authorized to edit this draft")
            except ValueError:
                pass

        if not draft:
            draft = Draft(
                title=title,
                user_id=user_id,
            )
            db.add(draft)
            db.flush()
            version_num = 1
        else:
            draft.title = title
            last_version = (
                db.query(DocumentVersion)
                .filter(DocumentVersion.draft_id == draft.id)
                .order_by(DocumentVersion.version_number.desc())
                .first()
            )
            version_num = (last_version.version_number + 1) if last_version else 1
            draft.updated_at = datetime.utcnow()

        new_version = DocumentVersion(
            draft_id=draft.id,
            version_number=version_num,
            content_html=content_html,
        )
        db.add(new_version)

        db.commit()
        db.refresh(draft)
        db.refresh(new_version)
        return {
            "status": "success",
            "draft_id": str(draft.id),
            "message": "Document saved successfully",
        }

    def analyst_node(self, state: DraftingState):
        system_prompt = (
            "You are a legal intent analyst. "
            "Analyze the user's message and the document context to determine exactly "
            "what kind of legal clause or drafting is being requested. "
            "Extract keywords for searching a vector database of legal templates. "
            "Output your analysis briefly."
        )

        user_prompt = f"Message: {state['message']}\nContext: {state['document_context']}"

        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
            analysis = response.choices[0].message.content
        except Exception as exc:
            print(f"Error in Analyst Node: {exc}")
            analysis = state["message"]

        return {"intent_analysis": analysis}

    def router_node(self, state: DraftingState):
        system_prompt = (
            "You are the routing controller for ADAL Draft Copilot. "
            "Choose whether the assistant should respond in chat mode or editor mode. "
            "Return 'editor' only when the user clearly wants new document text, a rewrite, a replacement, an insertion, or a direct text change inside the document. "
            "Return 'chat' when the user wants explanation, summary, analysis, strategy, feedback, review, argument assessment, comparison, or clarification. "
            "If the request can reasonably be answered without changing the document, prefer 'chat'. "
            "If the request is interpretive rather than action-oriented, prefer 'chat'. "
            "Respond with JSON only in this shape: "
            '{"delivery_mode":"chat|editor","reason":"short explanation"}'
        )

        user_prompt = (
            f"User message: {state['message']}\n\n"
            f"Intent analysis: {state.get('intent_analysis', '')}\n\n"
            f"Document context preview: {(state.get('document_context') or '')[:2000]}"
        )

        fallback_mode = self.fallback_delivery_mode(state["message"])
        raw_content = ""

        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0,
            )
            raw_content = (response.choices[0].message.content or "").strip()
            match = re.search(r"\{.*\}", raw_content, re.DOTALL)
            parsed = json.loads(match.group(0) if match else raw_content)
            delivery_mode = parsed.get("delivery_mode", fallback_mode)
            if delivery_mode not in {"chat", "editor"}:
                delivery_mode = fallback_mode
            routing_reason = parsed.get("reason") or "Structured routing decision unavailable."
        except Exception as exc:
            print(f"Error in Router Node: {exc}")
            delivery_mode = fallback_mode
            routing_reason = f"Fallback routing applied ({delivery_mode})."

        return {
            "delivery_mode": delivery_mode,
            "routing_reason": routing_reason,
        }

    def route_after_retrieval(self, state: DraftingState):
        return state.get("delivery_mode", "editor")

    def retriever_node(self, state: DraftingState):
        query_text = state.get("intent_analysis", state["message"])
        query_vector = get_embedder().encode(query_text).tolist()

        try:
            conn = psycopg2.connect(self.db_url, connect_timeout=5)
            cur = conn.cursor()
            register_vector(conn)

            cur.execute(
                """
                SELECT law_title, content, metadata->>'url' as url
                FROM legal_library
                ORDER BY embedding <=> %s::vector
                LIMIT 2
                """,
                (query_vector,),
            )

            results = cur.fetchall()
            retrieved = []
            metadata_list = []

            for title, content, url in results:
                retrieved.append({"title": title, "content": content})
                metadata_list.append({"title": title, "link": url or "#"})

            cur.close()
            conn.close()
        except Exception as exc:
            print(f"Postgres generic retriever error: {exc}")
            retrieved = []
            metadata_list = []

        return {"retrieved_clauses": retrieved, "metadata": metadata_list}

    def drafter_node(self, state: DraftingState):
        retrieved_text = "\n\n".join(
            [f"Template: {item['title']}\n{item['content']}" for item in state.get("retrieved_clauses", [])]
        )

        system_prompt = (
            "You are ADAL Draft Copilot in editor mode. "
            "Your job is to prepare document-ready legal text for insertion into the editor as a proposal. "
            "Use this mode only for drafting, rewriting, replacing, inserting, or continuing document text. "
            "IMPORTANT: Your output MUST be valid clean HTML using standard tags like <p>, <strong>, <ul>, <ol>, <li>, and headings when needed. "
            "Do NOT use markdown code blocks. Output raw HTML only. "
            "Do NOT include commentary, explanations, prefaces, or notes outside the drafted legal text. "
            "Do NOT say what you changed. "
            "Draft text that fits naturally into the provided Document Context."
        )

        user_prompt = (
            f"User Message: {state['message']}\n\n"
            f"Document Context: {state['document_context']}\n\n"
            f"Retrieved Legal Templates:\n{retrieved_text}\n\n"
            "Now draft the new legal text in HTML format:"
        )

        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )
            html_content = response.choices[0].message.content.strip()
            if html_content.startswith("```html"):
                html_content = html_content[7:]
            if html_content.startswith("```"):
                html_content = html_content[3:]
            if html_content.endswith("```"):
                html_content = html_content[:-3]
            html_content = html_content.strip()
        except Exception as exc:
            print(f"Error in Drafter Node: {exc}")
            html_content = "<p>Internal Error drafting content.</p>"

        return {
            "drafted_content": html_content,
            "assistant_reply": (
                "I prepared a drafting proposal for the editor. "
                "Review it before applying any changes."
                if html_content and "Internal Error" not in html_content
                else "I couldn't prepare a usable drafting proposal for the editor."
            ),
        }

    def chat_responder_node(self, state: DraftingState):
        retrieved_text = "\n\n".join(
            [f"Source: {item['title']}\n{item['content']}" for item in state.get("retrieved_clauses", [])]
        )

        system_prompt = (
            "You are ADAL Draft Copilot in chat mode. "
            "Your job is to answer inside the chat sidebar without modifying the user's document. "
            "This mode is for explanation, summary, legal analysis, strategy, review, comparison, and feedback. "
            "Do NOT draft insertion-ready text. "
            "Do NOT write HTML. "
            "Do NOT produce a clause, paragraph, or replacement block unless the user explicitly asks to switch into editor-style drafting. "
            "Do NOT pretend you edited the document. "
            "Do NOT say content was inserted, updated, drafted for insertion, or prepared as a proposal. "
            "Respond as a normal chat answer grounded in the current document context and retrieved materials. "
            "If useful, explain what should change in the document, but keep the answer advisory and in chat form."
        )

        user_prompt = (
            f"User Message: {state['message']}\n\n"
            f"Document Context: {state['document_context']}\n\n"
            f"Intent Analysis: {state.get('intent_analysis', '')}\n\n"
            f"Retrieved Materials:\n{retrieved_text}\n\n"
            "Answer in chat:"
        )

        try:
            response = self.llm_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
            )
            assistant_reply = (response.choices[0].message.content or "").strip()
        except Exception as exc:
            print(f"Error in Chat Responder Node: {exc}")
            assistant_reply = "I couldn't prepare a chat response for that request."

        return {"assistant_reply": assistant_reply}
