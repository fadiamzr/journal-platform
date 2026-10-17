-- =============================================================================
-- 20261014190001_extensions_enums_helpers.sql
-- Phase 2 — Database & RLS
--
-- Creates:
--   • schema `private`  (never exposed by PostgREST)
--   • all platform enums in schema `public`
--   • private.set_updated_at() — shared BEFORE UPDATE trigger function
-- =============================================================================

-- ── private schema ────────────────────────────────────────────────────────────
-- PostgREST exposes only the `public` schema by default.
-- `private` holds security-sensitive helpers that API clients must never call
-- directly.
create schema if not exists private;

-- Deny all default public access; grants are added per-function in later migrations.
revoke usage on schema private from public;

-- ── enums ─────────────────────────────────────────────────────────────────────

create type public.user_role as enum (
  'author',
  'reviewer',
  'editor',
  'admin'
);
comment on type public.user_role is
  'Platform roles. The authoritative value lives in user_profiles.role, never in JWT metadata.';

create type public.submission_status as enum (
  'draft',
  'submitted',
  'in_review',
  'revisions_requested',
  'accepted',
  'rejected',
  'published'
);
comment on type public.submission_status is
  'Lifecycle states for a manuscript submission. Transitions are enforced by the workflow_guards trigger.';

create type public.review_recommendation as enum (
  'accept',
  'minor_revisions',
  'major_revisions',
  'reject'
);
comment on type public.review_recommendation is
  'Reviewer recommendation attached to a submitted review.';

create type public.assignment_status as enum (
  'invited',
  'accepted',
  'declined',
  'completed'
);
comment on type public.assignment_status is
  'State of a reviewer assignment. Reviewers may only transition invited→accepted|declined; editors mark completed.';

create type public.app_locale as enum (
  'en',
  'fr',
  'ar'
);
comment on type public.app_locale is
  'Supported platform locales. Arabic (ar) uses RTL layout.';

create type public.issue_status as enum (
  'draft',
  'published'
);
comment on type public.issue_status is
  'Publication state of a journal issue.';

create type public.extraction_status as enum (
  'not_started',
  'pending',
  'succeeded',
  'failed'
);
comment on type public.extraction_status is
  'State of the AI metadata extraction pipeline for a submission.';

-- ── shared trigger function ───────────────────────────────────────────────────
-- Attached as a BEFORE UPDATE trigger on any table with an `updated_at` column.
-- SECURITY DEFINER + empty search_path prevents search-path hijacking.
create or replace function private.set_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function private.set_updated_at() is
  'Generic BEFORE UPDATE trigger that stamps updated_at = now(). '
  'SECURITY DEFINER with empty search_path to prevent injection.';
