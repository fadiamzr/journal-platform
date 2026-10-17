-- =============================================================================
-- test_reviewer_access.sql
-- Tests (d) Reviewer double-blind access, (e) Review edit lock.
-- Plan: 11 assertions.
--
-- UUIDs:
--   uid_author   = 'd1000000-0000-0000-0000-000000000001'
--   uid_rev_a    = 'd2000000-0000-0000-0000-000000000001'  (Reviewer A)
--   uid_rev_b    = 'd3000000-0000-0000-0000-000000000001'  (Reviewer B)
--   uid_editor   = 'd4000000-0000-0000-0000-000000000001'
--   sub_id       = 'd5000000-0000-0000-0000-000000000001'
--   assign_a_id  = 'd6000000-0000-0000-0000-000000000001'  (invited)
--   assign_b_id  = 'd7000000-0000-0000-0000-000000000001'  (accepted)
--   review_b_id  = 'd8000000-0000-0000-0000-000000000001'  (submitted)
-- =============================================================================
begin;
select plan(11);

-- ── Setup ─────────────────────────────────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('d1000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'rev_author@test.local','{}','{}',now(),now(),now()),
  ('d2000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'rev_reviewer_a@test.local','{}','{}',now(),now(),now()),
  ('d3000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'rev_reviewer_b@test.local','{}','{}',now(),now(),now()),
  ('d4000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'rev_editor@test.local','{}','{}',now(),now(),now());

-- Set reviewer and editor roles (admin function call as postgres)
update public.user_profiles set role = 'reviewer' where id = 'd2000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'reviewer' where id = 'd3000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'editor'   where id = 'd4000000-0000-0000-0000-000000000001';

-- Submission
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('d5000000-0000-0000-0000-000000000001',
   'd1000000-0000-0000-0000-000000000001',
   'in_review', 'en', '{"en": "Reviewer Test Paper"}'::jsonb);

-- Submission version with both paths
insert into public.submission_versions
  (submission_id, round, manuscript_path, anonymized_path, uploaded_by)
values
  ('d5000000-0000-0000-0000-000000000001', 1,
   'd1000000-0000-0000-0000-000000000001/d5000000-0000-0000-0000-000000000001/v1.pdf',
   'd5000000-0000-0000-0000-000000000001/v1.pdf',
   'd1000000-0000-0000-0000-000000000001');

-- Assignment A: still invited (anonymized_path should be null in view)
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('d6000000-0000-0000-0000-000000000001',
   'd5000000-0000-0000-0000-000000000001', 1,
   'd2000000-0000-0000-0000-000000000001', 'invited',
   'd4000000-0000-0000-0000-000000000001');

-- Assignment B: accepted (anonymized_path should be visible)
insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('d7000000-0000-0000-0000-000000000001',
   'd5000000-0000-0000-0000-000000000001', 1,
   'd3000000-0000-0000-0000-000000000001', 'accepted',
   'd4000000-0000-0000-0000-000000000001');

-- Review by Reviewer B: already submitted
insert into public.reviews
  (id, assignment_id, originality_score, methodology_score, clarity_score,
   significance_score, relevance_score, recommendation,
   comments_to_author, confidential_comments_to_editor, submitted_at)
values
  ('d8000000-0000-0000-0000-000000000001',
   'd7000000-0000-0000-0000-000000000001',
   4, 4, 5, 3, 4, 'accept', 'Great paper.', 'Confidential: recommend fast-track.',
   now());

-- Helper to test row count of an update under current RLS
create or replace function pg_temp.try_review_update()
returns integer language plpgsql as $$
declare
  updated_count integer;
begin
  update public.reviews
     set comments_to_author = 'Tampered'
   where id = 'd8000000-0000-0000-0000-000000000001';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- ── Test as Reviewer A (invited assignment) ───────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (d-1) Reviewer A sees own assignment in reviewer_submissions
select is(
  (select count(*)::int from public.reviewer_submissions
   where assignment_id = 'd6000000-0000-0000-0000-000000000001'),
  1,
  'd: reviewer A sees own assignment in reviewer_submissions view'
);

-- (d-2) reviewer_submissions does not expose author_id column
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'reviewer_submissions'
      and column_name  = 'author_id'
  ),
  'd: reviewer_submissions view has no author_id column'
);

-- (d-3) reviewer_submissions does not expose manuscript_path column
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'reviewer_submissions'
      and column_name  = 'manuscript_path'
  ),
  'd: reviewer_submissions view has no manuscript_path column'
);

-- (d-4) Reviewer A sees 0 rows directly from submissions table
select is(
  (select count(*)::int from public.submissions),
  0,
  'd: reviewer A gets no rows from submissions base table'
);

-- (d-5) Reviewer A sees 0 rows from submission_authors
select is(
  (select count(*)::int from public.submission_authors),
  0,
  'd: reviewer A gets no rows from submission_authors base table'
);

-- (d-6) Reviewer A sees 0 rows from submission_versions
select is(
  (select count(*)::int from public.submission_versions),
  0,
  'd: reviewer A gets no rows from submission_versions base table'
);

-- (d-7) anonymized_path is null for invited assignment (Reviewer A)
select is(
  (select anonymized_path from public.reviewer_submissions
   where assignment_id = 'd6000000-0000-0000-0000-000000000001'),
  null::text,
  'd: anonymized_path is null for invited assignment'
);

-- ── Test as Reviewer B (accepted assignment) ──────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (d-8) anonymized_path is non-null for accepted assignment (Reviewer B)
select isnt(
  (select anonymized_path from public.reviewer_submissions
   where assignment_id = 'd7000000-0000-0000-0000-000000000001'),
  null::text,
  'd: anonymized_path is non-null for accepted assignment'
);

-- (e-1) Reviewer A cannot read Reviewer B's review from the reviews table
select set_config('request.jwt.claims',
  '{"sub":"d2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.reviews
   where id = 'd8000000-0000-0000-0000-000000000001'),
  0,
  'e: reviewer A cannot read reviewer B review'
);

-- (e-2) Reviewer B cannot update review after submitted_at is set
select set_config('request.jwt.claims',
  '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  pg_temp.try_review_update(),
  0,
  'e: reviewer B cannot update review after submitted_at is set (0 rows affected)'
);

reset role;

-- (e-3) Back as postgres: confirm the value is still the original (stored value unchanged)
select is(
  (select comments_to_author from public.reviews
   where id = 'd8000000-0000-0000-0000-000000000001'),
  'Great paper.',
  'e: reviewer B update after submitted_at left stored values unchanged'
);

select * from finish();
rollback;
