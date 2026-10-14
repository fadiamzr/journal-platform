# Journal Platform

An open-source academic publishing platform designed as a modern replacement for Open Journal Systems (OJS). It supports double-blind peer review, trilingual content (English, French, Arabic with RTL), role-based access control (Author, Reviewer, Editor, Admin), and a swappable LLM integration for editorial assistance. The backend is built with Python 3.12 + FastAPI on Supabase (Postgres + Auth + Storage); the frontend uses Next.js 15 App Router with Tailwind CSS and Shadcn/ui.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, Shadcn/ui, TypeScript |
| Backend | Python 3.12, FastAPI, Pydantic v2, Uvicorn |
| Database & Auth | Supabase (Postgres, Row-Level Security, JWT via JWKS) |
| Storage | Supabase Storage (PDF-only, 50 MB limit) |
| LLM | Swappable via `LLM_PROVIDER` env var (gemini \| ollama \| anthropic) |
| Infrastructure | Docker Desktop, pnpm workspaces, supabase CLI |
| Languages | English, French, Arabic (RTL) |

---

## Repository Layout

```
journal-platform/
├── apps/
│   ├── api/                  # Python FastAPI backend (Phase 2)
│   │   └── .env.example
│   └── web/                  # Next.js frontend (Phase 3)
│       └── .env.example
├── supabase/                 # Supabase migrations & config (Phase 4)
│   └── config.toml
├── docs/
│   └── ARCHITECTURE.md
├── scripts/
│   ├── requirements.txt
│   └── smoke_test.py
├── .editorconfig
├── .gitattributes
├── .gitignore
└── README.md
```

---

## Local Setup

> **Prerequisites:** Node 24, pnpm, Python 3.12, Docker Desktop, supabase CLI

### Step 0 — Clone & install root tooling
```bash
git clone <repo-url> journal-platform
cd journal-platform
```

### Step 1 — Supabase local dev *(Phase 4)*
```bash
supabase login          # interactive — run manually
supabase link           # interactive — run manually
supabase start
```

### Step 2 — API environment *(Phase 2)*
```bash
cp apps/api/.env.example apps/api/.env
# Fill in real values in apps/api/.env
```

### Step 3 — Web environment *(Phase 3)*
```bash
cp apps/web/.env.example apps/web/.env.local
# Fill in real values in apps/web/.env.local
```

### Step 4 — Install dependencies *(Phase 2 / 3)*
```bash
# Python backend
cd apps/api && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt

# Frontend
cd apps/web && pnpm install
```

### Step 5 — Run smoke tests *(after env files are populated)*
```bash
cd scripts
pip install -r requirements.txt
python smoke_test.py
```

### Step 6 — Start services *(Phase 2 / 3)*
```bash
# API (Docker)
docker compose up --build

# Web (dev server)
cd apps/web && pnpm dev
```

---

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Repo structure, config, docs, scripts | ✅ Complete |
| 2 | FastAPI backend, RLS policies, migrations | 🔜 Planned |
| 3 | Next.js frontend, i18n, UI components | 🔜 Planned |
| 4 | CI/CD, Docker Compose, deployment | 🔜 Planned |
