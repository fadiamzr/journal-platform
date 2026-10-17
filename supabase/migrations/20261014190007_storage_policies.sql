-- =============================================================================
-- 20261014190007_storage_policies.sql
-- Phase 2 — Database & RLS
--
-- Storage bucket policies on storage.objects.
-- Buckets `manuscripts` and `manuscripts-anonymized` are private.
-- Bucket `published` is public (public reads via CDN).
--
-- Path conventions:
--   manuscripts            → {author_id}/{submission_id}/v{round}.pdf
--   manuscripts-anonymized → {submission_id}/v{round}.pdf
--   published              → {submission_id}/v{final}.pdf
--
-- storage.foldername(name) returns text[] of path components excluding the
-- filename. Array indexes are 1-based in Postgres.
--   manuscripts path:   [1]=author_id  [2]=submission_id
--   anon path:          [1]=submission_id
--
-- Note: RLS on storage.objects is already enabled by Supabase Storage.
-- This migration only adds policies.
-- =============================================================================

-- ── manuscripts (private) ─────────────────────────────────────────────────────
-- Path: {author_id}/{submission_id}/v{round}.pdf
-- Authors manage their own folder. Editors/admins read any object.
-- Reviewers have NO access to this bucket.

-- Authors: full CRUD within own folder
create policy "manuscripts: author manages own folder"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'manuscripts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'manuscripts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Editors and admins: read-only on all objects in this bucket
create policy "manuscripts: editor or admin selects all"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'manuscripts'
    and private.is_editor_or_admin()
  );

-- ── manuscripts-anonymized (private) ──────────────────────────────────────────
-- Path: {submission_id}/v{round}.pdf
-- (storage.foldername(name))[1] = submission_id
--
-- WRITES: backend only (service role) — no INSERT/UPDATE/DELETE for client sessions.
-- Editors/admins: read-only on all objects.
-- Reviewers: read-only only for accepted or completed assignments of that submission.
--   Path comparison is done as TEXT; we never cast folder components to uuid to avoid
--   injection via crafted filenames.

-- Editors and admins: read all anonymised manuscripts
create policy "manuscripts-anonymized: editor or admin selects all"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'manuscripts-anonymized'
    and private.is_editor_or_admin()
  );

-- Reviewers: read only when they have an accepted or completed assignment for that submission
-- The folder index [1] is the submission_id for the path {submission_id}/v{round}.pdf.
create policy "manuscripts-anonymized: reviewer reads assigned"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'manuscripts-anonymized'
    and exists (
      select 1
      from public.reviewer_assignments a
      where a.reviewer_id = (select auth.uid())
        and a.status      in ('accepted', 'completed')
        -- Compare as text — never cast untrusted path components to uuid
        and a.submission_id::text = (storage.foldername(name))[1]
    )
  );

-- ── published (public bucket) ─────────────────────────────────────────────────
-- Public reads are handled by the bucket's public setting (no SELECT policy needed).
-- Writes: editor/admin only.

create policy "published: editor or admin inserts"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'published'
    and private.is_editor_or_admin()
  );

create policy "published: editor or admin updates"
  on storage.objects
  for update
  to authenticated
  using    (bucket_id = 'published' and private.is_editor_or_admin())
  with check (bucket_id = 'published' and private.is_editor_or_admin());

create policy "published: editor or admin deletes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'published'
    and private.is_editor_or_admin()
  );
