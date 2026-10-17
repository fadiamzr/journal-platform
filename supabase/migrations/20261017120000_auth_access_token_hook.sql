-- =============================================================================
-- 20261017120000_auth_access_token_hook.sql
-- Phase 3 — Auth & RBAC
--
-- Creates:
--   • public.custom_access_token_hook(jsonb) — custom access token hook for Supabase Auth
-- =============================================================================

-- ── custom access token hook ──────────────────────────────────────────────────
-- Adds a top-level `user_role` claim to minted JWT access tokens based on the
-- user's authoritative role stored in `public.user_profiles`.
--
-- IMPORTANT:
--   1. The claim is named `user_role`, NEVER `role` (which is reserved by Postgres/PostgREST).
--   2. SECURITY DEFINER with `set search_path = ''` prevents search-path hijacking.
--   3. All table, type, and function references are fully qualified.
--   4. Must NEVER raise an exception (a failing hook blocks every login).
--      Wrapped in an exception handler that returns the event with user_role null.
--   5. Wired up in the Supabase dashboard (Authentication > Hooks), not in SQL.

create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_role public.user_role;
begin
  begin
    v_user_id := (event->>'user_id')::uuid;

    select role into v_role
    from public.user_profiles
    where id = v_user_id;

    claims := coalesce(event->'claims', '{}'::jsonb);

    if v_role is not null then
      claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role::text), true);
    else
      claims := jsonb_set(claims, '{user_role}', 'null'::jsonb, true);
    end if;

    event := jsonb_set(event, '{claims}', claims, true);
    return event;
  exception
    when others then
      -- Safety guard: a hook error blocks all logins. Catch everything,
      -- preserve whatever claims exist, and return user_role as null.
      begin
        claims := coalesce(event->'claims', '{}'::jsonb);
        claims := jsonb_set(claims, '{user_role}', 'null'::jsonb, true);
        return jsonb_set(event, '{claims}', claims, true);
      exception
        when others then
          return event;
      end;
  end;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Auth access token hook: adds top-level user_role claim to JWTs from public.user_profiles. '
  'SECURITY DEFINER with empty search_path. '
  'Wired up in the Supabase dashboard (Authentication > Hooks), not in SQL.';

-- ── privileges ────────────────────────────────────────────────────────────────
-- Grant execution strictly to supabase_auth_admin (the Auth service runner).
-- Revoke execution from public, anon, and authenticated so it cannot be called
-- via the PostgREST HTTP API (/rpc/custom_access_token_hook).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
