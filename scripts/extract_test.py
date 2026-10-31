"""Manual test: send one PDF to Gemini and save the extracted metadata JSON.

Public papers only (the free tier may use inputs to improve Google products).
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import tempfile
import time
from pathlib import Path

import httpx
from dotenv import dotenv_values

ENV = Path(__file__).resolve().parents[1] / "apps" / "api" / ".env"

PROMPT = """You extract bibliographic metadata from the PDF of an academic manuscript.
Return ONLY valid JSON (no markdown fences, no commentary) with exactly this shape:

{
  "language": "en" | "fr" | "ar",
  "title":    {"en": string|null, "fr": string|null, "ar": string|null},
  "abstract": {"en": string|null, "fr": string|null, "ar": string|null},
  "keywords": {"en": string[], "fr": string[], "ar": string[]},
  "authors": [
    {"full_name": string, "affiliation": string|null, "email": string|null,
     "orcid": string|null, "is_corresponding": boolean}
  ],
  "notes": string|null
}

Rules:
- "language" is the main language of the manuscript body.
- Fill a language in title/abstract/keywords ONLY if that language version actually
  appears in the document. Never translate and never invent. Use null or [] when absent.
- Copy text exactly as written, in its original script. For Arabic keep the correct
  reading order and letters.
- Abstracts must be complete, not truncated.
- List authors in the order printed, with the affiliation as written. Set is_corresponding
  true only if the document marks it.
- If something is unclear, use null and explain briefly in "notes"."""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", help="path to a public/open-access PDF")
    args = ap.parse_args()

    cfg = dotenv_values(ENV) if ENV.is_file() else {}
    key = (cfg.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
    model = (
        cfg.get("GEMINI_MODEL") or os.environ.get("GEMINI_MODEL") or "gemini-3.5-flash-lite"
    ).strip()
    if not key:
        print("FAIL: GEMINI_API_KEY is not set (checked apps/api/.env and environment)")
        return 1
    path = Path(args.pdf)
    if not path.is_file():
        print("FAIL: file not found")
        return 1
    data = path.read_bytes()
    if len(data) > 18 * 1024 * 1024:
        print("FAIL: PDF is larger than about 18 MB (inline upload limit); use a smaller one")
        return 1

    payload = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": "application/pdf",
                             "data": base64.b64encode(data).decode("ascii")}},
            {"text": PROMPT},
        ]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    start = time.time()
    try:
        resp = httpx.post(url, headers={"x-goog-api-key": key}, json=payload, timeout=120)
    except httpx.HTTPError as exc:
        print(f"FAIL: network error {type(exc).__name__}")
        return 1
    elapsed = time.time() - start

    if resp.status_code != 200:
        msg = ""
        try:
            msg = resp.json().get("error", {}).get("message", "")
        except ValueError:
            pass
        print(f"FAIL: HTTP {resp.status_code} {msg[:300]}")
        return 1

    body = resp.json()
    try:
        text = body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        reason = (body.get("candidates") or [{}])[0].get("finishReason")
        print(f"FAIL: no text returned (finishReason={reason})")
        return 1

    valid = True
    try:
        parsed = json.loads(text)
        pretty = json.dumps(parsed, ensure_ascii=False, indent=2)
    except json.JSONDecodeError:
        parsed, pretty, valid = {}, text, False

    out_dir = Path(tempfile.gettempdir()) / "extraction-tests"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{path.stem}.json"
    out.write_text(pretty, encoding="utf-8")

    usage = body.get("usageMetadata", {})
    print(f"model={model}  time={elapsed:.1f}s  valid_json={valid}")
    print(f"tokens: prompt={usage.get('promptTokenCount')} output={usage.get('candidatesTokenCount')}")
    if valid:
        print(f"language={parsed.get('language')}")
        for field in ("title", "abstract", "keywords"):
            filled = [k for k, v in (parsed.get(field) or {}).items() if v]
            print(f"{field}: {filled}")
        print(f"authors: {len(parsed.get('authors') or [])}")
    print(f"saved: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())