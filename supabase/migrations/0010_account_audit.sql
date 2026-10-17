-- Record account changes (role changes, deactivation) in the same audit log as appointment changes.
-- Accounts live in Clerk, so the admin page changes them there and then calls admin_log_account_change.
-- Run once in Supabase → SQL Editor, after 0009_stricter_email_check.sql.

alter table public.audit_log
  add column target_user_id text,
  alter column appointment_ref drop not null,
  alter column new_status drop not null,
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check
    check (action in ('created', 'status', 'edited', 'archived', 'restored', 'deleted',
                      'role_changed', 'deactivated', 'reactivated')),
  -- Each entry is about exactly one thing: an appointment (as before) or an account.
  add constraint audit_log_subject_check check (
    case when action in ('role_changed', 'deactivated', 'reactivated')
      then target_user_id is not null and appointment_id is null and appointment_ref is null
      else target_user_id is null and appointment_ref is not null and new_status is not null
    end
  );

-- Admins may add account entries, always as themselves. Nobody can edit or delete entries:
-- authenticated users still only have SELECT on the table, and only admins can read it.
create function public.admin_log_account_change(p_target_user_id text, p_action text, p_details jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.audit_log (action, target_user_id, details, actor_id, actor_role)
  values (p_action, p_target_user_id, p_details, auth.jwt() ->> 'sub', 'admin');
end $$;

revoke execute on function public.admin_log_account_change(text, text, jsonb) from public, anon;
grant execute on function public.admin_log_account_change(text, text, jsonb) to authenticated;
