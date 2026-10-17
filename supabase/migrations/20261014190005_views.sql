-- =============================================================================
-- 20261014190005_views.sql
-- Phase 2 — Database & RLS
--
-- Creates security views. ALL views are owned by postgres and therefore run
-- with postgres privileges, which bypass RLS on the underlying tables.
-- Each view MUST implement its own WHERE-clause security gate using auth.uid().
-- A SQL comment on each view documents this contract.
--
-- Views:
--   public.reviewer_submissions      — assigned reviewer's portal (double-blind)
--   public.author_review_feedback    — author's feedback after decision
--   public.published_articles        — public article listing
--   public.published_article_authors — public author metadata for published articles
--   public.published_issues          — public issue listing
-- =============================================================================

-- ── reviewer_submissions ──────────────────────────────────────────────────────
-- SECURITY CONTRACT: This view runs as its owner (postgres), bypassing table RLS.
-- The WHERE clause `ra.reviewer_id = (select auth.uid())` is the sole access gate.
-- The view intentionally excludes: author_id, submission_authors columns,
-- manuscript_path (the non-anonymised PDF path), and any author-identifying data.
-- anonymized_path is only revealed when the assignment status is accepted or completed.
create or replace view public.reviewer_submissions as
select
  ra.submission_id,
  ra.round,
  ra.id                                         as assignment_id,
  ra.status                                     as assignment_status,
  ra.due_at,
  s.manuscript_language,
  s.title,
  s.abstract,
  s.keywords,
  -- Anonymised path only available once the reviewer has accepted the assignment
  case
    when ra.status in ('accepted', 'completed') then sv.anonymized_path
    else null
  end                                           as anonymized_path
from public.reviewer_assignments               ra
join public.submissions                        s   on s.id  = ra.submission_id
left join public.submission_versions           sv  on sv.submission_id = ra.submission_id
                                                   and sv.round        = ra.round
-- ↑ SECURITY GATE: only the current authenticated reviewer's assignments
where ra.reviewer_id = (select auth.uid());

comment on view public.reviewer_submissions is
  'Reviewer portal: shows submission metadata for the caller''s own assignments only. '
  'SECURITY: runs as view owner (postgres, bypasses RLS). '
  'Access gate: WHERE reviewer_id = auth.uid(). '
  'Author identity is never exposed: author_id, submission_authors, and '
  'manuscript_path are intentionally excluded. '
  'anonymized_path is null until the assignment is accepted.';

-- ── author_review_feedback ────────────────────────────────────────────────────
-- SECURITY CONTRACT: This view runs as its owner (postgres), bypassing table RLS.
-- Three mandatory WHERE-clause gates:
--   1. s.author_id = auth.uid()                  — own submissions only
--   2. r.submitted_at is not null                 — finalised reviews only
--   3. s.status in (revisions_requested, ...)     — only after a decision is made
-- The view intentionally excludes: reviewer_id, assignment_id,
-- confidential_comments_to_editor.
create or replace view public.author_review_feedback as
select
  sub.submission_id,
  sub.round,
  sub.originality_score,
  sub.methodology_score,
  sub.clarity_score,
  sub.significance_score,
  sub.relevance_score,
  sub.recommendation,
  sub.comments_to_author,
  -- Anonymous label per submission+round, ordered deterministically by assignment id
  'Reviewer ' || row_number() over (
    partition by sub.submission_id, sub.round
    order by sub.assignment_id
  )                                               as reviewer_label
from (
  select
    s.id           as submission_id,
    ra.round,
    ra.id          as assignment_id,   -- used for ordering; not exposed in outer SELECT
    r.originality_score,
    r.methodology_score,
    r.clarity_score,
    r.significance_score,
    r.relevance_score,
    r.recommendation,
    r.comments_to_author
  from public.reviews                    r
  join public.reviewer_assignments       ra on ra.id  = r.assignment_id
  join public.submissions                s  on s.id   = ra.submission_id
  where
    -- GATE 1: author's own submissions
    s.author_id    = (select auth.uid())
    -- GATE 2: finalised reviews only
    and r.submitted_at is not null
    -- GATE 3: only visible after the editor has made a decision
    and s.status   in ('revisions_requested', 'accepted', 'rejected', 'published')
) sub;

comment on view public.author_review_feedback is
  'Author portal: shows review feedback for the caller''s own submitted manuscripts '
  'after a decision has been made. '
  'SECURITY: runs as view owner (postgres, bypasses RLS). '
  'Three WHERE gates enforce access. '
  'reviewer_id, assignment_id, and confidential_comments_to_editor are intentionally excluded.';

-- ── published_articles ────────────────────────────────────────────────────────
-- SECURITY CONTRACT: runs as owner (postgres). Gate: both submission and issue
-- must have status = 'published'. No internal fields exposed.
create or replace view public.published_articles as
select
  s.id,
  s.manuscript_language,
  s.title,
  s.abstract,
  s.keywords,
  s.doi,
  s.published_at,
  s.issue_id,
  s.article_order,
  i.volume,
  i.number,
  i.year
from public.submissions s
join public.issues       i on i.id = s.issue_id
-- GATE: both submission and parent issue must be published
where s.status   = 'published'
  and i.status   = 'published';

comment on view public.published_articles is
  'Public article listing. Only articles and issues with status=published. '
  'SECURITY: runs as view owner (postgres, bypasses RLS). '
  'Gate: WHERE on both status fields. '
  'Internal fields (extraction_error, author_id, etc.) are excluded.';

-- ── published_article_authors ─────────────────────────────────────────────────
-- SECURITY CONTRACT: same gate as published_articles.
create or replace view public.published_article_authors as
select
  sa.submission_id,
  sa.position,
  sa.full_name,
  sa.email,
  sa.affiliation,
  sa.orcid,
  sa.is_corresponding
from public.submission_authors sa
join public.submissions        s  on s.id  = sa.submission_id
join public.issues             i  on i.id  = s.issue_id
-- GATE: same publication guard
where s.status = 'published'
  and i.status = 'published';

comment on view public.published_article_authors is
  'Author metadata for published articles. '
  'SECURITY: runs as view owner (postgres, bypasses RLS). '
  'Gate: WHERE on submission and issue status.';

-- ── published_issues ──────────────────────────────────────────────────────────
create or replace view public.published_issues as
select
  id,
  volume,
  number,
  year,
  title,
  published_at
from public.issues
-- GATE: published issues only
where status = 'published';

comment on view public.published_issues is
  'Public issue listing. Only issues with status=published. '
  'SECURITY: runs as view owner (postgres, bypasses RLS). '
  'Gate: WHERE status = published.';
