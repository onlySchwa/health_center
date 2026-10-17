-- Health services move from a fixed list (check constraint, 0002) into a table admins manage.
-- A service's name is its key: appointments and staff assignments (Clerk metadata) refer to it
-- by name, so names can't be changed, only added. Disabling hides a service from booking
-- without touching its appointments. Run once in Supabase → SQL Editor, after 0010_account_audit.sql.

create table public.services (
  name         text primary key check (char_length(name) between 3 and 60),
  description  text not null default '' check (char_length(description) <= 300),
  requirements text not null default '' check (char_length(requirements) <= 300),
  -- ISO weekdays it's offered (1 = Monday … 5 = Friday); weekends stay closed.
  days         smallint[] not null default '{1,2,3,4,5}'
               check (cardinality(days) > 0 and days <@ '{1,2,3,4,5}'::smallint[]),
  time_slots   text[] not null default '{"Morning (8 AM – 12 NN)","Afternoon (1 PM – 5 PM)"}'
               check (cardinality(time_slots) > 0
                      and time_slots <@ '{"Morning (8 AM – 12 NN)","Afternoon (1 PM – 5 PM)"}'::text[]),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- The four current services, with the descriptions from the public services page.
insert into public.services (name, description, sort_order) values
  ('General consultation', 'Fever, cough, body pain or a check-up you''ve been putting off.', 1),
  ('Child immunization', 'Routine vaccines for infants and children, on schedule.', 2),
  ('Prenatal & maternal care', 'Regular check-ups for a safe pregnancy and healthy delivery.', 3),
  ('Family planning', 'Private counseling and methods that fit your family.', 4);

-- Appointments now point at the table instead of a fixed list. Restrict: a service with
-- appointments can't be deleted or renamed, so history always keeps its service.
alter table public.appointments drop constraint appointments_service_check;
alter table public.appointments
  add constraint appointments_service_fkey foreign key (service) references public.services (name)
  on update restrict on delete restrict;

-- Anyone can read services (the booking form and public pages list them); only the admin
-- function below writes them.
alter table public.services enable row level security;
create policy "Anyone reads services" on public.services for select to anon, authenticated using (true);
grant select on public.services to anon, authenticated;

-- Residents can only book an active service, on a day and time slot it's offered.
drop policy "Residents request appointments for themselves" on public.appointments;
create policy "Residents request appointments for themselves"
  on public.appointments for insert to authenticated
  with check (
    user_id = auth.jwt() ->> 'sub'
    and appt_date >= public.manila_today()
    and exists (
      select 1 from public.services s
       where s.name = service
         and s.active
         and extract(isodow from appt_date)::smallint = any (s.days)
         and time_slot = any (s.time_slots)
    )
  );

-- Service changes go in the audit log too, with the service's name and what changed in details.
alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check
    check (action in ('created', 'status', 'edited', 'archived', 'restored', 'deleted',
                      'role_changed', 'deactivated', 'reactivated',
                      'service_added', 'service_updated')),
  drop constraint audit_log_subject_check,
  add constraint audit_log_subject_check check (
    case
      when action in ('role_changed', 'deactivated', 'reactivated')
        then target_user_id is not null and appointment_id is null and appointment_ref is null
      when action in ('service_added', 'service_updated')
        then details ? 'service' and target_user_id is null and appointment_id is null and appointment_ref is null
      else target_user_id is null and appointment_ref is not null and new_status is not null
    end
  );

-- Adds a service, or updates an existing one's details, schedule and active flag (never its name).
-- Logs the change itself, so every service change is in the audit log.
create function public.admin_save_service(
  p_name text, p_is_new boolean, p_description text, p_requirements text,
  p_days smallint[], p_time_slots text[], p_active boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  before jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;

  if p_is_new then
    insert into public.services (name, description, requirements, days, time_slots, active, sort_order)
    values (trim(p_name), p_description, p_requirements, p_days, p_time_slots, p_active,
            (select coalesce(max(sort_order), 0) + 1 from public.services));
    insert into public.audit_log (action, details, actor_id, actor_role)
    values ('service_added', jsonb_build_object('service', trim(p_name), 'active', p_active),
            auth.jwt() ->> 'sub', 'admin');
  else
    select to_jsonb(s) - 'updated_at' - 'sort_order' into before from public.services s where s.name = p_name;
    if before is null then raise exception 'service not found' using errcode = 'P0002'; end if;
    update public.services
       set description = p_description, requirements = p_requirements, days = p_days,
           time_slots = p_time_slots, active = p_active, updated_at = now()
     where name = p_name;
    insert into public.audit_log (action, details, actor_id, actor_role)
    values ('service_updated',
            jsonb_build_object('service', p_name,
              'changes', (select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
                            from jsonb_each(before) o
                            join jsonb_each(to_jsonb((select s from public.services s where s.name = p_name))) n
                              on n.key = o.key
                           where o.value is distinct from n.value)),
            auth.jwt() ->> 'sub', 'admin');
  end if;
end $$;

revoke execute on function public.admin_save_service(text, boolean, text, text, smallint[], text[], boolean) from public, anon;
grant execute on function public.admin_save_service(text, boolean, text, text, smallint[], text[], boolean) to authenticated;
