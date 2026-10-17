-- =============================================================================
-- 20261015100000_storage_buckets.sql
-- Proposed Migration — Configure storage.buckets declaratively
--
-- Rationale:
--   Migration 7 (20261014190007_storage_policies.sql) created RLS security
--   policies on `storage.objects` for buckets 'manuscripts', 'manuscripts-anonymized',
--   and 'published', but did not insert or configure the corresponding bucket rows
--   in `storage.buckets`.
--
--   Without these entries, Supabase Storage rejects access with bucket-not-found
--   unless the buckets were manually configured in the Supabase Dashboard.
--   This migration declaratively provisions the buckets with:
--     • 'manuscripts': private, 50MB limit (52428800 bytes), PDF-only
--     • 'manuscripts-anonymized': private, 50MB limit (52428800 bytes), PDF-only
--     • 'published': public (CDN enabled), 50MB limit (52428800 bytes), PDF-only
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('manuscripts', 'manuscripts', false, 52428800, array['application/pdf']::text[]),
  ('manuscripts-anonymized', 'manuscripts-anonymized', false, 52428800, array['application/pdf']::text[]),
  ('published', 'published', true, 52428800, array['application/pdf']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
