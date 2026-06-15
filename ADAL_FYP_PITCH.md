# ADAL FYP Brief

## Project Name
**ADAL** - **AI-Driven Analysis for Law**

## One-Line Summary
ADAL is a full-stack legal-tech platform focused on Pakistani law that helps users upload legal documents, extract text from scanned files, identify citations and claims, verify claims through retrieval-augmented AI workflows, chat over legal material, and draft legal documents more efficiently.

## Problem We Are Solving
Legal work is still slowed down by scanned PDFs, manual citation checking, fragmented legal research, and repetitive drafting/review. ADAL was built to reduce that friction by bringing document processing, legal analysis, verification, and drafting into one system.

## What ADAL Does
- Uploads legal documents such as PDFs, images, and text files.
- Extracts text from scanned documents using OCR.
- Detects Pakistani legal citations such as PLD, SCMR, PPC, constitutional articles, and statutory references.
- Segments legal claims from document text using **InLegalBERT**.
- Maps claims with citations for more structured legal analysis.
- Generates embeddings and indexes legal content for semantic retrieval.
- Retrieves supporting evidence and uses an LLM to verify whether a claim is supported, contradicted, or uncertain.
- Produces confidence-oriented verification outputs and reports.
- Provides an AI legal chat assistant for legal queries and research support.
- Includes a drafting assistant for legal document creation and refinement.
- Supports summaries, document management, authentication, and dashboard-style monitoring.

## Core Workflow
1. A user uploads a legal document.
2. The system extracts text using OCR if the file is scanned.
3. ADAL extracts legal citations from the document.
4. It segments the document into claims using a legal-domain transformer model.
5. Claims are embedded and indexed for retrieval.
6. Relevant evidence is retrieved from indexed legal material.
7. An LLM evaluates the claim against the retrieved evidence.
8. The platform returns a verdict, confidence score, reasoning, and supporting references.

## Technical Stack
### Frontend
- React + Vite
- Material UI
- Framer Motion

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- Optional Supabase and Redis integration

### AI / ML / NLP
- **Tesseract OCR** + `pdf2image` for text extraction
- **InLegalBERT** for legal claim segmentation
- **BGE embeddings** for semantic vector generation
- **FAISS** for retrieval
- **DeepSeek** with **LangGraph** for the legal chat assistant
- **Ollama** for local claim verification reasoning

### Testing / Engineering
- Pytest for backend testing
- Vitest for frontend testing

## Why This Project Is Strong for a CV
- It is not just a chatbot; it is a full legal analysis workflow.
- It combines classical backend engineering with NLP, retrieval, and LLM orchestration.
- It solves a domain-specific problem for Pakistani legal practice instead of being a generic AI demo.
- It includes production-style concerns like authentication, persistence, APIs, validation, document handling, and testing.

## Short Pitch Version
ADAL is our final year project: an AI-driven legal analysis platform for Pakistani law. It processes legal documents end-to-end by extracting OCR text, detecting citations, segmenting claims with InLegalBERT, retrieving supporting evidence through vector search, and using LLMs for verification, summaries, chat-based legal assistance, and drafting support. The system was built as a full-stack application with a React frontend, FastAPI backend, PostgreSQL, FAISS-based retrieval, and multiple AI components integrated into one legal workflow.

## CV-Friendly Description
Built **ADAL (AI-Driven Analysis for Law)**, a full-stack legal-tech FYP for Pakistani law that automates document OCR, citation extraction, claim segmentation, semantic retrieval, AI-based verification, legal chat, summarization, and drafting assistance using React, FastAPI, PostgreSQL, FAISS, InLegalBERT, and LLM-based workflows.

## Resume Bullet Ideas
- Built a full-stack legal AI platform for Pakistani law using React, FastAPI, and PostgreSQL.
- Implemented OCR-based document ingestion and text extraction for scanned legal documents.
- Developed citation extraction workflows for Pakistani case law and statutory references.
- Integrated **InLegalBERT** for legal claim segmentation and structured claim analysis.
- Built a retrieval-augmented verification pipeline using **BGE embeddings**, **FAISS**, and LLM reasoning.
- Implemented AI-assisted legal chat and document drafting workflows using DeepSeek, LangGraph, and local LLM inference.
- Designed backend APIs, database models, and document-processing pipelines for end-to-end legal document analysis.

## If You Want To Paste This Into Another Chat
Use this prompt:

```text
I want to update my CV based on my FYP. Here is the project summary:

ADAL (AI-Driven Analysis for Law) is our final year project, a full-stack legal-tech platform for Pakistani law. It lets users upload legal documents, extract OCR text from scanned files, detect legal citations, segment claims using InLegalBERT, retrieve supporting evidence through FAISS-based semantic search, and verify claims using LLMs. It also includes legal summarization, AI chat, and drafting assistance. The stack includes React, FastAPI, PostgreSQL, OCR tooling, vector retrieval, and LLM orchestration.

Please turn this into:
1. a strong CV project entry,
2. 3-5 resume bullets,
3. a LinkedIn-ready project description,
4. a short interview explanation.
```

## Note
This brief is based on the current repository structure and implementation of the project.
