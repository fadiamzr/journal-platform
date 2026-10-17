-- =============================================================================
-- 20261014190002_user_profiles.sql
-- Phase 2 — Database & RLS
--
-- Creates:
--   • public.user_profiles           — one row per auth.users row
--   • private.handle_new_user()      — signup trigger (role always = 'author')
--   • private.current_user_role()    — STABLE SECURITY DEFINER helper
--   • private.is_editor_or_admin()   — STABLE SECURITY DEFINER helper
--   • private.is_admin()             — STABLE SECURITY DEFINER helper
--   • public.admin_set_user_role()   — privileged role-change function
-- =============================================================================

-- ── user_profiles table ───────────────────────────────────────────────────────
create table public.user_profiles (
  id               uuid             primary key
                                    references auth.users (id) on delete cascade,
  full_name        text,
  role             public.user_role not null default 'author',
  preferred_locale public.app_locale         default 'en',
  affiliation      text,
  orcid            text,
  created_at       timestamptz      not null default now(),
  updated_at       timestamptz      not null default now()
);

comment on table public.user_profiles is
  'One row per Supabase Auth user. The `role` column is the authoritative source '
  'for access control — never use raw_user_meta_data for role decisions.';

comment on column public.user_profiles.role is
  'Platform role. Only admin_set_user_role() may change this; RLS prevents '
  'users from updating it directly.';

-- updated_at trigger
create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function private.set_updated_at();

-- ── signup trigger ────────────────────────────────────────────────────────────
-- Fires immediately after a new auth.users row is inserted.
-- Role is ALWAYS set to 'author' regardless of raw_user_meta_data to prevent
-- privilege escalation via signup payloads.
create or replace function private.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.user_profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'author'   -- hardcoded: raw_user_meta_data is untrusted for roles
  )
  on conflict (id) do nothing;   -- idempotent in case of retries
  return new;
end;
$$;

comment on function private.handle_new_user() is
  'Signup trigger: creates a user_profiles row with role=author. '
  'Any role value in raw_user_meta_data is intentionally ignored.';

create trigger trg_auth_users_on_signup
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── private role-helper functions ─────────────────────────────────────────────
-- STABLE + SECURITY DEFINER: safe to expose to `authenticated` because each
-- function reads only the calling user's own profile row via auth.uid().
-- Empty search_path prevents injection.

create or replace function private.current_user_role()
  returns public.user_role
  language sql
  security definer
  stable
  set search_path = ''
as $$
  select role
  from public.user_profiles
  where id = (select auth.uid());
$$;

comment on function private.current_user_role() is
  'Returns the user_role of the currently authenticated user. STABLE SECURITY DEFINER.';

create or replace function private.is_editor_or_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id   = (select auth.uid())
      and role in ('editor', 'admin')
  );
$$;

comment on function private.is_editor_or_admin() is
  'Returns true when the current user is an editor or admin. STABLE SECURITY DEFINER.';

create or replace function private.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id   = (select auth.uid())
      and role = 'admin'
  );
$$;

comment on function private.is_admin() is
  'Returns true when the current user is an admin. STABLE SECURITY DEFINER.';

-- Grant usage on the private schema and execute on each helper to authenticated.
-- The `private` schema itself remains inaccessible to anon/public.
grant usage  on schema private to authenticated;
grant execute on function private.current_user_role()   to authenticated;
grant execute on function private.is_editor_or_admin() to authenticated;
grant execute on function private.is_admin()            to authenticated;

-- ── public admin function ──────────────────────────────────────────────────────
-- SECURITY DEFINER: can update any user_profiles row regardless of RLS.
-- Raises immediately if the caller is not an admin.
create or replace function public.admin_set_user_role(
  target_id uuid,
  new_role   public.user_role
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'permission denied: caller is not an admin'
      using errcode = 'insufficient_privilege';
  end if;

  update public.user_profiles
     set role = new_role
   where id = target_id;

  if not found then
    raise exception 'user profile not found: %', target_id
      using errcode = 'no_data_found';
  end if;
end;
$$;

comment on function public.admin_set_user_role(uuid, public.user_role) is
  'Changes the role of any user. Only callable by admins (enforced inside the function). '
  'SECURITY DEFINER bypasses RLS so admins can update any row.';

grant execute on function public.admin_set_user_role(uuid, public.user_role)
  to authenticated;
