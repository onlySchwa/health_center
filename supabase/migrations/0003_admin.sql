-- Admin role and audit trail.
-- Run once in Supabase → SQL Editor, after 0002_remove_bp_and_medicine_services.sql.
--
--   Admins: see every appointment, confirm or reject pending requests, and read the audit log.
--   Audit log: one row per booking and per status change, written by a trigger, so
--              it can't be skipped or edited from the app. Nobody can change or delete it.

-- True when the signed-in Clerk user has role "admin" in their public metadata.
create function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'metadata' ->> 'role', '') = 'admin'
$$;

create policy "Admins see all appointments"
  on public.appointments for select to authenticated
  using ((select public.is_admin()));

-- Reject = cancelled. Only today-or-later requests can be confirmed.
create policy "Admins confirm or reject pending requests"
  on public.appointments for update to authenticated
  using ((select public.is_admin()) and status = 'pending')
  with check (
    (select public.is_admin())
    and (status = 'cancelled' or (status = 'confirmed' and appt_date >= public.manila_today()))
  );

create table public.audit_log (
  id             bigint generated always as identity primary key,
  appointment_id bigint not null references public.appointments (id),
  old_status     text,          -- null for a new booking
  new_status     text not null,
  actor_id       text,          -- Clerk user ID; null when edited directly in Supabase
  actor_role     text not null check (actor_role in ('resident', 'staff', 'admin', 'system')),
  created_at     timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_appointment_id_idx on public.audit_log (appointment_id);

-- Runs as the table owner so it can write the log, which users have no insert rights on.
create function public.log_appointment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor text := auth.jwt() ->> 'sub';
begin
  insert into public.audit_log (appointment_id, old_status, new_status, actor_id, actor_role)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status end,
    new.status,
    actor,
    case
      when actor is null then 'system'
      when auth.jwt() -> 'metadata' ->> 'role' in ('staff', 'admin') then auth.jwt() -> 'metadata' ->> 'role'
      else 'resident'
    end
  );
  return null;
end $$;

revoke execute on function public.log_appointment_change() from public, anon, authenticated;

create trigger appointments_log_insert
  after insert on public.appointments
  for each row execute function public.log_appointment_change();

create trigger appointments_log_status
  after update of status on public.appointments
  for each row when (old.status is distinct from new.status)
  execute function public.log_appointment_change();

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

alter table public.audit_log enable row level security;

create policy "Admins read the audit log"
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- Backfill appointments made before this log existed. Only the booking and the
-- latest change are known; staff are the only ones who can mark completed/missed.
insert into public.audit_log (appointment_id, old_status, new_status, actor_id, actor_role, created_at)
select id, null, 'pending', user_id, 'resident', created_at from public.appointments;

insert into public.audit_log (appointment_id, old_status, new_status, actor_id, actor_role, created_at)
select id, 'pending', status, updated_by,
       case when status in ('completed', 'missed') then 'staff' else 'resident' end,
       updated_at
  from public.appointments
 where status <> 'pending';
