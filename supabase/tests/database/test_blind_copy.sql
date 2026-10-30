-- =============================================================================
-- test_blind_copy.sql
-- Stage 1A — pgTAP tests for blind copy verification, storage policies, and triggers
-- =============================================================================
begin;
select plan(18);

-- ── 1. Setup users ────────────────────────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('c1000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'author_stage1a@test.local','{}','{}',now(),now(),now()),
  ('c2000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'other_stage1a@test.local','{}','{}',now(),now(),now()),
  ('c3000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'editor_stage1a@test.local','{}','{}',now(),now(),now()),
  ('c4000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'reviewer_stage1a@test.local','{}','{}',now(),now(),now());

-- Set platform roles
update public.user_profiles set role = 'author'   where id = 'c1000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'author'   where id = 'c2000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'editor'   where id = 'c3000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'reviewer' where id = 'c4000000-0000-0000-0000-000000000001';

-- Setup submission
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('c5000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'draft', 'en', '{"en": "Blind Copy Test Article"}'::jsonb);

-- ── 2. Author version insertion rules ─────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (1) author cannot set anonymized_verified_at on insert (42501)
select throws_ok(
  $sql$
  insert into public.submission_versions
    (submission_id, round, manuscript_path, anonymized_verified_at, uploaded_by)
  values
    ('c5000000-0000-0000-0000-000000000001', 1,
     'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
     now(), 'c1000000-0000-0000-0000-000000000001')
  $sql$,
  '42501',
  null,
  'author cannot set anonymized_verified_at on insert'
);

-- (2) author cannot set anonymized_path on insert (42501)
select throws_ok(
  $sql$
  insert into public.submission_versions
    (submission_id, round, manuscript_path, anonymized_path, uploaded_by)
  values
    ('c5000000-0000-0000-0000-000000000001', 1,
     'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
     'c5000000-0000-0000-0000-000000000001/v1.pdf', 'c1000000-0000-0000-0000-000000000001')
  $sql$,
  '42501',
  null,
  'author cannot set anonymized_path on insert'
);

-- (3) author cannot set anonymized_verified_by on insert (42501)
select throws_ok(
  $sql$
  insert into public.submission_versions
    (submission_id, round, manuscript_path, anonymized_verified_by, uploaded_by)
  values
    ('c5000000-0000-0000-0000-000000000001', 1,
     'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
     'c3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001')
  $sql$,
  '42501',
  null,
  'author cannot set anonymized_verified_by on insert'
);

-- (4) author cannot set anonymized_review_note on insert (42501)
select throws_ok(
  $sql$
  insert into public.submission_versions
    (submission_id, round, manuscript_path, anonymized_review_note, uploaded_by)
  values
    ('c5000000-0000-0000-0000-000000000001', 1,
     'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
     'Please revise', 'c1000000-0000-0000-0000-000000000001')
  $sql$,
  '42501',
  null,
  'author cannot set anonymized_review_note on insert'
);

-- (5) author cannot insert with another user folder in manuscript_path (42501)
select throws_ok(
  $sql$
  insert into public.submission_versions
    (submission_id, round, manuscript_path, uploaded_by)
  values
    ('c5000000-0000-0000-0000-000000000001', 1,
     'c2000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
     'c1000000-0000-0000-0000-000000000001')
  $sql$,
  '42501',
  null,
  'author cannot insert a version with another user folder in manuscript_path'
);

-- (6) author CAN insert a version with a correct own-folder manuscript_path
select lives_ok(
  $sql$
  insert into public.submission_versions
    (submission_id, round, manuscript_path, file_size_bytes, uploaded_by)
  values
    ('c5000000-0000-0000-0000-000000000001', 1,
     'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
     1024, 'c1000000-0000-0000-0000-000000000001')
  $sql$,
  'author can insert a version with correct own-folder manuscript_path'
);

-- (7) author cannot update anonymized_verified_at (42501)
select throws_ok(
  $sql$
  update public.submission_versions
  set anonymized_verified_at = now()
  where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1
  $sql$,
  '42501',
  null,
  'author cannot update anonymized_verified_at'
);

-- (8) author cannot update anonymized_path (42501)
select throws_ok(
  $sql$
  update public.submission_versions
  set anonymized_path = 'c5000000-0000-0000-0000-000000000001/v1.pdf'
  where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1
  $sql$,
  '42501',
  null,
  'author cannot update anonymized_path'
);

-- (9) author cannot update anonymized_review_note (42501)
select throws_ok(
  $sql$
  update public.submission_versions
  set anonymized_review_note = 'unauthorized note'
  where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1
  $sql$,
  '42501',
  null,
  'author cannot update anonymized_review_note'
);

-- (10) author CAN update version with valid manuscript_path (e.g. updating file size)
select lives_ok(
  $sql$
  update public.submission_versions
  set file_size_bytes = 2048
  where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1
  $sql$,
  'author can update version with own manuscript_path intact'
);

-- ── 3. Secret-key and editor privileged operations ────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);

-- (11) secret-key context (no auth.uid()) can set anonymized_path
select lives_ok(
  $sql$
  update public.submission_versions
  set anonymized_path = 'c5000000-0000-0000-0000-000000000001/v1.pdf'
  where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1
  $sql$,
  'secret-key context can set anonymized_path'
);

-- (12) editor can set verification fields
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $sql$
  update public.submission_versions
  set anonymized_verified_at = now(),
      anonymized_verified_by = 'c3000000-0000-0000-0000-000000000001'
  where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1
  $sql$,
  'editor can set verification fields'
);

-- (13) changing anonymized_path resets verification
reset role;
select set_config('request.jwt.claims', '', true);

update public.submission_versions
set anonymized_path = 'c5000000-0000-0000-0000-000000000001/v1_new.pdf'
where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1;

select is(
  (select anonymized_verified_at from public.submission_versions
   where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1),
  null::timestamptz,
  'changing anonymized_path resets anonymized_verified_at to null'
);

-- ── 4. Reviewer view and storage policy checks ────────────────────────────────
-- Setup reviewer assignment and storage objects
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('c6000000-0000-0000-0000-000000000001',
   'c5000000-0000-0000-0000-000000000001', 1,
   'c4000000-0000-0000-0000-000000000001', 'accepted',
   'c3000000-0000-0000-0000-000000000001');

insert into storage.objects
  (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values
  ('c7000000-0000-0000-0000-000000000001',
   'manuscripts-anonymized',
   'c5000000-0000-0000-0000-000000000001/v1_new.pdf',
   null, now(), now(), now(), '{}'),
  ('c8000000-0000-0000-0000-000000000001',
   'manuscripts',
   'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf',
   'c1000000-0000-0000-0000-000000000001', now(), now(), now(), '{}');

-- Switch to reviewer while blind copy is unverified
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (14) reviewer_submissions shows anonymized_path NULL for accepted assignment when unverified
select is(
  (select anonymized_path from public.reviewer_submissions
   where assignment_id = 'c6000000-0000-0000-0000-000000000001'),
  null::text,
  'reviewer_submissions shows anonymized_path NULL for unverified blind copy'
);

-- (15) reviewer storage policy denies unverified blind copy
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'c5000000-0000-0000-0000-000000000001/v1_new.pdf'),
  0,
  'reviewer cannot select unverified blind copy from manuscripts-anonymized bucket'
);

-- Switch to editor and verify the blind copy
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

update public.submission_versions
set anonymized_verified_at = now(),
    anonymized_verified_by = 'c3000000-0000-0000-0000-000000000001'
where submission_id = 'c5000000-0000-0000-0000-000000000001' and round = 1;

-- Switch back to reviewer once verified
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (16) reviewer_submissions shows anonymized_path non-null once verified
select is(
  (select anonymized_path from public.reviewer_submissions
   where assignment_id = 'c6000000-0000-0000-0000-000000000001'),
  'c5000000-0000-0000-0000-000000000001/v1_new.pdf',
  'reviewer_submissions shows anonymized_path once blind copy is verified'
);

-- (17) reviewer storage policy allows verified blind copy
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'c5000000-0000-0000-0000-000000000001/v1_new.pdf'),
  1,
  'reviewer can select verified blind copy from manuscripts-anonymized bucket'
);

-- (18) reviewer still cannot read manuscripts bucket of author
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts'
     and name = 'c1000000-0000-0000-0000-000000000001/c5000000-0000-0000-0000-000000000001/v1.pdf'),
  0,
  'reviewer cannot read another user manuscripts bucket object'
);

reset role;
select * from finish();
rollback;
