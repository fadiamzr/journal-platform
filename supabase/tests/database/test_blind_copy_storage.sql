-- =============================================================================
-- test_blind_copy_storage.sql
-- Tests for private.reviewer_can_read_blind_copy() and manuscripts-anonymized storage policy.
--
-- Plan: 14 assertions.
--
-- UUIDs:
--   uid_author      = 'f1000000-0000-0000-0000-000000000001'
--   uid_rev_1       = 'f2000000-0000-0000-0000-000000000001' (assigned: accepted)
--   uid_rev_2       = 'f3000000-0000-0000-0000-000000000001' (assigned: invited only)
--   uid_rev_3       = 'f4000000-0000-0000-0000-000000000001' (unassigned / different)
--   uid_editor      = 'f5000000-0000-0000-0000-000000000001'
--   sub_verified    = 'f6000000-0000-0000-0000-000000000001'
--   sub_unverified  = 'f7000000-0000-0000-0000-000000000001'
--   assign_acc      = 'f8000000-0000-0000-0000-000000000001' (rev1, sub1: accepted)
--   assign_inv      = 'f9000000-0000-0000-0000-000000000001' (rev2, sub1: invited)
--   assign_unver    = 'fa000000-0000-0000-0000-000000000001' (rev1, sub2: accepted)
--   obj_verified    = 'fb000000-0000-0000-0000-000000000001'
--   obj_unverified  = 'fc000000-0000-0000-0000-000000000001'
-- =============================================================================
begin;
select plan(14);

-- ── 1. Setup Auth Users & Profiles ───────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('f1000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage_author@test.local', '{}', '{}', now(), now(), now()),
  ('f2000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage_rev1@test.local', '{}', '{}', now(), now(), now()),
  ('f3000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage_rev2@test.local', '{}', '{}', now(), now(), now()),
  ('f4000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage_rev3@test.local', '{}', '{}', now(), now(), now()),
  ('f5000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage_editor@test.local', '{}', '{}', now(), now(), now());

update public.user_profiles set role = 'reviewer' where id = 'f2000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'reviewer' where id = 'f3000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'reviewer' where id = 'f4000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'editor'   where id = 'f5000000-0000-0000-0000-000000000001';

-- ── 2. Setup Submissions & Versions ──────────────────────────────────────────
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('f6000000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000001',
   'in_review', 'en', '{"en": "Verified Paper"}'::jsonb),
  ('f7000000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000001',
   'in_review', 'en', '{"en": "Unverified Paper"}'::jsonb);

-- Version with verified blind copy
insert into public.submission_versions
  (submission_id, round, manuscript_path, anonymized_path, uploaded_by, anonymized_verified_at, anonymized_verified_by)
values
  ('f6000000-0000-0000-0000-000000000001', 1,
   'f1000000-0000-0000-0000-000000000001/f6000000-0000-0000-0000-000000000001/v1.pdf',
   'f6000000-0000-0000-0000-000000000001/v1.pdf',
   'f1000000-0000-0000-0000-000000000001',
   now(), 'f5000000-0000-0000-0000-000000000001');

-- Version with unverified blind copy (anonymized_verified_at is null)
insert into public.submission_versions
  (submission_id, round, manuscript_path, anonymized_path, uploaded_by, anonymized_verified_at)
values
  ('f7000000-0000-0000-0000-000000000001', 1,
   'f1000000-0000-0000-0000-000000000001/f7000000-0000-0000-0000-000000000001/v1.pdf',
   'f7000000-0000-0000-0000-000000000001/v1.pdf',
   'f1000000-0000-0000-0000-000000000001',
   null);

-- ── 3. Setup Reviewer Assignments ─────────────────────────────────────────────
-- rev1 accepted on sub1 (verified)
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('f8000000-0000-0000-0000-000000000001',
   'f6000000-0000-0000-0000-000000000001', 1,
   'f2000000-0000-0000-0000-000000000001', 'accepted',
   'f5000000-0000-0000-0000-000000000001');

-- rev2 invited only on sub1
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('f9000000-0000-0000-0000-000000000001',
   'f6000000-0000-0000-0000-000000000001', 1,
   'f3000000-0000-0000-0000-000000000001', 'invited',
   'f5000000-0000-0000-0000-000000000001');

-- rev1 accepted on sub2 (unverified)
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('fa000000-0000-0000-0000-000000000001',
   'f7000000-0000-0000-0000-000000000001', 1,
   'f2000000-0000-0000-0000-000000000001', 'accepted',
   'f5000000-0000-0000-0000-000000000001');

