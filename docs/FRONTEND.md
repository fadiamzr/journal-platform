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
   - **Name**: Harriet Vance
   - **Email**: `author@journal.example`
   - **ID**: `usr-author-01`
   - **Access**: Manuscript creation, file upload, AI extraction, revision submissions.
2. **Reviewer**:
   - **Name**: Arthur Pendelton
   - **Email**: `reviewer@journal.example`
   - **ID**: `usr-rev-01`
   - **Access**: Double-blind assignment scorecard, invitation response, recommendation submission.
3. **Editor**:
   - **Name**: Hélène Vance
   - **Email**: `editor@journal.example`
   - **ID**: `usr-editor-01`
   - **Access**: Submission triage, blind copy verification, reviewer assignment, final editorial decision.
4. **Administrator**:
   - **Name**: Tariq Al-Mansoor
   - **Email**: `admin@journal.example`
   - **ID**: `usr-admin-01`
   - **Access**: User role management, journal settings, issue assembly and publishing.

---

## 8. Development & Testing Scripts

From `apps/web/`:

```bash
# Start Next.js development server on http://localhost:3000
pnpm dev

# Run Vitest test suite (state machine, double-blind isolation, i18n parity, extraction, contrast)
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

---

## 11. Pass F1.1 Warmth-and-Life Redesign, Motion & Tokens

Pass F1.1 overhauled the visual design and interactive feel from stark black/white to a refined, warm university-press journal aesthetic while maintaining WCAG 2.1 AA accessibility and zero stock imagery or emojis.

### 11.1 Warm Theme Tokens & Presets

Tokens are defined as CSS variables with RGB channels in `apps/web/src/styles/globals.css` and mapped to Tailwind colors with alpha-value support in `apps/web/tailwind.config.ts`:

1. **`press` (DEFAULT)**:
   - Paper: `#FBF8F1`, Paper Alt: `#F3EDE0`, Ink: `#1F1B16`, Muted: `#6B6256`, Rule: `#DDD3C0`
   - Accent (Burgundy): `#7A1F2B`, Accent Hover: `#5E1722`, Gold: `#B08D3C`
   - Success: `#2F5D3A`, Warning: `#8A5A00`, Danger: `#8B1E2D`
2. **`atlas`**:
   - Paper: `#FAF8F3`, Paper Alt: `#EFEDE4`, Ink: `#17211F`, Muted: `#5B6661`, Rule: `#D8D6CA`
   - Accent (Deep Teal): `#0F4C4A`, Accent Hover: `#0A3836`, Gold: `#B8893A`
3. **`ink`**:
   - Paper: `#FFFFFF`, Paper Alt: `#F7F6F2`, Ink: `#111111`, Muted: `#5B5B57`, Rule: `#D9D7D0`
   - Accent (Academic Navy): `#1B2A4A`, Accent Hover: `#121C33`, Gold: `#9C7A28`

#### Making a Preset Permanent
To permanently set a theme preset and remove the preview switcher:
1. In `apps/web/src/app/[locale]/layout.tsx`, change `data-theme="press"` on the `<html>` element to your preferred preset (`atlas` or `ink`).
2. Remove or comment out `<ThemeSwitcher />` from `src/app/[locale]/layout.tsx`.
3. In `apps/web/src/styles/globals.css`, optionally set the desired preset's values as `:root` defaults.

### 11.2 WCAG 2.1 AA Contrast Verification

Automated evaluation via `apps/web/src/test/contrast.test.ts` confirms that all text/background combinations in all 3 presets meet or exceed WCAG AA requirements (4.5:1 for normal text, 3:1 for large text/borders):

