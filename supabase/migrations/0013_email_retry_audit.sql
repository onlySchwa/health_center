-- Record an admin's "Retry email" on an appointment in the audit log, with how it went.
-- Run once in Supabase → SQL Editor, after 0012_settings.sql.

alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check
    check (action in ('created', 'status', 'edited', 'archived', 'restored', 'deleted',
                      'role_changed', 'deactivated', 'reactivated',
                      'service_added', 'service_updated', 'settings_updated',
                      'email_retried'));
-- audit_log_subject_check already covers it: like other appointment entries, it names the appointment.

-- p_result: 'sent', 'failed', 'no_email' or 'skipped' (already sent, or the visit date has passed).
create function public.admin_log_email_retry(p_id bigint, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_result not in ('sent', 'failed', 'no_email', 'skipped') then
    raise exception 'unknown result' using errcode = '22023';
  end if;
  insert into public.audit_log (appointment_id, appointment_ref, action, new_status, details, actor_id, actor_role)
  select a.id, a.ref, 'email_retried', a.status,
         jsonb_build_object('result', p_result, 'email_for', a.email_for),
         auth.jwt() ->> 'sub', 'admin'
    from public.appointments a
   where a.id = p_id;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.admin_log_email_retry(bigint, text) from public, anon;
grant execute on function public.admin_log_email_retry(bigint, text) to authenticated;
