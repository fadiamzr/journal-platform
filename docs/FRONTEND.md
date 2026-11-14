# Frontend Architecture & Developer Guide (Stage F1)

This document describes the architecture, design tokens, internationalization (i18n), mock data layer, and public/auth interfaces implemented for the academic journal platform (`apps/web`).

---

## 1. Overview & Technology Stack

The frontend is an academic journal publishing platform designed as an open, accessible, modern replacement for Open Journal Systems (OJS).

- **Framework**: Next.js 15 (App Router)
- **UI Runtime**: React 19, TypeScript (strict mode)
- **Styling**: Tailwind CSS, PostCSS, Radix UI primitives (`shadcn/ui` style)
- **Internationalization**: `next-intl` with route-level locale negotiation
- **Testing**: Vitest, React Testing Library, jsdom
- **Icons**: Lucide React
- **Notifications**: Sonner

---

## 2. Directory Structure

```
apps/web/
├── messages/                     # Translation dictionaries
│   ├── en.json                   # English (default)
│   ├── fr.json                   # French
│   └── ar.json                   # Arabic
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root HTML & body shell
│   │   └── [locale]/             # Localized route tree
│   │       ├── layout.tsx        # NextIntlClientProvider & SessionProvider
│   │       ├── (public)/         # Public reader site
│   │       │   ├── page.tsx      # Journal Home & current issue highlight
│   │       │   ├── about/        # Aims, Scope, Open Access & Archiving
│   │       │   ├── editorial-board/ # Editors, affiliations, ORCIDs
│   │       │   ├── for-authors/  # Guidelines, double-blind instructions & FAQ
│   │       │   ├── accessibility/# WCAG 2.1 AA compliance statement
│   │       │   ├── contact/      # Direct editorial inquiry form
│   │       │   ├── issues/       # Archive & current issue redirect
│   │       │   ├── articles/[id]/# Academic article reader & citation export
│   │       │   └── search/       # Multilingual faceted article search
│   │       ├── (auth)/           # Authentication flows
│   │       │   ├── login/        # Standard login + Demo Persona selector
│   │       │   ├── register/     # Author account creation
│   │       │   └── forgot-password/ # Password reset request
│   │       └── portal/           # Authenticated workspace landing shell
│   ├── components/
│   │   ├── ui/                   # Reusable atomic UI components (shadcn/ui)
│   │   ├── shared/               # Domain-aware shared components
│   │   │   ├── ArticleCard.tsx   # Issue TOC & search publication cards
│   │   │   ├── AuthorList.tsx    # Academic author display with affiliations & ORCIDs
│   │   │   ├── CitationBlock.tsx # APA & BibTeX formatted citation exporter
│   │   │   ├── FileDropzone.tsx  # PDF drag-and-drop manuscript uploader
│   │   │   ├── LanguageTabs.tsx  # Multilingual metadata tab selector
│   │   │   ├── PageHeader.tsx    # Academic header with breadcrumb support
│   │   │   ├── StatusBadge.tsx   # Color-coded workflow badges
│   │   │   └── Timeline.tsx      # Peer review audit trail & history
│   │   ├── layout/               # Shell layouts (Public, Auth, Headers, Footers)
│   │   ├── article/              # Article reading view & abstract presenter
│   │   ├── contact/              # Interactive inquiry form
│   │   └── search/               # Faceted live filtering search interface
│   ├── config/
│   │   └── brand.ts              # Single source of truth for journal branding
│   ├── i18n/
│   │   ├── routing.ts            # Locales configuration (en, fr, ar)
│   │   └── request.ts            # next-intl server request loader
│   ├── lib/
│   │   ├── api/                  # Unified API Client abstraction
│   │   │   ├── client.ts         # ApiClient TypeScript interface & ApiError
│   │   │   ├── index.ts          # Universal export switching mock/live
│   │   │   ├── mock/             # Complete typed mock engine
│   │   │   │   ├── client.ts     # Mock ApiClient implementation
│   │   │   │   ├── seed.ts       # Realistic academic dataset
│   │   │   │   └── store.ts      # LocalStorage persistence & state machine
│   │   │   └── live/             # Future Supabase/FastAPI backend adapter
│   │   │       └── client.ts     # 501 stub client
│   │   ├── auth/
│   │   │   └── session-context.tsx # SessionProvider, useSession, useRole
│   │   ├── domain/
│   │   │   └── types.ts          # Comprehensive domain models & blind view types
│   │   └── utils.ts              # cn helper, formatLocalizedDate, Latin digits
│   ├── middleware.ts             # next-intl locale negotiation middleware
│   └── styles/
│       ├── fonts.ts              # Google fonts setup
│       └── globals.css           # Academic CSS tokens & utilities
├── vitest.config.ts              # Vitest test configuration
└── tailwind.config.ts            # Design system theme tokens
```