-- ── 4. Setup Storage Objects (as postgres / service role) ──────────────────────
insert into storage.objects
  (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values
  ('fb000000-0000-0000-0000-000000000001',
   'manuscripts-anonymized',
   'f6000000-0000-0000-0000-000000000001/v1.pdf',
   null, now(), now(), now(), '{}'),
  ('fc000000-0000-0000-0000-000000000001',
   'manuscripts-anonymized',
   'f7000000-0000-0000-0000-000000000001/v1.pdf',
   null, now(), now(), now(), '{}');

-- ── (1) Function Security Definition & Search Path ────────────────────────────
select is(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'reviewer_can_read_blind_copy'),
  true,
  '1: reviewer_can_read_blind_copy is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'reviewer_can_read_blind_copy'
      and (
        'search_path=' = any(p.proconfig)
        or 'search_path=""' = any(p.proconfig)
        or array_to_string(p.proconfig, ',') ~ 'search_path=(""|)?'
      )
  ),
  '2: reviewer_can_read_blind_copy has empty search_path in proconfig'
);

-- ── (2) Anon Role Privilege Check ─────────────────────────────────────────────
set local role anon;
select throws_ok(
  $sql$select private.reviewer_can_read_blind_copy('f6000000-0000-0000-0000-000000000001/v1.pdf')$sql$,
  '42501',
  null,
  '3: anon has no execute privilege on private.reviewer_can_read_blind_copy'
);
reset role;

-- ── (3) Reviewer 1 (Accepted Assignment on Sub 1) ─────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Helper returns true for accepted assignment with verified blind copy
select is(
  private.reviewer_can_read_blind_copy('f6000000-0000-0000-0000-000000000001/v1.pdf'),
  true,
  '4: reviewer_can_read_blind_copy returns true for accepted assignment with verified blind copy'
);

-- Helper returns false when blind copy is unverified
select is(
  private.reviewer_can_read_blind_copy('f7000000-0000-0000-0000-000000000001/v1.pdf'),
  false,
  '5: reviewer_can_read_blind_copy returns false when blind copy is unverified'
);

-- Helper returns false for non-matching object name
select is(
  private.reviewer_can_read_blind_copy('f6000000-0000-0000-0000-000000000001/nonexistent.pdf'),
  false,
  '6: reviewer_can_read_blind_copy returns false for non-matching object name'
);

-- Reviewer still CANNOT select from submission_versions directly
select is(
  (select count(*)::int from public.submission_versions
   where submission_id = 'f6000000-0000-0000-0000-000000000001'),
  0,
  '7: reviewer still cannot SELECT from submission_versions directly (RLS active)'
);

-- Storage policy on manuscripts-anonymized allows reading verified blind copy
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'f6000000-0000-0000-0000-000000000001/v1.pdf'),
  1,
  '8: storage policy allows reviewer to select verified blind copy'
);

-- Storage policy on manuscripts-anonymized denies unverified blind copy
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'f7000000-0000-0000-0000-000000000001/v1.pdf'),
  0,
  '9: storage policy denies reviewer unverified blind copy'
);

-- ── (4) Reviewer 2 (Invited Only on Sub 1) ────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Helper returns false when assignment status is 'invited'
select is(
  private.reviewer_can_read_blind_copy('f6000000-0000-0000-0000-000000000001/v1.pdf'),
  false,
  '10: reviewer_can_read_blind_copy returns false when assignment is only invited'
);

-- Storage policy denies invited reviewer
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'f6000000-0000-0000-0000-000000000001/v1.pdf'),
  0,
  '11: storage policy denies invited reviewer access to blind copy'
);

-- ── (5) Reviewer 3 (Unassigned / Different Reviewer) ──────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Helper returns false for different reviewer without assignment
select is(
  private.reviewer_can_read_blind_copy('f6000000-0000-0000-0000-000000000001/v1.pdf'),
  false,
  '12: reviewer_can_read_blind_copy returns false for different reviewer without assignment'
);

-- Storage policy denies different reviewer
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'f6000000-0000-0000-0000-000000000001/v1.pdf'),
  0,
  '13: storage policy denies different reviewer access to blind copy'
);

-- ── (6) Completed Assignment Status ───────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);

update public.reviewer_assignments
   set status = 'completed'
 where id = 'f8000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  private.reviewer_can_read_blind_copy('f6000000-0000-0000-0000-000000000001/v1.pdf'),
  true,
  '14: reviewer_can_read_blind_copy returns true for completed assignment'
);

reset role;
select * from finish();
rollback;

