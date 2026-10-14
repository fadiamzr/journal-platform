# Architecture — Journal Platform

## Overview

Journal Platform is a trilingual (English, French, Arabic) academic publishing platform with double-blind peer review, built as a modern replacement for Open Journal Systems. It uses a Supabase-backed Python/FastAPI API and a Next.js frontend.

---

## Tech Stack

| Concern | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, next-intl |
| Backend | Python 3.12, FastAPI, Pydantic v2, Uvicorn |
| Auth | Supabase Auth — asymmetric JWT (ECC P-256), verified via JWKS |
| Database | Supabase Postgres with Row-Level Security (RLS) |
| Storage | Supabase Storage (PDF-only, 50 MB per file) |
| LLM | Pluggable via `LLM_PROVIDER` (gemini \| ollama \| anthropic) |
| Runtime | Docker Desktop, pnpm, Python 3.12 |

---

## Roles & Row-Level Security Principles

Four roles are assigned per user profile and enforced by Postgres RLS policies:

| Role | Access |
|---|---|
| **Author** | Create/read/update own submissions only. No access to other authors' manuscripts or reviewer identities. |
| **Reviewer** | Read only the **anonymized** manuscript versions they are explicitly assigned to. Cannot see author identity, other reviewers, or other submissions. |
| **Editor** | Full read/write access to all submissions, reviews, and decisions within their assigned journal. Can assign reviewers. |
| **Admin** | Full access across all journals, users, and configuration. Can manage roles and system settings. |

RLS is the authoritative enforcement layer — the API validates JWTs but relies on Postgres policies as the final security gate. Service-role key usage is confined to administrative background tasks only.

---

## Submission Lifecycle

```
Draft ──► Submitted ──► In Review ──► Revisions Requested ──► Accepted ──► Published
                                              │
                                              └──► Rejected
```

| State | Description |
|---|---|
| **Draft** | Author is composing. Not visible to editors. |
| **Submitted** | Author has submitted. Editor is notified. |
| **In Review** | Editor has assigned at least one reviewer. Anonymized PDF shared. |
| **Revisions Requested** | Reviewers have responded; author must revise and resubmit. |
| **Accepted** | Editor accepts the manuscript; enters production. |
| **Published** | Final PDF moved to the `published` bucket; metadata indexed. |
| **Rejected** | Editor rejects at any post-submission stage. |

---

## Storage Buckets

| Bucket | Visibility | Purpose |
|---|---|---|
| `manuscripts` | **Private** | Author-uploaded originals, editor copies. Access via signed URLs scoped to Author/Editor/Admin roles. |
| `manuscripts-anonymized` | **Private** | Redacted PDFs generated for double-blind review. Access restricted to assigned Reviewer + Editor + Admin. |
| `published` | **Public** | Final accepted PDFs served directly to the public after acceptance. |

All buckets enforce **PDF-only** MIME type and a **50 MB** per-file limit set in the Supabase dashboard.

---

## LLM Provider Abstraction

The `LLM_PROVIDER` environment variable selects the active backend at startup. The API exposes a single internal `LLMClient` interface; swapping providers requires only a config change — no code changes.

| `LLM_PROVIDER` | Backend | Auth |
|---|---|---|
| `gemini` | Google Gemini REST API (`generateContent`) | `x-goog-api-key` header |
| `ollama` | Local Ollama HTTP server | None (local) |
| `anthropic` | Anthropic Messages API | `x-api-key` header |

Default model: `gemini-3.5-flash-lite` (free tier).

---

## Trilingual Support (en / fr / ar)

- **UI language** is determined by the user's browser locale preference and can be overridden per-session.
- **Content fields** that carry per-language data (title, abstract, keywords) are stored as JSONB columns keyed by ISO 639-1 code (`"en"`, `"fr"`, `"ar"`).
- **Arabic (ar)** uses RTL layout. The Next.js root layout sets `dir="rtl"` when `locale === "ar"`, and Tailwind's `rtl:` modifier is used for directional utilities.
- All three locales are first-class — no locale is treated as a fallback for another.