---

## 3. Academic Design System & Design Tokens

The visual style is strictly modelled after physical university research publications (e.g., Oxford University Press, Cambridge University Press, Revue d'histoire moderne).

### 3.1 Design Principles
- **Minimalist & Restrained**: No drop shadows (except elevated popovers/dialogs), no gradients, no emojis.
- **Micro-radii**: 2px to 4px border radii (`rounded-[3px]`) for a clean, sharp, archival appearance.
- **Light Theme Only**: High contrast ink-on-paper palette designed for reading comfort.
- **Print Optimization**: Dedicated `@media print` styles hiding navigation, footer, and interactive controls while retaining full article body, DOIs, and citations.

### 3.2 Color Tokens

| Token | Hex Value | Semantic Purpose |
|---|---|---|
| `ink` | `#111111` | Primary text and headings |
| `paper` | `#FFFFFF` | Primary surface background |
| `paper-alt` | `#F7F6F2` | Secondary warm paper background (callouts, sidebars) |
| `rule` | `#D9D7D0` | Dividing lines and architectural borders |
| `muted` | `#5B5B57` | Secondary text, publication dates, affiliations |
| `accent` | `#1B2A4A` | Scholarly deep navy (interactive links, brand marks) |
| `success` | `#2F5D3A` | Accepted submissions, verified blind copies, published |
| `warning` | `#8A5A00` | Revisions requested, pending metadata extraction |
| `danger` | `#8B1E2D` | Declined submissions, extraction failures |

### 3.3 Typography

- **Latin Headings & Monograph Body**: *Source Serif 4* (`font-serif`, `font-heading`)
- **Latin User Interface**: *Inter* (`font-sans`, `font-body`)
- **Arabic Headings & Longform Body**: *Amiri* (`font-arabic-serif`)
- **Arabic User Interface**: *IBM Plex Sans Arabic* (`font-arabic-sans`)
- **Metadata, DOIs & ISSNs**: Monospace (`font-mono`)

### 3.4 Customizing the Brand

To re-brand the journal for another university or institute, edit `src/config/brand.ts`:
- `name`: Publication title (e.g., "Journal of Humanities & Social Sciences")
- `tagline`: Trilingual subheadings
- `description`: Editorial overview
- `issn`: Print and Online ISSNs
- `publisher`: Press name, headquarters location, website URL
- `contact`: Editorial office address, email, phone number
- `aimsAndScope`: Trilingual editorial scope paragraphs
- `editorialBoard`: Editor-in-Chief, Associate Editors, Board Members with affiliations and ORCIDs

---

## 4. Internationalization & Bi-directional RTL

The platform provides complete trilingual parity across **English (`en`)**, **French (`fr`)**, and **Arabic (`ar`)**.

### 4.1 Bi-Directional Layout & Font Switching
- The root layout (`src/app/[locale]/layout.tsx`) dynamically sets `dir="rtl"` and `lang="ar"` when Arabic is active, or `dir="ltr"` for English and French.
- CSS classes automatically map fonts according to the document direction:
  - When `dir="rtl"`, body text activates *IBM Plex Sans Arabic* and headings activate *Amiri*.
  - When `dir="ltr"`, body text activates *Inter* and headings activate *Source Serif 4*.
- Tailwind utility classes use `rtl:` prefix modifiers (e.g., `rtl:rotate-180` for directional chevrons and breadcrumbs, `me-2` and `ms-2` for logical margins).

### 4.2 Latin Digits Preservation in Arabic
In academic publishing, Arabic issues, page numbers, volume numbers, years, DOIs, and dates conventionally use Western Arabic (Latin) digits (`0-9`) rather than Eastern Arabic numerals (`٠-٩`).
The utility helper `formatLocalizedDate` (`src/lib/utils.ts`) forces Latin numbering via the Unicode extension:
```ts
new Intl.DateTimeFormat("ar-u-nu-latn", { ... })
```

---

## 5. Domain Models & Typed Mock Data Layer

The platform is decoupled from any physical backend via the typed `ApiClient` interface (`src/lib/api/client.ts`). When running in mock mode (`NEXT_PUBLIC_API_MODE=mock`), it provides a zero-dependency, in-browser persistent environment.

### 5.1 Seed Dataset
Initial seed state (`src/lib/api/mock/seed.ts`) includes:
- **7 Seed Users**: Authors, reviewers, editors, and admins.
- **3 Issues**: Volume 1 Issue 1 (2025), Volume 1 Issue 2 (2025), Volume 2 Issue 1 (2026).
- **12 Published Articles**: Fully attributed with DOIs, multilingual abstracts, and keywords in EN, FR, and AR.
- **8 Submissions**: Spanning every stage of the lifecycle (`draft`, `submitted`, `in_review`, `revisions_requested`, `accepted`, `rejected`, `published`).

### 5.2 Double-Blind Anonymity Enforcement
To guarantee double-blind compliance, the mock layer implements strict projection helpers:
- `ReviewerSubmissionView`: Reviewers receive only the manuscript round, anonymous submission ID, title, abstract, and blind copy file. Author names, affiliations, and emails are strictly excluded from reviewer payloads.
- `AuthorFeedbackView`: Authors receive reviewer recommendations and constructive comments prefixed as "Reviewer 1", "Reviewer 2". Reviewer identities and confidential editorial notes are never exposed.

### 5.3 Simulated AI Extraction Engine
Simulates the backend Phase 5 AI metadata extraction service:
- Initiates in `pending` status.
- Completes asynchronously after a realistic 4-second delay, populating title, abstract, and keywords.
- Contains a test fixture: titles or files containing `"fail_extraction"` or `"corrupt"` trigger simulated extraction failure with actionable error messages.

### 5.4 State Machine & Persistence
- Transitions are validated against `VALID_STATUS_TRANSITIONS` in `src/lib/api/mock/store.ts`. Resubmissions automatically increment the round number and append a new version.
- State is saved in browser `localStorage` under key `journal_platform_mock_v1`.
- Calling `resetDemoData()` resets localStorage back to the pristine seed dataset.

---

## 6. Mock to Live Backend Swap Guide

Switching from mock mode to the real backend requires only one environment variable:

```env
# apps/web/.env.local
NEXT_PUBLIC_API_MODE=live
```

When set to `live`, `src/lib/api/index.ts` automatically instantiates `liveApiClient`. The table below details the corresponding backend endpoints:

| `ApiClient` Method | FastAPI / Supabase Route | Auth Role |
|---|---|---|
| `listIssues()` | `GET /api/v1/issues` | Public |
| `getIssue(id)` | `GET /api/v1/issues/{id}` | Public |
| `listArticles(filters)` | `GET /api/v1/articles` | Public |
| `getArticle(id)` | `GET /api/v1/articles/{id}` | Public |
| `searchArticles(params)` | `GET /api/v1/articles/search` | Public |
| `signIn(credentials)` | Supabase `auth.signInWithPassword` | Public |
| `register(payload)` | Supabase `auth.signUp` | Public |
| `signOut()` | Supabase `auth.signOut` | Authenticated |
| `listMySubmissions()` | `GET /api/v1/submissions/mine` | Author |
| `createDraft(payload)` | `POST /api/v1/submissions` | Author |
| `uploadManuscript(id, file)` | Storage `manuscripts-raw/{id}/...` | Author |
| `uploadBlindCopy(id, file)` | Storage `manuscripts-anonymized/{id}/...` | Author |
| `runExtraction(id)` | `POST /api/v1/extraction/extract/{id}` | Author / Editor |
| `submit(id)` | `POST /api/v1/submissions/{id}/submit` | Author |
| `listAssignments()` | `GET /api/v1/reviewer/assignments` | Reviewer |
| `respondToInvitation(id, accept)` | `POST /api/v1/reviewer/assignments/{id}/respond` | Reviewer |
| `submitReview(id, payload)` | `POST /api/v1/reviewer/assignments/{id}/submit` | Reviewer |
| `listPipeline()` | `GET /api/v1/editor/submissions` | Editor |
| `verifyBlindCopy(id, ok)` | `POST /api/v1/editor/submissions/{id}/blind-copy` | Editor |
| `decide(id, decision)` | `POST /api/v1/editor/submissions/{id}/decide` | Editor |
| `createIssue(payload)` | `POST /api/v1/admin/issues` | Admin |
| `publishIssue(id)` | `POST /api/v1/admin/issues/{id}/publish` | Admin |

---

## 7. Demo Preview Personas

For rapid testing and grading without entering credentials, four preview personas are pre-configured in the mock dataset and accessible from the `/login` screen and `/portal` header:

1. **Author**:
   - **Name**: Dr. Harriet Vance
   - **Email**: `author@journal.example`
   - **ID**: `usr-author-01`
   - **Access**: Manuscript creation, file upload, AI extraction, revision submissions.
2. **Reviewer**:
   - **Name**: Prof. Arthur Pendelton
   - **Email**: `reviewer@journal.example`
   - **ID**: `usr-rev-01`
   - **Access**: Double-blind assignment scorecard, invitation response, recommendation submission.
3. **Editor**:
   - **Name**: Prof. Hélène Vance
   - **Email**: `editor@journal.example`
   - **ID**: `usr-editor-01`
   - **Access**: Submission triage, blind copy verification, reviewer assignment, final editorial decision.
4. **Administrator**:
   - **Name**: Dr. Tariq Al-Mansoor
   - **Email**: `admin@journal.example`
   - **ID**: `usr-admin-01`
   - **Access**: User role management, journal settings, issue assembly and publishing.

---

## 8. Development & Testing Scripts

From `apps/web/`:

```bash
# Start Next.js development server on http://localhost:3000
pnpm dev

# Run Vitest test suite (state machine, double-blind isolation, i18n parity, extraction)
pnpm test

# Type-check TypeScript sources without emitting
pnpm typecheck

# Run Next.js ESLint validation
pnpm lint

# Compile optimized production build
pnpm build
```

---

## 9. Strings Requiring Native Editorial Review

The following translations were generated during setup and should be validated by native Arabic and French copyeditors:

1. **Arabic (`messages/ar.json`)**:
   - `forAuthors.anonItem2`: Phrasing of the third-person citation rule (`الإشارة إلى الأعمال السابقة بصيغة الغائب`).
   - `about.publishingBody`: Phrasing for digital preservation networks (`شبكة الحفظ الرقمي`).
   - `article.citation`: Citation export labels.
2. **French (`messages/fr.json`)**:
   - `auth.agreeTerms`: Academic legal phrasing for code of ethics and peer-review agreement.
   - `status.rejected`: Academic French preference for "Non retenu" or "Décliné" over "Rejeté".

---

## 10. Known Limitations & Stage F2/F3 Handover

- **Stage F1 Scope**: The public reader interface, issue archive, faceted search, informational pages, and authentication flows are 100% complete.
- **Portal Shell**: The `/portal` landing page currently provides persona switching and session inspection. In **Stage F2**, the interactive Author Submission Wizard and Reviewer Scorecard will be implemented. In **Stage F3**, the Editor Pipeline Kanban and Admin Issue Publisher will be added. All underlying mock API methods, domain models, and UI components are already built to support these upcoming workflows seamlessly.
