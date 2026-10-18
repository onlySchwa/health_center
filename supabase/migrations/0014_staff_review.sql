-- Staff confirm or reject requests for their own services, and read the audit log for them.
-- Run once in Supabase → SQL Editor, after 0013_email_retry_audit.sql.

begin;

-- 1. One update rule for staff, limited to their services. A policy only sees the new row,
--    so which status changes are allowed is checked against the old row by the trigger below.
--    (Two separate staff policies would be OR-ed together and allow more than either one.)
drop policy "Staff mark due appointments completed or missed" on public.appointments;

create policy "Staff update appointments in their services"
  on public.appointments for update to authenticated
  using (public.is_staff_for(service))
  with check (public.is_staff_for(service));

-- The status changes a staff member may make. Authenticated users can only update the status
-- column (0001_appointments.sql), so this is the whole of what staff can change directly.
--   pending            → confirmed   today or later (same as admins)
--   pending            → rejected    (same as admins)
--   pending, confirmed → completed, missed   once the visit date has come
--   pending, confirmed → cancelled   only their own booking, as a resident
create function public.check_staff_status_change() returns trigger
language plpgsql set search_path = '' as $$
declare
  today date := public.manila_today();
begin
  if coalesce(auth.jwt() -> 'metadata' ->> 'role', '') <> 'staff' then return new; end if;
  if (old.status = 'pending' and new.status = 'confirmed' and new.appt_date >= today)
     or (old.status = 'pending' and new.status = 'rejected')
     or (old.status in ('pending', 'confirmed') and new.status in ('completed', 'missed') and new.appt_date <= today)
     or (old.status in ('pending', 'confirmed') and new.status = 'cancelled' and old.user_id = auth.jwt() ->> 'sub') then
    return new;
  end if;
  raise exception 'Staff can''t change this appointment from % to %.', old.status, new.status using errcode = '42501';
end $$;

create trigger appointments_check_staff_status
  before update of status on public.appointments
  for each row when (new.status is distinct from old.status)
  execute function public.check_staff_status_change();

-- 2. Staff decisions email the resident too, so staff may record the email result
--    for appointments in their own services.
create or replace function public.admin_record_status_email(p_id bigint, p_for text, p_status text, p_error text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_admin()
          or exists (select 1 from public.appointments a where a.id = p_id and public.is_staff_for(a.service))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.appointments
     set email_attempts = case when email_for is distinct from p_for then 0 else email_attempts end
                          + case when p_status = 'failed' then 1 else 0 end,
         email_for      = p_for,
         email_status   = p_status,
         email_error    = case when p_status = 'sent' then null else left(p_error, 300) end,
         email_sent_at  = case when p_status = 'sent' then now() end
   where id = p_id
     and status = p_for
     and not (email_for is not distinct from p_for and email_status is not distinct from 'sent');
end $$;

-- 3. Staff read the audit history of appointments in their services, for exact notifications
--    (who confirmed, rescheduled or cancelled, and when). Account, service, settings and deleted-
--    appointment entries have no appointment_id, so staff never see them.
create policy "Staff read the audit log for their services"
  on public.audit_log for select to authenticated
  using (exists (select 1 from public.appointments a
                  where a.id = audit_log.appointment_id and public.is_staff_for(a.service)));

commit;
