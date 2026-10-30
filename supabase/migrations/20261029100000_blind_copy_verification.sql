-- =============================================================================
-- 20261029100000_blind_copy_verification.sql
-- Stage 1A — Blind-copy verification, author path isolation & storage guards
--
-- 1. Adds verification columns to public.submission_versions:
--      • anonymized_verified_at (timestamptz)
--      • anonymized_verified_by (uuid -> user_profiles)
--      • anonymized_review_note (text, max 1000 chars)
--
-- 2. Creates private.guard_submission_versions() BEFORE INSERT OR UPDATE trigger:
--      • Non-editor/admin callers cannot set or alter anonymized_* fields (42501).
--      • Non-editor/admin callers must use manuscript_path = <auth.uid()>/<submission_id>/v<round>.pdf (42501).
--      • Editors/admins and secret-key context (auth.uid() is null) are unrestricted.
--      • Whenever anonymized_path changes, anonymized_verified_at/by are reset to NULL.
--
-- 3. Updates public.reviewer_submissions view:
--      • anonymized_path is revealed ONLY when assignment is accepted/completed
--        AND anonymized_verified_at IS NOT NULL.
--
-- 4. Replaces storage policy "manuscripts-anonymized: reviewer reads assigned":
--      • Reviewer can select only if assigned (accepted/completed) and a version
--        row matches storage.objects.name with anonymized_verified_at IS NOT NULL.
-- =============================================================================

-- ── 1. Column additions on public.submission_versions ─────────────────────────
alter table public.submission_versions
  add column anonymized_verified_at timestamptz,
  add column anonymized_verified_by uuid
    references public.user_profiles (id),
  add column anonymized_review_note text,
  add constraint chk_submission_versions_anonymized_review_note
    check (anonymized_review_note is null or length(anonymized_review_note) <= 1000);

comment on column public.submission_versions.anonymized_verified_at is
  'Timestamp when an editor or admin verified that the blind copy is properly anonymized.';

comment on column public.submission_versions.anonymized_verified_by is
  'Editor or admin who verified the blind copy.';

comment on column public.submission_versions.anonymized_review_note is
  'Feedback note from editor when blind copy is rejected or requires re-anonymization (max 1000 chars).';

-- ── 2. Guard trigger on public.submission_versions ────────────────────────────
create or replace function private.guard_submission_versions()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid      uuid;
  v_expected text;
begin
  v_uid := (select auth.uid());

  -- Step 1: When auth.uid() is NOT null AND caller is not editor/admin
  if v_uid is not null and not private.is_editor_or_admin() then
    v_expected := lower(v_uid::text) || '/' || lower(new.submission_id::text) || '/v' || new.round::text || '.pdf';

    if new.manuscript_path <> v_expected then
      raise exception 'manuscript_path must equal <auth.uid()>/<submission_id>/v<round>.pdf'
        using errcode = 'insufficient_privilege';
    end if;

    if tg_op = 'INSERT' then
      if new.anonymized_path is not null
         or new.anonymized_verified_at is not null
         or new.anonymized_verified_by is not null
         or new.anonymized_review_note is not null then
        raise exception 'authors cannot set anonymized fields on insert'
          using errcode = 'insufficient_privilege';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.anonymized_path is distinct from old.anonymized_path
         or new.anonymized_verified_at is distinct from old.anonymized_verified_at
         or new.anonymized_verified_by is distinct from old.anonymized_verified_by
         or new.anonymized_review_note is distinct from old.anonymized_review_note then
        raise exception 'authors cannot alter anonymized fields on update'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  -- Step 2: Whenever anonymized_path changes, reset verification
  if tg_op = 'UPDATE' and new.anonymized_path is distinct from old.anonymized_path then
    new.anonymized_verified_at := null;
    new.anonymized_verified_by := null;
  end if;

  return new;
end;
$$;

comment on function private.guard_submission_versions() is
  'BEFORE INSERT OR UPDATE trigger on submission_versions. Enforces author path '
  'isolation, prevents author modification of anonymized verification fields, and '
  'resets verification whenever anonymized_path changes.';

create trigger trg_submission_versions_guard
  before insert or update on public.submission_versions
  for each row execute function private.guard_submission_versions();

-- ── 3. Update public.reviewer_submissions view ────────────────────────────────
-- SECURITY CONTRACT: runs as postgres (bypasses RLS). Access gate: WHERE reviewer_id = auth.uid().
-- Preserves EXACT same columns, order, and grants as existing definition.
create or replace view public.reviewer_submissions as
select
  ra.submission_id,
  ra.round,
  ra.id                                         as assignment_id,
  ra.status                                     as assignment_status,
  ra.due_at,
  s.manuscript_language,
  s.title,
  s.abstract,
  s.keywords,
  -- Anonymised path only available once the reviewer has accepted the assignment AND it has been verified
  case
    when ra.status in ('accepted', 'completed')
         and sv.anonymized_verified_at is not null
      then sv.anonymized_path
    else null
  end                                           as anonymized_path
from public.reviewer_assignments               ra
join public.submissions                        s   on s.id  = ra.submission_id
left join public.submission_versions           sv  on sv.submission_id = ra.submission_id
                                                   and sv.round        = ra.round
-- ↑ SECURITY GATE: only the current authenticated reviewer's assignments
where ra.reviewer_id = (select auth.uid());

comment on view public.reviewer_submissions is
  'Reviewer portal: shows submission metadata for the caller''s own assignments only. '
  'SECURITY: runs as view owner (postgres, bypasses RLS). '
  'Access gate: WHERE reviewer_id = auth.uid(). '
  'Author identity is never exposed: author_id, submission_authors, and '
  'manuscript_path are intentionally excluded. '
  'anonymized_path is null until assignment is accepted and blind copy is verified.';

grant select on public.reviewer_submissions to authenticated;

-- ── 4. Replace storage policy for manuscripts-anonymized ──────────────────────
drop policy if exists "manuscripts-anonymized: reviewer reads assigned" on storage.objects;

create policy "manuscripts-anonymized: reviewer reads assigned"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'manuscripts-anonymized'
    and exists (
      select 1
      from public.reviewer_assignments a
      join public.submission_versions v
        on v.submission_id = a.submission_id
       and v.round         = a.round
      where a.reviewer_id = (select auth.uid())
        and a.status in ('accepted', 'completed')
        and v.anonymized_path = storage.objects.name
        and v.anonymized_verified_at is not null
    )
  );
