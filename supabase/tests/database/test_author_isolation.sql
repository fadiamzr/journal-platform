-- =============================================================================
-- test_author_isolation.sql
-- Tests (b) Author isolation, (c) Role immutability, (i) Status transitions.
-- Plan: 12 assertions.
--
-- Setup (running as postgres / superuser — no JWT, no RLS):
--   uid_a = 'a0000000-0000-0000-0000-000000000001'  (Author A)
--   uid_b = 'b0000000-0000-0000-0000-000000000001'  (Author B)
--   uid_c = 'c0000000-0000-0000-0000-000000000001'  (Author C — for role-test)
--   sub_a = 'aa000000-0000-0000-0000-000000000001'
--   sub_b = 'bb000000-0000-0000-0000-000000000001'
--   sub_t = 'e0000000-0000-0000-0000-000000000001'  (for transition tests)
-- =============================================================================
begin;
select plan(12);

-- ── Setup ─────────────────────────────────────────────────────────────────────
-- Insert auth users (postgres role, bypasses all RLS + triggers on auth.users).
-- The handle_new_user trigger on auth.users will create user_profiles automatically.
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'author_a@test.local', '{}', '{}', now(), now(), now()),
  ('b0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'author_b@test.local', '{}', '{}', now(), now(), now()),
  -- Author C: try to sign up with role=admin in metadata (must be ignored)
  ('c0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'author_c@test.local', '{}',
   '{"role": "admin"}'::jsonb, now(), now(), now());

-- Create submissions as postgres (bypasses RLS)
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('aa000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'draft', 'en',
   '{"en": "Author A Paper"}'::jsonb),
  ('bb000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'draft', 'en',
   '{"en": "Author B Paper"}'::jsonb);

-- submission_authors for sub_a
insert into public.submission_authors
  (submission_id, position, full_name)
values
  ('aa000000-0000-0000-0000-000000000001', 1, 'Alice Author');

-- submission_versions for sub_a
insert into public.submission_versions
  (submission_id, round, manuscript_path, uploaded_by)
values
  ('aa000000-0000-0000-0000-000000000001', 1,
   'a0000000-0000-0000-0000-000000000001/aa000000-0000-0000-0000-000000000001/v1.pdf',
   'a0000000-0000-0000-0000-000000000001');

-- Submission for transition tests: walk it to revisions_requested as service role
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('e0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'draft', 'en',
   '{"en": "Transition Test Paper"}'::jsonb);

-- Valid walk: draft→submitted→in_review→revisions_requested (all as service role)
update public.submissions set status = 'submitted'           where id = 'e0000000-0000-0000-0000-000000000001';
update public.submissions set status = 'in_review'           where id = 'e0000000-0000-0000-0000-000000000001';
update public.submissions set status = 'revisions_requested' where id = 'e0000000-0000-0000-0000-000000000001';

-- ── Become Author A ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (b-1) Author A can see own submission
select is(
  (select count(*)::int from public.submissions
   where id = 'aa000000-0000-0000-0000-000000000001'),
  1,
  'b: author A sees own submission'
);

-- (b-2) Author A cannot see Author B's submission
select is(
  (select count(*)::int from public.submissions
   where id = 'bb000000-0000-0000-0000-000000000001'),
  0,
  'b: author A cannot see author B submission'
);

-- (b-3) Author A cannot see Author B's submission_authors (they come from sub_b)
select is(
  (select count(*)::int from public.submission_authors
   where submission_id = 'bb000000-0000-0000-0000-000000000001'),
  0,
  'b: author A cannot see author B submission_authors'
);

-- (b-4) Author A cannot see Author B's submission_versions
select is(
  (select count(*)::int from public.submission_versions
   where submission_id = 'bb000000-0000-0000-0000-000000000001'),
  0,
  'b: author A cannot see author B submission_versions'
);

-- (b-5) Author A cannot see Author B's status history
select is(
  (select count(*)::int from public.submission_status_history
   where submission_id = 'bb000000-0000-0000-0000-000000000001'),
  0,
  'b: author A cannot see author B status history'
);

-- (b-6) Author A cannot insert a submission with another author_id
select throws_ok(
  $sql$
    insert into public.submissions
      (id, author_id, status, manuscript_language, title)
    values
      ('ff000000-0000-0000-0000-000000000001',
       'b0000000-0000-0000-0000-000000000001',
       'draft', 'en', '{"en":"Fake"}'::jsonb)
  $sql$,
  '42501',
  null,
  'b: author A cannot insert submission with another author_id'
);

-- (b-7) Author A cannot insert a submission with a non-draft status
select throws_ok(
  $sql$
    insert into public.submissions
      (id, author_id, status, manuscript_language, title)
    values
      ('ff000000-0000-0000-0000-000000000002',
       'a0000000-0000-0000-0000-000000000001',
       'in_review', 'en', '{"en":"Hack"}'::jsonb)
  $sql$,
  '42501',
  null,
  'b: author A cannot insert submission with status != draft'
);

-- (c-1) Author A cannot update own role
select throws_ok(
  $sql$
    update public.user_profiles
       set role = 'admin'
     where id = 'a0000000-0000-0000-0000-000000000001'
  $sql$,
  '42501',
  null,
  'c: authenticated user cannot update own role column'
);

-- (i-1) Author A cannot perform draft→accepted (invalid transition)
select throws_ok(
  $sql$
    update public.submissions
       set status = 'accepted'
     where id = 'aa000000-0000-0000-0000-000000000001'
  $sql$,
  '23514',
  null,
  'c: author cannot do draft→accepted transition'
);

-- (i-2) revisions_requested→submitted increments current_round
-- (sub_t is already in revisions_requested, current_round = 1)
select lives_ok(
  $sql$
    update public.submissions
       set status = 'submitted'
     where id = 'e0000000-0000-0000-0000-000000000001'
  $sql$,
  'i: author can resubmit from revisions_requested'
);

-- Back to postgres to inspect the result
reset role;

-- (i-3) Check that current_round was incremented to 2
select is(
  (select current_round from public.submissions
   where id = 'e0000000-0000-0000-0000-000000000001'),
  2,
  'i: revisions_requested→submitted increments current_round to 2'
);

-- (c-2) Signup trigger: Author C's profile must have role='author' despite metadata
select is(
  (select role::text from public.user_profiles
   where id = 'c0000000-0000-0000-0000-000000000001'),
  'author',
  'c: signup trigger ignores role in raw_user_meta_data, always creates author'
);

select * from finish();
rollback;
