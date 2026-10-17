-- =============================================================================
-- test_schema.sql
-- Test (a): RLS is enabled on every table in schema public.
-- Plan: 8 assertions — one per base table.
-- =============================================================================
begin;
select plan(8);

-- Helper: returns true when relrowsecurity is enabled for a table in schema public.
create or replace function pg_temp.rls_enabled(tbl text)
  returns boolean language sql as $$
  select c.relrowsecurity
  from   pg_class c
  join   pg_namespace n on n.oid = c.relnamespace
  where  n.nspname = 'public'
    and  c.relname = tbl
    and  c.relkind = 'r';
$$;

select is(pg_temp.rls_enabled('user_profiles'),            true, 'RLS enabled: user_profiles');
select is(pg_temp.rls_enabled('issues'),                   true, 'RLS enabled: issues');
select is(pg_temp.rls_enabled('submissions'),              true, 'RLS enabled: submissions');
select is(pg_temp.rls_enabled('submission_authors'),       true, 'RLS enabled: submission_authors');
select is(pg_temp.rls_enabled('submission_versions'),      true, 'RLS enabled: submission_versions');
select is(pg_temp.rls_enabled('reviewer_assignments'),     true, 'RLS enabled: reviewer_assignments');
select is(pg_temp.rls_enabled('reviews'),                  true, 'RLS enabled: reviews');
select is(pg_temp.rls_enabled('submission_status_history'),true, 'RLS enabled: submission_status_history');

select * from finish();
rollback;
