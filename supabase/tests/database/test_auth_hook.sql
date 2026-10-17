-- =============================================================================
-- test_auth_hook.sql
-- Tests Phase 3: custom_access_token_hook functionality, claims, security & privileges.
-- Plan: 13 assertions.
--
-- UUIDs:
--   uid_editor = 'e1000000-0000-0000-0000-000000000001'
--   uid_author = 'e2000000-0000-0000-0000-000000000001'
--   uid_noprof = 'e3000000-0000-0000-0000-000000000001'
-- =============================================================================
begin;
select plan(13);

-- ── Setup ─────────────────────────────────────────────────────────────────────
-- Create two auth users. trg_auth_users_on_signup automatically creates
-- user_profiles rows with default role 'author'.
insert into auth.users
  (id, instance_id, aud, role, email,
   raw_app_meta_data, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
values
  ('e1000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'hook_editor@test.local', '{}', '{}', now(), now(), now()),
  ('e2000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'hook_author@test.local', '{}', '{}', now(), now(), now());

-- Promote user 1 to editor
update public.user_profiles
   set role = 'editor'
 where id = 'e1000000-0000-0000-0000-000000000001';

-- User 3 ('e3000000-0000-0000-0000-000000000001') is intentionally NOT inserted,
-- so there is no user_profiles row for this user.

-- ── (a) Editor user gets claims.user_role = 'editor' ──────────────────────────
select is(
  (public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'e1000000-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'e1000000-0000-0000-0000-000000000001',
        'role', 'authenticated'
      )
    )
  )->'claims'->>'user_role'),
  'editor',
  'a: editor user gets claims.user_role = editor'
);

-- ── (b) Fresh signup gets claims.user_role = 'author' ─────────────────────────
select is(
  (public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'e2000000-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'e2000000-0000-0000-0000-000000000001',
        'role', 'authenticated'
      )
    )
  )->'claims'->>'user_role'),
  'author',
  'b: fresh signup gets claims.user_role = author'
);

-- ── (c) User with no profile gets null and no exception ───────────────────────
select is(
  (public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'e3000000-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'e3000000-0000-0000-0000-000000000001',
        'role', 'authenticated'
      )
    )
  )->'claims'->'user_role'),
  'null'::jsonb,
  'c: user with no profile gets claims.user_role = json null'
);

-- Malformed / non-UUID user_id does not raise an exception and returns null
select is(
  (public.custom_access_token_hook(
    '{"user_id": "not-a-valid-uuid", "claims": {"sub": "123", "role": "authenticated"}}'::jsonb
  )->'claims'->'user_role'),
  'null'::jsonb,
  'c: malformed user_id does not raise and returns claims.user_role = json null'
);

-- ── (d) Pre-existing claims preserved untouched ───────────────────────────────
select is(
  (public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'e1000000-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'e1000000-0000-0000-0000-000000000001',
        'role', 'authenticated',
        'email', 'hook_editor@test.local',
        'custom_key', 'custom_value'
      )
    )
  )->'claims'->>'role'),
  'authenticated',
  'd: pre-existing role claim remains authenticated'
);

select is(
  (public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'e1000000-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'e1000000-0000-0000-0000-000000000001',
        'role', 'authenticated',
        'email', 'hook_editor@test.local',
        'custom_key', 'custom_value'
      )
    )
  )->'claims'->>'sub'),
  'e1000000-0000-0000-0000-000000000001',
  'd: pre-existing sub claim is preserved'
);

select is(
  (public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'e1000000-0000-0000-0000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'e1000000-0000-0000-0000-000000000001',
        'role', 'authenticated',
        'email', 'hook_editor@test.local',
        'custom_key', 'custom_value'
      )
    )
  )->'claims'->>'custom_key'),
  'custom_value',
  'd: other pre-existing claims are preserved'
);

-- ── (e) Privilege checks ──────────────────────────────────────────────────────
select is(
  has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'execute'),
  false,
  'e: anon role does not have execute privilege on custom_access_token_hook'
);

select is(
  has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute'),
  false,
  'e: authenticated role does not have execute privilege on custom_access_token_hook'
);

select is(
  has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute'),
  true,
  'e: supabase_auth_admin has execute privilege on custom_access_token_hook'
);

-- Direct invocation attempt as authenticated fails with 42501 (insufficient privilege)
set local role authenticated;
select throws_ok(
  $sql$
    select public.custom_access_token_hook(
      '{"user_id":"e1000000-0000-0000-0000-000000000001"}'::jsonb
    )
  $sql$,
  '42501',
  NULL,
  'e: authenticated role cannot execute custom_access_token_hook directly'
);
reset role;

-- ── (f) Function definition: SECURITY DEFINER and empty search_path ───────────
select is(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'custom_access_token_hook'),
  true,
  'f: custom_access_token_hook is SECURITY DEFINER'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'custom_access_token_hook'
      and (
        'search_path=' = any(p.proconfig)
        or 'search_path=""' = any(p.proconfig)
        or array_to_string(p.proconfig, ',') ~ 'search_path=(""|)?'
      )
  ),
  'f: custom_access_token_hook proconfig contains empty search_path'
);

select * from finish();
rollback;
