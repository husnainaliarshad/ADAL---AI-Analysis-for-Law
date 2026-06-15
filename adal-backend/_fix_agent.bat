@echo off
cd /d C:\Users\husna\Documents\Adal-FYP\adal-backend
set "VENV_PYTHON=.\venv\Scripts\python.exe"

%VENV_PYTHON% -c "
path='app/services/case_agent_service.py'; f=open(path,'r',encoding='utf-8'); t=f.read(); f.close()

# Fix 1: Include document IDs in case context
old_ctx = '''    doc_list = \"\\n\".join(f\"  - {d.filename}\" for d in docs[:5])
    if len(docs) > 5:
        doc_list += f\"\\n  - ... and {len(docs) - 5} more\"'''

new_ctx = '''    doc_list = \"\\n\".join(f\"  - [{d.id}] {d.filename}\" for d in docs[:10])
    if len(docs) > 10:
        doc_list += f\"\\n  - ... and {len(docs) - 10} more\"""'
t = t.replace(old_ctx, new_ctx)

# Fix 2: Update extract_citations tool to accept document_id=auto
old_ext = '''def extract_citations_node(state: CaseAgentState) -> dict:
    \"\"\"Tool: Extract citations from a case document.\"\"\"
    params = state.get(\"tool_params\", {})
    doc_id = params.get(\"document_id\")

    if not doc_id:
        return {\"tool_results\": {\"tool\": \"extract_citations\", \"error\": \"No document_id provided\", \"citations\": []}}

    try:
        from app.services.citation_service import extract_citations_from_document
        citations = extract_citations_from_document(state[\"db\"], int(doc_id))'''

new_ext = '''def _resolve_document_id(state, doc_id):
    if doc_id:
        try:
            return int(str(doc_id))
        except (ValueError, TypeError):
            pass
    # Auto-resolve from case
    case_id = state.get(\"case_id\")
    if case_id:
        from app.models.document_model import Document
        doc = state[\"db\"].query(Document).filter(Document.case_id == case_id).order_by(Document.id.desc()).first()
        if doc:
            return doc.id
    return None

def extract_citations_node(state: CaseAgentState) -> dict:
    \"\"\"Tool: Extract citations from a case document.\"\"\"
    params = state.get(\"tool_params\", {})
    doc_id = _resolve_document_id(state, params.get(\"document_id\"))

    if not doc_id:
        return {\"tool_results\": {\"tool\": \"extract_citations\", \"error\": \"No document found. Upload a file to the case first.\", \"citations\": []}}

    try:
        from app.services.citation_service import extract_citations_from_document
        citations = extract_citations_from_document(state[\"db\"], doc_id)'''

t = t.replace(old_ext, new_ext)

# Fix 3: Update segment_claims similarly
old_seg = '''def segment_claims_node(state: CaseAgentState) -> dict:
    \"\"\"Tool: Segment a document into factual claims.\"\"\"
    params = state.get(\"tool_params\", {})
    doc_id = params.get(\"document_id\")

    if not doc_id:
        return {\"tool_results\": {\"tool\": \"segment_claims\", \"error\": \"No document_id provided\", \"claims\": []}}

    try:
        from app.services.claim_service import segment_claims_with_citations
        claims = segment_claims_with_citations(state[\"db\"], int(doc_id))'''

new_seg = '''def segment_claims_node(state: CaseAgentState) -> dict:
    \"\"\"Tool: Segment a document into factual claims.\"\"\"
    params = state.get(\"tool_params\", {})
    doc_id = _resolve_document_id(state, params.get(\"document_id\"))

    if not doc_id:
        return {\"tool_results\": {\"tool\": \"segment_claims\", \"error\": \"No document found. Upload a file to the case first.\", \"claims\": []}}

    try:
        from app.services.claim_service import segment_claims_with_citations
        claims = segment_claims_with_citations(state[\"db\"], doc_id)'''
t = t.replace(old_seg, new_seg)

# Fix 4: Update tool descriptions to mention auto-resolution
old_tool = '\"params\": {\"document_id\": \"ID of the document to scan\"}'
new_tool = '\"params\": {\"document_id\": \"ID of the document to scan (auto-detected from case if not provided)\"}'
t = t.replace(old_tool, new_tool)

old_tool2 = '\"params\": {\"document_id\": \"ID of the document to segment\"}'
new_tool2 = '\"params\": {\"document_id\": \"ID of the document to segment (auto-detected from case if not provided)\"}'
t = t.replace(old_tool2, new_tool2)

# Fix 5: Update router prompt to mention document IDs
old_router = 'RULES:\n- Select the BEST tool for the user\\'s request.'
new_router = 'RULES:\n- The case context below lists documents with their IDs in [brackets]. Use these IDs.\n- If the user says \"my document\" or \"the file\", use the most recent document ID.\n- Select the BEST tool for the user\\'s request.'
t = t.replace(old_router, new_router)

f=open(path,'w',encoding='utf-8'); f.write(t); f.close(); print('ok')
" > _fix_out.txt 2>&1
type _fix_out.txt
