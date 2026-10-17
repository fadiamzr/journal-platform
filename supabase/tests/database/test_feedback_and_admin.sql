-- =============================================================================
-- test_feedback_and_admin.sql
-- Tests (f) Author feedback isolation, (g) Editor/admin access.
-- Plan: 10 assertions.
--
-- UUIDs:
--   uid_author  = 'f1000000-0000-0000-0000-000000000001'
--   uid_rev     = 'f2000000-0000-0000-0000-000000000001'
--   uid_editor  = 'f3000000-0000-0000-0000-000000000001'
--   uid_admin   = 'f4000000-0000-0000-0000-000000000001'
--   uid_other   = 'f5000000-0000-0000-0000-000000000001'  (another author; non-admin)
--   sub_id      = 'f6000000-0000-0000-0000-000000000001'
--   assign_id   = 'f7000000-0000-0000-0000-000000000001'
--   review_id   = 'f8000000-0000-0000-0000-000000000001'
-- =============================================================================
begin;
select plan(10);

-- ── Setup ─────────────────────────────────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('f1000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'fb_author@test.local','{}','{}',now(),now(),now()),
  ('f2000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'fb_reviewer@test.local','{}','{}',now(),now(),now()),
  ('f3000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'fb_editor@test.local','{}','{}',now(),now(),now()),
  ('f4000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'fb_admin@test.local','{}','{}',now(),now(),now()),
  ('f5000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'fb_other@test.local','{}','{}',now(),now(),now());

update public.user_profiles set role = 'reviewer' where id = 'f2000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'editor'   where id = 'f3000000-0000-0000-0000-000000000001';
update public.user_profiles set role = 'admin'    where id = 'f4000000-0000-0000-0000-000000000001';

-- Submission in revisions_requested (author can view feedback)
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('f6000000-0000-0000-0000-000000000001',
   'f1000000-0000-0000-0000-000000000001',
   'revisions_requested', 'en', '{"en": "Feedback Test Paper"}'::jsonb);

insert into public.reviewer_assignments
  (id, submission_id, round, reviewer_id, status, invited_by)
values
  ('f7000000-0000-0000-0000-000000000001',
   'f6000000-0000-0000-0000-000000000001', 1,
   'f2000000-0000-0000-0000-000000000001', 'completed',
   'f3000000-0000-0000-0000-000000000001');

insert into public.reviews
  (id, assignment_id, originality_score, methodology_score, clarity_score,
   significance_score, relevance_score, recommendation,
   comments_to_author, confidential_comments_to_editor, submitted_at)
values
  ('f8000000-0000-0000-0000-000000000001',
   'f7000000-0000-0000-0000-000000000001',
   3, 3, 4, 4, 3, 'major_revisions',
   'Please expand section 3.', 'Quality is borderline; needs major work.',
   now());

-- Also create a second submission for editor visibility count
insert into public.submissions
  (id, author_id, status, manuscript_language, title)
values
  ('f9000000-0000-0000-0000-000000000001',
   'f5000000-0000-0000-0000-000000000001',
   'submitted', 'fr', '{"fr": "Deuxième soumission"}'::jsonb);

-- ── Test as Author ────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (f-1) Author sees own feedback in author_review_feedback
select is(
  (select count(*)::int from public.author_review_feedback
   where submission_id = 'f6000000-0000-0000-0000-000000000001'),
  1,
  'f: author sees own feedback in author_review_feedback view'
);

-- (f-2) author_review_feedback has no reviewer_id column
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'author_review_feedback'
      and column_name  = 'reviewer_id'
  ),
  'f: author_review_feedback view has no reviewer_id column'
);

-- (f-3) author_review_feedback has no assignment_id column
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'author_review_feedback'
      and column_name  = 'assignment_id'
  ),
  'f: author_review_feedback view has no assignment_id column'
);

-- (f-4) author_review_feedback has no confidential_comments_to_editor column
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'author_review_feedback'
      and column_name  = 'confidential_comments_to_editor'
  ),
  'f: author_review_feedback view has no confidential_comments_to_editor column'
);

-- (f-5) Author gets 0 rows from reviews table directly
select is(
  (select count(*)::int from public.reviews),
  0,
  'f: author gets 0 rows from reviews base table'
);

-- (f-6) Author gets 0 rows from reviewer_assignments directly
select is(
  (select count(*)::int from public.reviewer_assignments),
  0,
  'f: author gets 0 rows from reviewer_assignments base table'
);

-- ── Test as Editor ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"f3000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (g-1) Editor sees all submissions (2 inserted above)
select is(
  (select count(*)::int from public.submissions),
  2,
  'g: editor sees all submissions'
);

-- (g-2) Non-admin (editor) cannot call admin_set_user_role
select throws_ok(
  $sql$
    select public.admin_set_user_role(
      'f1000000-0000-0000-0000-000000000001'::uuid,
      'admin'::public.user_role
    )
  $sql$,
  '42501',
  'permission denied: caller is not an admin',
  'g: non-admin cannot call admin_set_user_role'
);

-- ── Test as Admin ─────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"f4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- (g-3) Admin sees all submissions
select is(
  (select count(*)::int from public.submissions),
  2,
  'g: admin sees all submissions'
);

-- (g-4) Admin can call admin_set_user_role
select lives_ok(
  $sql$
    select public.admin_set_user_role(
      'f5000000-0000-0000-0000-000000000001'::uuid,
      'reviewer'::public.user_role
    )
  $sql$,
  'g: admin can call admin_set_user_role successfully'
);

reset role;

select * from finish();
rollback;
