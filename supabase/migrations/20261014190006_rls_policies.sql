-- =============================================================================
-- 20261014190006_rls_policies.sql
-- Phase 2 — Database & RLS
--
-- Strategy: deny-by-default.
--   1. REVOKE ALL on all tables (and views) in schema public from anon, authenticated.
--   2. Enable RLS on every base table.
--   3. Re-grant only what each role needs.
--   4. Create explicit named RLS policies.
--
-- Column-level UPDATE grant on user_profiles prevents clients from changing
-- the `role` column directly.
--
-- Note on reviewer_assignments UPDATE:
--   Reviewers may update only the `status` column (invited→accepted|declined).
--   Because granting table-level UPDATE to `authenticated` would override the
--   column-level restriction, full table-level UPDATE is intentionally withheld
--   from client sessions. Editor/admin workflows that need to update other
--   columns on reviewer_assignments MUST use the service role (backend API).
-- =============================================================================

-- ── 0. Baseline revoke ────────────────────────────────────────────────────────
-- This also revokes grants on views created in migration 5; they are re-granted
-- at the bottom of this file.
revoke all on all tables in schema public from anon, authenticated;

-- ── 1. Enable RLS ─────────────────────────────────────────────────────────────
alter table public.user_profiles             enable row level security;
alter table public.issues                    enable row level security;
alter table public.submissions               enable row level security;
alter table public.submission_authors        enable row level security;
alter table public.submission_versions       enable row level security;
alter table public.reviewer_assignments      enable row level security;
alter table public.reviews                   enable row level security;
alter table public.submission_status_history enable row level security;

-- ── 2. user_profiles ──────────────────────────────────────────────────────────
-- Grants: SELECT to authenticated; column-level UPDATE (never role).
grant select on public.user_profiles to authenticated;
-- Column-level grant: clients may update these four columns on their own row only.
-- The `role` column is intentionally excluded — use admin_set_user_role() instead.
grant update (full_name, affiliation, orcid, preferred_locale)
  on public.user_profiles to authenticated;

create policy "user_profiles: authenticated selects own row"
  on public.user_profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "user_profiles: editor or admin selects all"
  on public.user_profiles for select
  to authenticated
  using (private.is_editor_or_admin());

create policy "user_profiles: authenticated updates own non-role columns"
  on public.user_profiles for update
  to authenticated
  using    (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- Note: the column-level grant above ensures only the four allowed columns
-- can be changed; attempting to UPDATE role raises 42501.

-- ── 3. issues ─────────────────────────────────────────────────────────────────
grant select           on public.issues to anon, authenticated;
grant insert, update, delete on public.issues to authenticated;

create policy "issues: anon and authenticated select published"
  on public.issues for select
  to anon, authenticated
  using (status = 'published');

create policy "issues: editor or admin selects all"
  on public.issues for select
  to authenticated
  using (private.is_editor_or_admin());

create policy "issues: editor or admin inserts"
  on public.issues for insert
  to authenticated
  with check (private.is_editor_or_admin());

create policy "issues: editor or admin updates"
  on public.issues for update
  to authenticated
  using    (private.is_editor_or_admin())
  with check (private.is_editor_or_admin());

create policy "issues: editor or admin deletes"
  on public.issues for delete
  to authenticated
  using (private.is_editor_or_admin());

-- ── 4. submissions ────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.submissions to authenticated;

-- Author: select own
create policy "submissions: author selects own"
  on public.submissions for select
  to authenticated
  using (author_id = (select auth.uid()));

-- Author: insert as draft with own author_id only
create policy "submissions: author inserts own draft"
  on public.submissions for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'draft'
  );

-- Author: update own while status is editable (draft or revisions_requested)
-- The workflow_guards trigger enforces valid transitions.
create policy "submissions: author updates own editable"
  on public.submissions for update
  to authenticated
  using (
    author_id = (select auth.uid())
    and status in ('draft', 'revisions_requested')
  )
  with check (author_id = (select auth.uid()));

-- Author: delete own drafts only
create policy "submissions: author deletes own draft"
  on public.submissions for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    and status = 'draft'
  );

-- Editor/admin: full read + update on all submissions
create policy "submissions: editor or admin selects all"
  on public.submissions for select
  to authenticated
  using (private.is_editor_or_admin());

create policy "submissions: editor or admin updates all"
  on public.submissions for update
  to authenticated
  using    (private.is_editor_or_admin())
  with check (private.is_editor_or_admin());

-- Admin only: delete any submission
create policy "submissions: admin deletes any"
  on public.submissions for delete
  to authenticated
  using (private.is_admin());

-- ── 5. submission_authors ─────────────────────────────────────────────────────
grant select, insert, update, delete on public.submission_authors to authenticated;

-- Author: always may select own submission's authors
create policy "submission_authors: author selects own"
  on public.submission_authors for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_authors.submission_id
        and s.author_id = (select auth.uid())
    )
  );

-- Author: may insert while submission is editable
create policy "submission_authors: author inserts while editable"
  on public.submission_authors for insert
  to authenticated
  with check (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_authors.submission_id
        and s.author_id = (select auth.uid())
        and s.status in ('draft', 'revisions_requested')
    )
  );

-- Author: may update while submission is editable
create policy "submission_authors: author updates while editable"
  on public.submission_authors for update
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_authors.submission_id
        and s.author_id = (select auth.uid())
        and s.status in ('draft', 'revisions_requested')
    )
  );

