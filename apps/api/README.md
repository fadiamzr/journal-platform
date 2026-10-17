# apps/api

The **Python 3.12 + FastAPI** backend service for the academic publishing platform.

---

## Getting Started (Windows PowerShell)

Run these commands from the `apps/api` directory:

```powershell
# 1. Navigate to apps/api
cd apps/api

# 2. Create Python 3.12 virtual environment (if not already created)
py -3.12 -m venv .venv

# 3. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Install dependencies including development tools
pip install -r requirements-dev.txt

# 5. Run linter and formatting checks
ruff check .

# 6. Run test suite
pytest -q

# 7. Start local development server with auto-reload
uvicorn app.main:app --reload --port 8000
```

---

## Configuration

Settings are loaded automatically from `apps/api/.env` (resolved relative to the config module). Copy `.env.example` to `.env` and fill in your Supabase project keys before running the application.

---

## Implemented Phases

| Phase | Scope | Status |
|---|---|---|
| **Phase 4** | FastAPI core — app scaffold, JWKS JWT middleware, role guards, Docker | Complete |
| **Phase 5** | AI extraction — LLM provider abstraction (`LLM_PROVIDER`), metadata extraction | Planned |
| **Phase 6** | Workflow & review API — submission lifecycle, reviewer assignment, decision endpoints | Planned |
