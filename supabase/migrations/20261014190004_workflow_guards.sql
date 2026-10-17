-- =============================================================================
-- 20261014190004_workflow_guards.sql
-- Phase 2 — Database & RLS
--
-- Creates two triggers on public.submissions:
--
--   1. BEFORE UPDATE OF status — private.validate_status_transition()
--      • Enforces the allowed transition graph.
--      • Enforces who is allowed to make each transition.
--      • Auto-increments current_round on revisions_requested → submitted.
--
--   2. AFTER UPDATE OF status — private.record_status_change()
--      • Writes an immutable row to submission_status_history (SECURITY DEFINER).
--
-- Allowed transitions:
--   draft              → submitted
--   submitted          → in_review | rejected
--   in_review          → revisions_requested | accepted | rejected
--   revisions_requested→ submitted  (also increments current_round)
--   accepted           → published | rejected
--
-- Caller permissions:
--   author        → draft→submitted, revisions_requested→submitted (own submissions)
--   editor/admin  → all valid transitions
--   service role  → any valid transition (auth.uid() is null when called from backend)
--   reviewer/other→ raises immediately
-- =============================================================================

create or replace function private.validate_status_transition()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid         uuid;
  v_caller_role public.user_role;
begin
  -- No-op if the status column did not change value
  if new.status = old.status then
    return new;
  end if;

  -- ── Validate transition graph (applies to ALL callers, including service role) ──
  if not (
       (old.status = 'draft'                and new.status = 'submitted')
    or (old.status = 'submitted'            and new.status in ('in_review', 'rejected'))
    or (old.status = 'in_review'            and new.status in ('revisions_requested', 'accepted', 'rejected'))
    or (old.status = 'revisions_requested'  and new.status = 'submitted')
    or (old.status = 'accepted'             and new.status in ('published', 'rejected'))
  ) then
    raise exception 'invalid status transition: % → %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- ── Identify caller ──────────────────────────────────────────────────────────
  v_uid := (select auth.uid());

  -- Service role / backend: auth.uid() is null → skip caller check
  if v_uid is null then
    if old.status = 'revisions_requested' and new.status = 'submitted' then
      new.current_round := old.current_round + 1;
    end if;
    return new;
  end if;

  -- Fetch caller's platform role
  select role into v_caller_role
  from public.user_profiles
  where id = v_uid;

  -- ── Enforce caller permissions ───────────────────────────────────────────────
  case v_caller_role

    when 'author' then
      -- Authors may only submit or resubmit their own submissions
      if not (
           (old.status = 'draft'               and new.status = 'submitted')
        or (old.status = 'revisions_requested' and new.status = 'submitted')
      ) then
        raise exception
          'authors may only perform draft→submitted or revisions_requested→submitted, not % → %',
          old.status, new.status
          using errcode = 'insufficient_privilege';
      end if;
      -- Belt-and-suspenders: RLS already enforces this, but verify author owns the row
      if old.author_id <> v_uid then
        raise exception 'permission denied: submission does not belong to the caller'
          using errcode = 'insufficient_privilege';
      end if;

    when 'editor', 'admin' then
      -- Editors and admins may perform any transition that passed the graph check
      null;

    else
      -- Reviewers and any unknown role cannot change submission status
      raise exception 'permission denied: role % cannot change submission status', v_caller_role
        using errcode = 'insufficient_privilege';

  end case;

  -- ── Side-effect: increment round when resubmitting after revisions ───────────
  if old.status = 'revisions_requested' and new.status = 'submitted' then
    new.current_round := old.current_round + 1;
  end if;

  return new;
end;
$$;

comment on function private.validate_status_transition() is
  'BEFORE UPDATE trigger on submissions.status. Enforces the allowed transition '
  'graph and role-based caller permissions. Increments current_round on '
  'revisions_requested→submitted. SECURITY DEFINER with empty search_path.';

-- Trigger fires only when the `status` column is included in the UPDATE statement.
create trigger trg_submissions_validate_transition
  before update of status on public.submissions
  for each row execute function private.validate_status_transition();

-- ── Audit trail trigger ───────────────────────────────────────────────────────
-- Runs AFTER the BEFORE trigger and the data write, so `new` is the committed row.
-- SECURITY DEFINER bypasses RLS on submission_status_history (clients never write it).
create or replace function private.record_status_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.status <> old.status then
    insert into public.submission_status_history
      (submission_id, from_status, to_status, changed_by)
    values (
      new.id,
      old.status,
      new.status,
      (select auth.uid())   -- null when called by service role
    );
  end if;
  return null;  -- AFTER trigger return value is ignored
end;
$$;

comment on function private.record_status_change() is
  'AFTER UPDATE trigger on submissions.status. Appends one immutable row to '
  'submission_status_history. SECURITY DEFINER bypasses RLS — clients never '
  'write to that table directly.';

create trigger trg_submissions_record_status_change
  after update of status on public.submissions
  for each row execute function private.record_status_change();
