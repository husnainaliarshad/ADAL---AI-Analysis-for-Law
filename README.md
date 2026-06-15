# ADAL

ADAL is an AI-assisted legal workspace built as a monorepo with a React frontend and a FastAPI backend. The product currently covers dashboard workflows, chat, legal drafting, citation extraction, verification, summaries, and document management.

## Repository Layout

```text
.
+-- adal-frontend/
|   +-- frontend/              # React + Vite application
|   \-- reference files/       # HTML reference screens used during UI work
+-- adal-backend/
|   +-- app/                   # FastAPI app, routes, services, models
|   +-- test/                  # Backend tests and smoke checks
|   \-- requirements.txt       # Python dependencies
+-- assets/                    # Shared assets
+-- Docs for helping agents/   # Internal project notes
+-- Templates/                 # Template/reference material
+-- frontend.bat               # Windows launcher for the frontend
\-- backend.bat                # Windows launcher for the backend
```

## Tech Stack

- Frontend: React 19, Vite, React Router, MUI, Tailwind, TipTap, Vitest
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Redis, pytest
- AI/document pipeline: OCR, embeddings, drafting/chat integrations, citation and verification services

## Prerequisites

- Node.js 20+ recommended
- Python 3.12 recommended
- PostgreSQL for backend persistence
- Redis for cache/session features

## Quick Start

### 1. Start the backend

```powershell
cd adal-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 9006
```

Backend configuration lives in `adal-backend/.env.example`. Review these values before running:

- `DATABASE_URL`
- `LOCAL_DATABASE_URL`
- `SECRET_KEY`
- `ADMIN_API_KEY`
- `CORS_ORIGINS`

Notes:

- `AUTH_REQUIRED=false` keeps normal API routes open for development.
- `ADMIN_AUTH_REQUIRED=true` means admin routes still require `X-Admin-Key`.
- The backend default local port is `9006`.

### 2. Start the frontend

```powershell
cd adal-frontend\frontend
npm install
Copy-Item env.example .env
npm run dev
```

Frontend configuration lives in `adal-frontend/frontend/env.example`.

Important variables:

- `VITE_API_URL=http://localhost:9006/api`
- `VITE_ENABLE_DEV_ROUTES`
- `VITE_ENABLE_NOTIFICATIONS_API`
- `VITE_DEBUG`

The frontend expects the backend API base to include `/api`.

## Windows Launchers

If you want the simplest local startup path on Windows:

```powershell
.\backend.bat
.\frontend.bat
```

These wrappers launch:

- backend: `uvicorn app.main:app --reload --port 9006`
- frontend: `npm run dev`

## Testing

### Frontend

```powershell
cd adal-frontend\frontend
npm run build
npm run test:run
```

### Backend

```powershell
cd adal-backend
pytest test/test_simple.py test/test_health_readiness_status_code.py -q
python -m compileall app
```

There are more backend tests under `adal-backend/test`, but some depend on local infrastructure or specific data setup.

## CI

GitHub Actions workflows live under `.github/workflows`:

- `frontend-ci.yml`
- `backend-ci.yml`

The current backend CI runs a lightweight sanity check rather than the entire backend test matrix.

## Key Areas

- Dashboard: frontend now reads backend overview data instead of stitching multiple calls locally
- Drafting assistant: three-panel drafting workspace with AI proposal flow
- Chat: assistant/chat workspace with theme-safe light and dark modes
- Files and citations: upload, extraction, verification, and evidence-related flows

## Useful Paths

- Frontend app: `adal-frontend/frontend`
- Backend app: `adal-backend/app`
- Backend tests: `adal-backend/test`
- Frontend reference designs: `adal-frontend/reference files`

## Notes

- This repo contains research, templates, and supporting datasets alongside the app code.
- Some backend features rely on optional services or models that are not required for the basic UI/dev loop.
- The repo includes Windows-oriented helper scripts, but the app itself is not Windows-only.