-- Author: may delete while submission is editable
create policy "submission_authors: author deletes while editable"
  on public.submission_authors for delete
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_authors.submission_id
        and s.author_id = (select auth.uid())
        and s.status in ('draft', 'revisions_requested')
    )
  );

create policy "submission_authors: editor or admin all"
  on public.submission_authors for all
  to authenticated
  using    (private.is_editor_or_admin())
  with check (private.is_editor_or_admin());

-- ── 6. submission_versions ────────────────────────────────────────────────────
grant select, insert, update, delete on public.submission_versions to authenticated;

-- Author: always may select own submission's versions
create policy "submission_versions: author selects own"
  on public.submission_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_versions.submission_id
        and s.author_id = (select auth.uid())
    )
  );

-- Author: may write while submission is editable
create policy "submission_versions: author inserts while editable"
  on public.submission_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_versions.submission_id
        and s.author_id = (select auth.uid())
        and s.status in ('draft', 'revisions_requested')
    )
  );

create policy "submission_versions: author updates while editable"
  on public.submission_versions for update
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_versions.submission_id
        and s.author_id = (select auth.uid())
        and s.status in ('draft', 'revisions_requested')
    )
  );

create policy "submission_versions: author deletes while editable"
  on public.submission_versions for delete
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_versions.submission_id
        and s.author_id = (select auth.uid())
        and s.status in ('draft', 'revisions_requested')
    )
  );

create policy "submission_versions: editor or admin all"
  on public.submission_versions for all
  to authenticated
  using    (private.is_editor_or_admin())
  with check (private.is_editor_or_admin());

-- ── 7. reviewer_assignments ───────────────────────────────────────────────────
-- See module header for the UPDATE column-restriction rationale.
grant select on public.reviewer_assignments to authenticated;
-- Column-level UPDATE(status) only — prevents reviewers from changing other columns.
-- Table-level UPDATE intentionally withheld from `authenticated`.
grant update (status) on public.reviewer_assignments to authenticated;
-- Editors/admins need INSERT and DELETE from client; full UPDATE via service role.
grant insert, delete on public.reviewer_assignments to authenticated;

-- Reviewer: select own assignments
create policy "reviewer_assignments: reviewer selects own"
  on public.reviewer_assignments for select
  to authenticated
  using (reviewer_id = (select auth.uid()));

-- Reviewer: update own status from invited → accepted | declined only
create policy "reviewer_assignments: reviewer updates own status"
  on public.reviewer_assignments for update
  to authenticated
  using (
    reviewer_id = (select auth.uid())
    and status  = 'invited'
  )
  with check (
    reviewer_id = (select auth.uid())
    and status in ('accepted', 'declined')
  );

-- Editor/admin: full access
create policy "reviewer_assignments: editor or admin all"
  on public.reviewer_assignments for all
  to authenticated
  using    (private.is_editor_or_admin())
  with check (private.is_editor_or_admin());

-- ── 8. reviews ────────────────────────────────────────────────────────────────
grant select, insert, update on public.reviews to authenticated;
grant delete                  on public.reviews to authenticated;

-- Reviewer: select own review (via own assignment)
create policy "reviews: reviewer selects own"
  on public.reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.reviewer_assignments ra
      where ra.id          = reviews.assignment_id
        and ra.reviewer_id = (select auth.uid())
    )
  );

-- Reviewer: insert own review — assignment must be accepted
create policy "reviews: reviewer inserts via accepted assignment"
  on public.reviews for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reviewer_assignments ra
      where ra.id          = reviews.assignment_id
        and ra.reviewer_id = (select auth.uid())
        and ra.status      = 'accepted'
    )
  );

-- Reviewer: update own review — only before it is submitted (submitted_at is null)
create policy "reviews: reviewer updates before submission"
  on public.reviews for update
  to authenticated
  using (
    submitted_at is null
    and exists (
      select 1 from public.reviewer_assignments ra
      where ra.id          = reviews.assignment_id
        and ra.reviewer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reviewer_assignments ra
      where ra.id          = reviews.assignment_id
        and ra.reviewer_id = (select auth.uid())
    )
  );

-- Editor/admin: select all (including confidential comments)
create policy "reviews: editor or admin selects all"
  on public.reviews for select
  to authenticated
  using (private.is_editor_or_admin());

-- Admin: delete any review
create policy "reviews: admin deletes"
  on public.reviews for delete
  to authenticated
  using (private.is_admin());

-- ── 9. submission_status_history ──────────────────────────────────────────────
-- No INSERT/UPDATE/DELETE for clients. The record_status_change() trigger
-- (SECURITY DEFINER) is the only writer.
grant select on public.submission_status_history to authenticated;

create policy "status_history: author selects own"
  on public.submission_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id        = submission_status_history.submission_id
        and s.author_id = (select auth.uid())
    )
  );

create policy "status_history: editor or admin selects all"
  on public.submission_status_history for select
  to authenticated
  using (private.is_editor_or_admin());

-- ── 10. View grants ────────────────────────────────────────────────────────────
-- Public views — readable by anon and authenticated (e.g., the journal website)
grant select on public.published_articles        to anon, authenticated;
grant select on public.published_article_authors to anon, authenticated;
grant select on public.published_issues          to anon, authenticated;

-- Role-specific views — authenticated only; internal WHERE clauses enforce access
grant select on public.reviewer_submissions      to authenticated;
grant select on public.author_review_feedback    to authenticated;
