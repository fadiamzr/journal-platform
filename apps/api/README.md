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

## Phase 5: AI Metadata Extraction

The extraction engine sends PDFs directly to a configurable LLM provider and writes structured metadata back to the database.

**Key settings** (add to `.env`):

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` \| `ollama` \| `anthropic` |
| `GEMINI_API_KEY` | — | Required when `LLM_PROVIDER=gemini` |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model name |
| `LLM_TIMEOUT_SECONDS` | `120` | Per-request timeout |
| `LLM_MAX_RETRIES` | `3` | Retry attempts on 429/5xx/timeout |
| `LLM_MAX_RPM` | `10` | Max requests per minute (free tier safe) |
| `EXTRACTION_MAX_PDF_MB` | `18` | Max inline PDF size |

**⚠️ Privacy:** Free-tier Gemini may use inputs to train Google products. Use only non-confidential test papers on the free tier. Switch to a paid Gemini tier or `LLM_PROVIDER=ollama` for real manuscripts.

See [docs/EXTRACTION.md](../../docs/EXTRACTION.md) for the full architecture, error modes, and how to run the end-to-end check script.

---

## Implemented Phases

| Phase | Scope | Status |
|---|---|---|
| **Phase 4** | FastAPI core — app scaffold, JWKS JWT middleware, role guards, Docker | Complete |
| **Phase 5** | AI extraction — LLM provider abstraction (`LLM_PROVIDER`), metadata extraction | Complete |
| **Stage 1A** | Submissions, file uploads, blind-copy flow, verification, signed URLs | Complete |
| **Stage 1B** | Reviewer assignments, reviewer dashboard, review submissions | Planned |
