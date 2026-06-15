path = 'app/services/case_agent_service.py'
with open(path, 'r', encoding='utf-8') as f:
    t = f.read()

# Fix 1: Include document IDs in case context
old = 'for d in docs[:5])'
new = 'for d in docs[:10])'
t = t.replace(old, new)

old = 'if len(docs) > 5:'
new = 'if len(docs) > 10:'
t = t.replace(old, new)

old = 'f"  - {d.filename}"'
new = 'f"  - [{d.id}] {d.filename}"'
t = t.replace(old, new)

old = '{len(docs) - 5}'
new = '{len(docs) - 10}'
t = t.replace(old, new)

# Fix 2: Add _resolve_document_id helper before extract_citations_node
old_func = 'def extract_citations_node('
new_func = '''def _resolve_document_id(state, doc_id):
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

def extract_citations_node('''
t = t.replace(old_func, new_func)

# Fix 3: Update extract_citations_node to use resolver
old = '''params = state.get("tool_params", {})
    doc_id = params.get("document_id")

    if not doc_id:
        return {"tool_results": {"tool": "extract_citations", "error": "No document_id provided", "citations": []}}

    try:
        from app.services.citation_service import extract_citations_from_document
        citations = extract_citations_from_document(state["db"], int(doc_id))'''

new = '''params = state.get("tool_params", {})
    raw_doc_id = params.get("document_id")
    doc_id = _resolve_document_id(state, raw_doc_id)

    if not doc_id:
        return {"tool_results": {"tool": "extract_citations", "error": "No document found. Upload a file to the case first.", "citations": []}}

    try:
        from app.services.citation_service import extract_citations_from_document
        citations = extract_citations_from_document(state["db"], doc_id)'''
t = t.replace(old, new)

# Fix 4: Update segment_claims_node similarly
old = '''params = state.get("tool_params", {})
    doc_id = params.get("document_id")

    if not doc_id:
        return {"tool_results": {"tool": "segment_claims", "error": "No document_id provided", "claims": []}}

    try:
        from app.services.claim_service import segment_claims_with_citations
        claims = segment_claims_with_citations(state["db"], int(doc_id))'''

new = '''params = state.get("tool_params", {})
    raw_doc_id = params.get("document_id")
    doc_id = _resolve_document_id(state, raw_doc_id)

    if not doc_id:
        return {"tool_results": {"tool": "segment_claims", "error": "No document found. Upload a file to the case first.", "claims": []}}

    try:
        from app.services.claim_service import segment_claims_with_citations
        claims = segment_claims_with_citations(state["db"], doc_id)'''
t = t.replace(old, new)

# Fix 5: Update router prompt to mention document IDs
old = 'RULES:\n- Select the BEST tool'
new = 'RULES:\n- The case context lists documents with IDs in [brackets]. Use those IDs.\n- If the user says "my document" or "the uploaded file", use the most recent document ID from the case context.\n- Select the BEST tool'
t = t.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(t)
print('ok')