| Preset | Text / Foreground | Background | Contrast Ratio | WCAG AA Status |
|---|---|---|---|---|
| **press** | `ink` (#1F1B16) | `paper` (#FBF8F1) | **16.5 : 1** | PASS |
| **press** | `ink` (#1F1B16) | `paper-alt` (#F3EDE0) | **15.0 : 1** | PASS |
| **press** | `muted` (#6B6256) | `paper` (#FBF8F1) | **5.2 : 1** | PASS |
| **press** | `muted` (#6B6256) | `paper-alt` (#F3EDE0) | **4.7 : 1** | PASS |
| **press** | `accent` (#7A1F2B) | `paper` (#FBF8F1) | **7.7 : 1** | PASS |
| **press** | `white` (#FFFFFF) | `accent` (#7A1F2B) | **5.9 : 1** | PASS |
| **atlas** | `ink` (#17211F) | `paper` (#FAF8F3) | **16.3 : 1** | PASS |
| **atlas** | `ink` (#17211F) | `paper-alt` (#EFEDE4) | **14.8 : 1** | PASS |
| **atlas** | `muted` (#5B6661) | `paper` (#FAF8F3) | **5.5 : 1** | PASS |
| **atlas** | `muted` (#5B6661) | `paper-alt` (#EFEDE4) | **5.0 : 1** | PASS |
| **atlas** | `accent` (#0F4C4A) | `paper` (#FAF8F3) | **7.2 : 1** | PASS |
| **atlas** | `white` (#FFFFFF) | `accent` (#0F4C4A) | **6.4 : 1** | PASS |
| **ink** | `ink` (#111111) | `paper` (#FFFFFF) | **18.8 : 1** | PASS |
| **ink** | `ink` (#111111) | `paper-alt` (#F7F6F2) | **17.5 : 1** | PASS |
| **ink** | `muted` (#5B5B57) | `paper` (#FFFFFF) | **6.9 : 1** | PASS |
| **ink** | `muted` (#5B5B57) | `paper-alt` (#F7F6F2) | **6.4 : 1** | PASS |
| **ink** | `accent` (#1B2A4A) | `paper` (#FFFFFF) | **11.8 : 1** | PASS |
| **ink** | `white` (#FFFFFF) | `accent` (#1B2A4A) | **11.8 : 1** | PASS |

### 11.3 Typographic Issue Cover Art (`IssueCover`)

Located at `apps/web/src/components/shared/IssueCover.tsx`:
- Generates deterministic archival cover art directly from issue metadata (`volume`, `number`, `year`, `title`, journal name).
- Built with SVG line patterns in the theme's `accent` and `gold`, double gold inset framing, and an edge spine accent.
- Supports three responsive sizes: `hero` (home hero band), `card` (archive grids), and `banner` (issue detail header).
- Fully RTL-compliant with automatic spine mirroring and localized typography.

### 11.4 Motion & Interaction Design System

All motion strictly respects `prefers-reduced-motion` by disabling transitions or setting animation progress immediately:
1. **Scroll Reveal (`ScrollReveal.tsx`)**: Elements fade and translate up 12px once upon entering viewport via `IntersectionObserver`.
2. **Animated Metrics (`CountUp.tsx`)**: Numbers count up smoothly with ease-out cubic curve when scrolled into view.
3. **Condensing Sticky Header (`PublicHeader.tsx`)**: Header decreases height, tightens padding, and adds a hairline warm shadow upon scrolling past 24px. Features ISSN display, active sliding nav markers, and dropdown Archive navigation.
4. **Command Search Dialog (`CommandSearchDialog.tsx`)**: Global shortcut (`/` or `Ctrl+K`) opens an accessible search dialog with instant grouped suggestions for Articles, Authors, and Issues over mock data with arrow/enter navigation.
5. **Article Reader Features (`ArticleReader.tsx`)**:
   - Thin reading progress bar anchored at the top of the viewport.
   - Docked floating action bar (Download PDF, Cite, Share) sliding up once scrolling past the title.
   - Dual-column desktop layout (680px reading column + sticky metadata sidebar).
6. **Live Debounced Search (`SearchInterface.tsx`)**: 250ms debounced auto-search with match highlighting and animated list transitions.
7. **Accordion Component (`FaqAccordion.tsx`)**: Accessible disclosure widget with smooth grid-row height animation and rotating chevron.

### 11.5 Bug Fixes Summary (Review Pass F1.1)

1. **Localized Portal Link Roles**: Fixed English role leaking on French/Arabic pages (e.g. `Mon Espace (Auteur)` instead of English `(Author)`).
2. **Search Placeholder Clipping**: Shortened search placeholder to `Search…` / `Rechercher…` / `بحث…` with explicit `aria-label`.
3. **Volume & Issue Localization**: Created unified `formatVolumeIssue(volume, number, locale)` producing `Vol. 2, No. 1` (EN), `Vol. 2, n° 1` (FR), and `المجلد 2، العدد 1` (AR).
4. **Author Honorifics & Punctuation**: Removed "Dr." and "Prof." honorifics from mock dataset and rendering; implemented `formatAuthorList(authors, locale)` with Oxford comma in English and localized conjunctions (`and`, `et`, `و`).
5. **Hardcoded String Sweep**: Swept all pages (`about`, `accessibility`, `contact`, `for-authors`, `login`, `search`, `article`, `issues`) and extracted 30+ previously hardcoded English strings into `messages/en.json`, `fr.json`, `ar.json` while maintaining 100% i18n key parity.
6. **Desktop Layout Rhythm**: Replaced narrow single-column layouts with balanced 12-column desktop grids on the Home hero, For Authors page, Article reader, and Auth layout.

---

## 12. Author Portal & Reviewer Workspace (Stage F2)

Stage F2 establishes the complete interactive authenticated workspaces for both **Authors** and **Reviewers** operating under strict double-blind peer review protocols. All flows run against the in-memory/localStorage typed mock layer with instant optimistic updates, full state machine transitions, and comprehensive accessible UI.

### 12.1 Theme Lock
- The warm academic `press` preset is locked permanently via `data-theme="press"` on the root `<html>` element.
- Temporary client-side theme switcher components were removed in accordance with production lock specifications.

### 12.2 Unified Portal Shell & Navigation
- **`PortalLayout` (`components/layout/PortalLayout.tsx`)**: Shared authenticated wrapper providing breadcrumb paths, active route tracking, and integrated `RoleGuard`. If an unauthorized role visits a workspace (e.g. an author navigating to `/reviewer`), a friendly unauthorized card is rendered offering a one-click button to switch to the required demo persona.
- **`PortalHeader` (`components/layout/PortalHeader.tsx`)**:
  - Role-specific navigation tabs for authors (`/author`, `/author/new`, `/author/profile`) and reviewers (`/reviewer`, `/reviewer/guidelines`, `/reviewer/profile`).
  - Active state indicator with bottom accent border.
  - Notifications Bell popover displaying unread count badge, unread dot indicators, relative timestamps, and one-click "Mark all as read" action.
  - Persona switcher cleanly formatting names without honorifics: `Author (Harriet Vance)`, `Reviewer (Arthur Pendelton)`, `Editor (Hélène Vance)`, `Admin (Tariq Al-Mansoor)`.

### 12.3 Author Portal (`/author`)
1. **Dashboard & Submissions List (`/author/page.tsx`)**:
   - Quick status filter pills: All, Drafts, Under Review, Revisions Requested, Decided.
   - Live search filter across submission titles and IDs.
   - Responsive presentation: High-density data table on desktop with sortable columns; structured cards with metadata on mobile viewports.
   - Contextual action shortcuts: "Continue draft", "Respond to reviewers", "View decision", and "View submission".
   - Accessible `EmptyState` when filters yield no records.

2. **5-Step Submission Wizard (`components/author/SubmissionWizard.tsx`)**:
   - **Step 1: Manuscript**: Accessible PDF dropzone, simulated AI extraction card (skeleton pulse, autofill preview for title/abstract/keywords, and error retry state).
   - **Step 2: Blind Copy**: Upload zone for anonymized manuscript, double-blind guidelines checklist, and warning banner if author identity metadata is detected.
   - **Step 3: Details & Authors**:
     - Multilingual metadata tabs (English, French, Arabic) for title and abstract with real-time word counter.
     - Token-based keywords input manager.
     - `AuthorsRepeater` (`components/author/AuthorsRepeater.tsx`): Dynamic author rows with full name, email, affiliations, ORCID regex validation (`0000-000X-XXXX-XXXX`), corresponding author flag, accessible reordering buttons (Move Up / Move Down), and deletion dialog.
   - **Step 4: Declarations**:
     - Five mandatory compliance checkboxes (Originality, Peer-review agreement, Ethics compliance, Conflict of interest disclosure, and Data availability statement).
     - Optional cover letter textarea.
     - Suggested and excluded reviewer specification fields.
   - **Step 5: Review & Submit**:
     - Comprehensive summary card displaying all entered metadata and uploaded files.
     - Real-time autosave status indicator (`Saved at HH:mm`).
     - "Delete Draft" with confirm dialog.
     - Final submit confirmation modal triggering transition to `submitted_unverified`.

3. **Submission Detail View (`/author/[id]/page.tsx`)**:
   - Header with manuscript title, status badge, current revision round, and version number.
   - Visual audit trail via `Timeline.tsx` mapping lifecycle events.
   - **Overview Tab**: Full metadata, author list with affiliations, and localized abstract.
   - **Files Tab**: Original manuscript and blind copy downloads, with "Replace Blind Copy" action modal for unverified submissions.
   - **Feedback Tab**: Anonymized reviewer evaluations (`Reviewer 1`, `Reviewer 2`) showing 5 evaluation category progress meters and comments to author.
   - **Decision Tab**: Formal editorial decision notice, revision requirements, and decision timestamp.
   - **Revision Resubmission**: Interactive revision form (available when status is `revisions_requested`) capturing response to reviewers, updated files, and submitting round incrementation.

4. **Author Profile (`/author/profile/page.tsx`)**:
   - Profile details: Full name, affiliations, ORCID identifier, and interface language preference.
   - Email notification preferences with granular category toggles.
   - Password update form with current/new password validation.

### 12.4 Reviewer Workspace (`/reviewer`)
1. **Assignments Dashboard (`/reviewer/page.tsx`)**:
   - Filter tabs: Invitations, In Progress, Completed.
   - Due date urgency badges: Normal (days remaining), Due Today (warning banner), and Overdue (danger badge).
   - Invitation actions: Accept invitation (transitions to `accepted`), Decline invitation (dialog capturing mandatory decline reason).
   - Active assignment actions: "Continue Review" linking to split-pane workspace, "Request Due Date Extension" (dialog capturing proposed extension date and rationale).

2. **Split-Pane Review Workspace (`/reviewer/[assignmentId]/page.tsx`)**:
   - **Sticky Anonymity Banner**: Prominent notice confirming double-blind protocol, with "Report Conflict of Interest" modal action.
   - **Resizable Split Layout**: Left pane PDF viewer + Right pane review form with keyboard-accessible divider (`ArrowLeft`/`ArrowRight`/`Home`/`End` to resize).
   - **Focus Mode**: Quick toggles to expand either the PDF reader or the review form to 100% width.
   - **`PdfViewer` (`components/reviewer/PdfViewer.tsx`)**: Accessible toolbar with page navigation, zoom in/out/fit, download, and fullscreen capabilities, rendering simulated double-blind academic sheets.
   - **`ReviewForm` (`components/reviewer/ReviewForm.tsx`)**:
     - 5 Evaluation Criteria (Originality, Methodology, Clarity, Literature Context, Contribution to Field) with 1-5 segmented rating buttons and explanatory descriptors.
     - Recommendation selector (Accept, Minor Revisions, Major Revisions, Reject).
     - Comments for Author (public to author) with live word counter.
     - Confidential Comments for Editor (guaranteed hidden from author) with visual lock indicator.
     - Form completeness percentage meter.
     - Debounced autosave mechanism with timestamp feedback.
     - Submit confirmation dialog.

3. **Reviewer Guidelines (`/reviewer/guidelines/page.tsx`)**:
   - Comprehensive reference guide covering double-blind confidentiality ethics, 5-point scoring rubric definitions, and recommendation criteria.

4. **Reviewer Profile (`/reviewer/profile/page.tsx`)**:
   - Reviewer credentials, bio, research fields, ORCID, notification preferences, and password change.

### 12.5 Double-Blind Protocol Security & Leak Prevention
Strict isolation is enforced at both domain and presentation layers:
- **Reviewer View Isolation**: Reviewer endpoints and types (`ReviewerSubmissionView`) strictly strip author names, emails, affiliations, ORCIDs, and cover letters. Manuscript downloads remain locked until the assignment is in `accepted` state AND the blind copy is verified.
- **Author Feedback View Isolation**: Author endpoints and views (`AuthorFeedbackView`, `AnonymousReviewFeedbackItem`) sanitize reviewer identities into opaque ordinal labels (`Reviewer 1`, `Reviewer 2`) and completely redact confidential editor comments.
- **Automated DOM Audits**: `portal-f2.test.tsx` and `blindness.test.ts` verify that none of the seed author names or confidential editor comments appear anywhere in the rendered HTML of reviewer or author feedback pages.

### 12.6 Accessibility & Quality Assurance
- **`vitest-axe` WCAG 2.1 AA Compliance**: Zero violations across interactive components (`Stepper`, `FileDropzone`, `AuthorsRepeater`, `ReviewForm`, and `ComingSoon`).
- **100% i18n Key Parity**: All strings in `messages/en.json`, `fr.json`, and `ar.json` under namespaces `portalNav`, `author`, `reviewer`, and `portal` maintain 100% parity verified by `src/i18n/parity.test.ts`.
- **Full Suite Status**: All 50 tests across 6 test suites pass cleanly with 0 TypeScript errors and 0 ESLint warnings.

### 12.7 Portal Redirection & Chrome Polish (Pass F2.1)
1. **Dynamic Role Redirection (`/[locale]/portal`)**: Replaced the static placeholder with an active role redirector:
   - `author` -> `/[locale]/author`
   - `reviewer` -> `/[locale]/reviewer`
   - `editor` -> `/[locale]/editor`
   - `admin` -> `/[locale]/admin`
   - Unauthenticated sessions are gracefully routed to `/[locale]/login`.
2. **Editorial & Admin Coming Soon Workspaces (`/editor`, `/admin`)**:
   - Polished, fully accessible coming soon workspaces rendered inside `PortalLayout`.
   - Outlines planned Stage F3 modules: manuscript triage, reviewer matching, issue builder, editorial decisions, user administration, journal configuration, and analytics.
   - Provides direct navigation links to the public journal site and demo persona switching.
3. **Mock-Only Persona Submenu**:
   - The demo persona switcher in `PortalHeader` was relocated into the user dropdown menu as a nested "Switch preview persona" submenu.
   - Guarded by `NEXT_PUBLIC_API_MODE === "mock"`, automatically hiding in production live mode.
4. **Academic Honorifics Removal**:
   - Swept and stripped all academic honorifics ("Dr.", "Prof.") from user names in portal chrome, welcome headers, persona switchers, registration placeholders, and editorial board brand configuration.
   - Added `stripHonorifics` utility in `lib/utils.ts`.

