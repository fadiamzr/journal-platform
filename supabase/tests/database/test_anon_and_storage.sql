-- =============================================================================
-- test_anon_and_storage.sql
-- Tests (h) Anonymous access, (j) Storage bucket policies.
-- Plan: 11 assertions.
--
-- UUIDs:
--   uid_author  = 'a1000000-0000-0000-0000-000000000001'
--   uid_rev     = 'a2000000-0000-0000-0000-000000000001'
--   uid_editor  = 'a3000000-0000-0000-0000-000000000001'
--   sub_id      = 'a4000000-0000-0000-0000-000000000001'
--   issue_id    = 'a5000000-0000-0000-0000-000000000001'
--   assign_id   = 'a6000000-0000-0000-0000-000000000001'  (accepted)
--   obj1_id     = 'b0000001-0000-0000-0000-000000000001'
--   obj2_id     = 'b0000002-0000-0000-0000-000000000001'
--   obj3_id     = 'b0000003-0000-0000-0000-000000000001'
-- =============================================================================
begin;
select plan(11);

-- ── Setup ─────────────────────────────────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'anon_author@test.local','{}','{}',now(),now(),now()),
  ('a2000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'anon_reviewer@test.local','{}','{}',now(),now(),now()),
  ('a3000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'anon_editor@test.local','{}','{}',now(),now(),now());

update public.user_profiles set role = 'reviewer' where id = 'a2000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'editor'   where id = 'a3000000-0000-0000-0000-000000000001';

-- Published issue
insert into public.issues
  (id, volume, number, year, title, status, published_at)
values
  ('a5000000-0000-0000-0000-000000000001',
   1, 1, 2026, '{"en":"Volume 1 Issue 1"}'::jsonb, 'published', now());

-- Published submission in that issue
insert into public.submissions
  (id, author_id, status, manuscript_language, title, issue_id, published_at, submitted_at)
values
  ('a4000000-0000-0000-0000-000000000001',
   'a1000000-0000-0000-0000-000000000001',
   'published', 'en', '{"en":"Published Article"}'::jsonb,
   'a5000000-0000-0000-0000-000000000001', now(), now());

insert into public.submission_authors
  (submission_id, position, full_name, is_corresponding)
values
  ('a4000000-0000-0000-0000-000000000001', 1, 'Harriet Author', true);

-- Reviewer assignment (accepted)
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('a6000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', 1,
   'a2000000-0000-0000-0000-000000000001', 'accepted',
   'a3000000-0000-0000-0000-000000000001');

-- Storage objects (inserted as postgres / service role)
-- Author's manuscript
insert into storage.objects
  (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values
  ('b0000001-0000-0000-0000-000000000001',
   'manuscripts',
   'a1000000-0000-0000-0000-000000000001/a4000000-0000-0000-0000-000000000001/v1.pdf',
   'a1000000-0000-0000-0000-000000000001',
   now(), now(), now(), '{}');

-- Another author's manuscript (different folder)
insert into storage.objects
  (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values
  ('b0000002-0000-0000-0000-000000000001',
   'manuscripts',
   'a2000000-0000-0000-0000-000000000001/other-sub/v1.pdf',
   'a2000000-0000-0000-0000-000000000001',
   now(), now(), now(), '{}');

-- Anonymised manuscript
insert into storage.objects
  (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
values
  ('b0000003-0000-0000-0000-000000000001',
   'manuscripts-anonymized',
   'a4000000-0000-0000-0000-000000000001/v1.pdf',
   null,
   now(), now(), now(), '{}');

-- ── Test (h): Anonymous ───────────────────────────────────────────────────────
set local role anon;

-- (h-1) Anon gets permission denied on user_profiles
select throws_ok(
  $sql$select count(*) from public.user_profiles$sql$,
  '42501',
  null,
  'h: anon gets permission denied on user_profiles'
);

-- (h-2) Anon gets permission denied on submissions
select throws_ok(
  $sql$select count(*) from public.submissions$sql$,
  '42501',
  null,
  'h: anon gets permission denied on submissions base table'
);

-- (h-3) Anon can read published_issues view
select is(
  (select count(*)::int from public.published_issues),
  1,
  'h: anon sees published_issues via public view'
);

-- (h-4) Anon can read published_articles view
select is(
  (select count(*)::int from public.published_articles),
  1,
  'h: anon sees published_articles via public view'
);

-- (h-5) Anon can read published_article_authors view
select is(
  (select count(*)::int from public.published_article_authors),
  1,
  'h: anon sees published_article_authors via public view'
);

reset role;

-- ── Test (j): Storage policies ────────────────────────────────────────────────

-- (j-1) Author sees own manuscript file
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts'
     and name like 'a1000000-0000-0000-0000-000000000001/%'),
  1,
  'j: author sees own manuscript file in manuscripts bucket'
);

-- (j-2) Author cannot see another user's manuscript file
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts'
     and name like 'a2000000-0000-0000-0000-000000000001/%'),
  0,
  'j: author cannot see another user manuscript file'
);

-- (j-3) Reviewer sees 0 manuscripts belonging to another user (author's file)
select set_config('request.jwt.claims',
  '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts'
     and name like 'a1000000-0000-0000-0000-000000000001/%'),
  0,
  'j: reviewer cannot see author manuscript file in manuscripts bucket'
);

-- (j-3b) Reviewer can read objects in own folder in manuscripts bucket (allowed by design)
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts'
     and name like 'a2000000-0000-0000-0000-000000000001/%'),
  1,
  'j: reviewer can read objects in own folder in manuscripts bucket'
);

-- (j-4) Reviewer can see anonymised manuscript for accepted assignment
select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'
     and name = 'a4000000-0000-0000-0000-000000000001/v1.pdf'),
  1,
  'j: reviewer can read anonymised manuscript for accepted assignment'
);

-- (j-5) Author cannot read manuscripts-anonymized bucket (no policy for them)
select set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from storage.objects
   where bucket_id = 'manuscripts-anonymized'),
  0,
  'j: author has no access to manuscripts-anonymized bucket'
);

reset role;

select * from finish();
rollback;
