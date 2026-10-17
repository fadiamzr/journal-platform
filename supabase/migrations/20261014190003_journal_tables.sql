-- =============================================================================
-- 20261014190003_journal_tables.sql
-- Phase 2 — Database & RLS
--
-- Creates all core journal tables:
--   issues, submissions, submission_authors, submission_versions,
--   reviewer_assignments, reviews, submission_status_history
--
-- i18n columns (title, abstract, keywords) are JSONB objects whose keys must
-- be a subset of {'en','fr','ar'}. Validated by private.valid_i18n_keys().
-- =============================================================================

-- ── i18n key validation helper ────────────────────────────────────────────────
-- IMMUTABLE so it can be used directly in CHECK constraints.
-- Checks that every key in a JSONB object is a valid app_locale value.
create or replace function private.valid_i18n_keys(j jsonb)
  returns boolean
  language sql
  immutable
  set search_path = ''
as $$
  select j is null
      or not exists (
           select 1
           from jsonb_object_keys(j) k
           where k not in ('en', 'fr', 'ar')
         );
$$;

comment on function private.valid_i18n_keys(jsonb) is
  'Returns true when j is null or all its top-level keys are valid app_locale values. '
  'Used in CHECK constraints on i18n JSONB columns.';

-- ── issues ────────────────────────────────────────────────────────────────────
create table public.issues (
  id           uuid             primary key default gen_random_uuid(),
  volume       int              not null,
  number       int              not null,
  year         int              not null,
  title        jsonb,
  status       public.issue_status not null default 'draft',
  published_at timestamptz,
  created_at   timestamptz      not null default now(),

  constraint uq_issues_volume_number  unique (volume, number),
  constraint chk_issues_title_keys    check (private.valid_i18n_keys(title))
);

comment on table public.issues is
  'Journal issue records. Published issues (status=published) are visible to all users.';

-- ── submissions ───────────────────────────────────────────────────────────────
create table public.submissions (
  id                  uuid                      primary key default gen_random_uuid(),
  author_id           uuid                      not null
                        references public.user_profiles (id),
  status              public.submission_status  not null default 'draft',
  manuscript_language public.app_locale         not null,
  title               jsonb,
  abstract            jsonb,
  keywords            jsonb,   -- object of string arrays, e.g. {"en": ["word1","word2"]}
  current_round       int                       not null default 1,
  issue_id            uuid
                        references public.issues (id),
  article_order       int,
  doi                 text                      unique,
  extraction_status   public.extraction_status  not null default 'not_started',
  extraction_error    text,
  submitted_at        timestamptz,
  decided_at          timestamptz,
  published_at        timestamptz,
  created_at          timestamptz               not null default now(),
  updated_at          timestamptz               not null default now(),

  -- i18n key constraints: keys must be a subset of {en, fr, ar}
  constraint chk_submissions_title_keys    check (private.valid_i18n_keys(title)),
  constraint chk_submissions_abstract_keys check (private.valid_i18n_keys(abstract)),
  constraint chk_submissions_keywords_keys check (private.valid_i18n_keys(keywords)),

  -- when not draft, the title in the manuscript_language must be non-empty
  constraint chk_submissions_title_required check (
    status = 'draft'
    or (
      title is not null
      and title ->> (manuscript_language::text) is not null
      and trim(title ->> (manuscript_language::text)) <> ''
    )
  ),

  constraint chk_submissions_round_positive check (current_round >= 1)
);

comment on table public.submissions is
  'Manuscript submissions. title/abstract/keywords are trilingual JSONB objects '
  'keyed by ISO 639-1 code (en, fr, ar). Status transitions are enforced by '
  'the workflow_guards trigger.';

comment on column public.submissions.keywords is
  'JSONB object of string arrays, e.g. {"en": ["machine learning","NLP"]}. '
  'Keys must be valid app_locale values.';

create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function private.set_updated_at();

-- ── submission_authors ────────────────────────────────────────────────────────
-- Stores the declared author list for double-blind purposes.
-- Separate from the platform user account (author_id in submissions).
create table public.submission_authors (
  id               uuid    primary key default gen_random_uuid(),
  submission_id    uuid    not null
                             references public.submissions (id) on delete cascade,
  position         int     not null,
  full_name        text    not null,
  email            text,
  affiliation      text,
  orcid            text,
  is_corresponding boolean not null default false,

  constraint uq_submission_authors_position unique (submission_id, position)
);

comment on table public.submission_authors is
  'Declared author list for a submission. Kept separate from platform accounts '
  'to support double-blind review (reviewers never see this table).';

