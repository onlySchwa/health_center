-- Add a "rejected" status so residents can tell an admin rejection from their own cancellation.
-- Run once in Supabase → SQL Editor, after 0003_admin.sql.

begin;

alter table public.appointments drop constraint appointments_status_check;

alter table public.appointments add constraint appointments_status_check
  check (status in ('pending', 'confirmed', 'completed', 'missed', 'cancelled', 'rejected'));

drop policy "Admins confirm or reject pending requests" on public.appointments;

-- Only today-or-later requests can be confirmed.
create policy "Admins confirm or reject pending requests"
  on public.appointments for update to authenticated
  using ((select public.is_admin()) and status = 'pending')
  with check (
    (select public.is_admin())
    and (status = 'rejected' or (status = 'confirmed' and appt_date >= public.manila_today()))
  );

commit;
