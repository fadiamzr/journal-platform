# scripts

Utility and maintenance scripts.

| File | Description |
|---|---|
| `requirements.txt` | Python deps for scripts (httpx, python-dotenv, psycopg) |
| `smoke_test.py` | Validates env vars, JWKS, storage buckets, LLM, and DB |

## Running the smoke test

```powershell
cd scripts
pip install -r requirements.txt
python smoke_test.py
```

The smoke test reads `apps/api/.env` (not `.env.example`). Populate it first.
