-- =============================================================================
-- 20261031190000_fix_blind_copy_storage_policy.sql
-- Fix blind-copy storage policy for reviewers
--
-- Problem:
--   The storage policy "manuscripts-anonymized: reviewer reads assigned" previously
--   performed an inline subquery joining public.reviewer_assignments and
--   public.submission_versions. Because RLS policies execute under the caller's
--   permissions, and reviewers intentionally have NO SELECT access to
--   public.submission_versions (to preserve double-blind review), the subquery
--   returned 0 rows and denied reviewers access to verified blind copies.
--
-- Solution:
--   1. Create private.reviewer_can_read_blind_copy(object_name text):
--      SECURITY DEFINER helper that checks assignment status and blind copy
--      verification on public.submission_versions without exposing the table
--      directly to reviewers.
--   2. Drop and recreate the storage policy on storage.objects using this helper.
-- =============================================================================

-- ── 1. Create SECURITY DEFINER helper in private schema ───────────────────────
create or replace function private.reviewer_can_read_blind_copy(object_name text)
  returns boolean
  language sql
  security definer
  stable
  set search_path = ''
as $$
  select exists (
    select 1
    from public.reviewer_assignments a
    join public.submission_versions v
      on v.submission_id = a.submission_id
     and v.round         = a.round
    where a.reviewer_id = (select auth.uid())
      and a.status in ('accepted', 'completed')
      and v.anonymized_path = object_name
      and v.anonymized_verified_at is not null
  );
$$;

comment on function private.reviewer_can_read_blind_copy(text) is
  'Evaluates whether the authenticated reviewer has an accepted or completed '
  'assignment for a submission version whose verified blind copy matches object_name. '
  'SECURITY DEFINER bypasses RLS on submission_versions without granting reviewers direct SELECT.';

revoke execute on function private.reviewer_can_read_blind_copy(text) from public;
revoke execute on function private.reviewer_can_read_blind_copy(text) from anon;
grant execute on function private.reviewer_can_read_blind_copy(text) to authenticated;
grant usage on schema private to authenticated;

-- ── 2. Recreate storage policy on storage.objects ─────────────────────────────
drop policy if exists "manuscripts-anonymized: reviewer reads assigned" on storage.objects;

create policy "manuscripts-anonymized: reviewer reads assigned"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'manuscripts-anonymized'
    and private.reviewer_can_read_blind_copy(name)
  );