-- ── submission_versions ───────────────────────────────────────────────────────
create table public.submission_versions (
  id                    uuid    primary key default gen_random_uuid(),
  submission_id         uuid    not null
                                  references public.submissions (id) on delete cascade,
  round                 int     not null,
  manuscript_path       text    not null,  -- storage path in `manuscripts` bucket
  anonymized_path       text,              -- storage path in `manuscripts-anonymized` bucket
  file_size_bytes       bigint,
  response_to_reviewers text,
  uploaded_by           uuid    not null
                                  references public.user_profiles (id),
  created_at            timestamptz not null default now(),

  constraint uq_submission_versions_round unique (submission_id, round)
);

comment on table public.submission_versions is
  'PDF file references per revision round. '
  'manuscript_path (manuscripts bucket) is private to author/editor/admin. '
  'anonymized_path (manuscripts-anonymized bucket) is shared with assigned reviewers.';

-- ── reviewer_assignments ──────────────────────────────────────────────────────
create table public.reviewer_assignments (
  id            uuid                     primary key default gen_random_uuid(),
  submission_id uuid                     not null
                                           references public.submissions (id) on delete cascade,
  round         int                      not null,
  reviewer_id   uuid                     not null
                                           references public.user_profiles (id),
  status        public.assignment_status not null default 'invited',
  invited_by    uuid                     not null
                                           references public.user_profiles (id),
  invited_at    timestamptz              not null default now(),
  responded_at  timestamptz,
  due_at        timestamptz,

  constraint uq_reviewer_assignments_unique unique (submission_id, round, reviewer_id)
);

comment on table public.reviewer_assignments is
  'Tracks which reviewer is assigned to which submission round. '
  'Double-blind: reviewer sees neither author identity nor other reviewers.';

-- ── reviews ───────────────────────────────────────────────────────────────────
create table public.reviews (
  id                              uuid   primary key default gen_random_uuid(),
  assignment_id                   uuid   not null unique
                                           references public.reviewer_assignments (id) on delete cascade,
  -- 5 criteria scored 1–5
  originality_score               smallint check (originality_score  between 1 and 5),
  methodology_score               smallint check (methodology_score  between 1 and 5),
  clarity_score                   smallint check (clarity_score      between 1 and 5),
  significance_score              smallint check (significance_score between 1 and 5),
  relevance_score                 smallint check (relevance_score    between 1 and 5),
  recommendation                  public.review_recommendation,
  comments_to_author              text,
  confidential_comments_to_editor text,
  submitted_at                    timestamptz,   -- null = draft; non-null = finalized
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

comment on table public.reviews is
  'Reviewer assessment per assignment. submitted_at is null while the review is in draft; '
  'set to now() when the reviewer submits. Updates are blocked after submission. '
  'confidential_comments_to_editor is never exposed to authors.';

create trigger trg_reviews_updated_at
  before update on public.reviews
  for each row execute function private.set_updated_at();

-- ── submission_status_history ─────────────────────────────────────────────────
-- Immutable audit trail. Populated exclusively by the record_status_change()
-- SECURITY DEFINER trigger — no client INSERT/UPDATE/DELETE.
create table public.submission_status_history (
  id            uuid                     primary key default gen_random_uuid(),
  submission_id uuid                     not null
                                           references public.submissions (id) on delete cascade,
  from_status   public.submission_status,           -- null for the first transition
  to_status     public.submission_status not null,
  changed_by    uuid
                  references public.user_profiles (id) on delete set null,
  changed_at    timestamptz              not null default now()
);

comment on table public.submission_status_history is
  'Immutable audit trail of every submission status transition. '
  'Rows are written only by the private.record_status_change() SECURITY DEFINER trigger.';

-- ── indexes ───────────────────────────────────────────────────────────────────
-- Every FK column gets an index. Additional indexes on columns used in RLS policies.

create index idx_submissions_author_id   on public.submissions (author_id);
create index idx_submissions_status      on public.submissions (status);
create index idx_submissions_issue_id    on public.submissions (issue_id) where issue_id is not null;

create index idx_submission_authors_sub  on public.submission_authors (submission_id);

create index idx_submission_versions_sub on public.submission_versions (submission_id);
create index idx_submission_versions_by  on public.submission_versions (uploaded_by);

create index idx_reviewer_assignments_sub on public.reviewer_assignments (submission_id);
create index idx_reviewer_assignments_rev on public.reviewer_assignments (reviewer_id);
create index idx_reviewer_assignments_inv on public.reviewer_assignments (invited_by);

create index idx_reviews_assignment      on public.reviews (assignment_id);

create index idx_status_history_sub      on public.submission_status_history (submission_id);
create index idx_status_history_by       on public.submission_status_history (changed_by) where changed_by is not null;
