-- Booking form asks for first and last name, email and address; the mobile number becomes optional.
-- Run once in Supabase → SQL Editor, after 0005_admin_manage.sql.
-- (Recovered from the project's applied-migration history on 2026-10-17.)

alter table public.appointments
  add column first_name text,
  add column last_name  text,
  add column email      text check (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  add column address    text check (char_length(address) between 5 and 200);

update public.appointments
   set first_name = case when trim(resident_name) ~ '\s' then regexp_replace(trim(resident_name), '\s+\S+$', '') else trim(resident_name) end,
       last_name  = case when trim(resident_name) ~ '\s' then substring(trim(resident_name) from '\S+$') else '' end;

alter table public.appointments
  alter column first_name set not null,
  alter column last_name  set not null,
  add constraint appointments_first_name_check check (char_length(first_name) between 1 and 50),
  add constraint appointments_last_name_check  check (char_length(last_name) between 1 and 50),
  alter column phone drop not null;

alter table public.appointments drop column resident_name;
alter table public.appointments
  add column resident_name text generated always as (first_name || ' ' || last_name) stored;

grant insert (first_name, last_name, email, address) on public.appointments to authenticated;

create or replace function public.log_appointment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor text := auth.jwt() ->> 'sub';
  v_role text := case
    when actor is null then 'system'
    when auth.jwt() -> 'metadata' ->> 'role' in ('staff', 'admin') then auth.jwt() -> 'metadata' ->> 'role'
    else 'resident'
  end;
  changes jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (appointment_id, appointment_ref, action, new_status, actor_id, actor_role)
    values (new.id, new.ref, 'created', new.status, actor, v_role);

  elsif tg_op = 'DELETE' then
    insert into public.audit_log (appointment_id, appointment_ref, action, new_status, details, actor_id, actor_role)
    values (null, old.ref, 'deleted', old.status,
            jsonb_build_object('resident_name', old.resident_name, 'email', old.email, 'phone', old.phone,
                               'address', old.address, 'service', old.service, 'appt_date', old.appt_date,
                               'time_slot', old.time_slot, 'note', old.note),
            actor, v_role);

  else
    if new.status is distinct from old.status then
      insert into public.audit_log (appointment_id, appointment_ref, action, old_status, new_status, actor_id, actor_role)
      values (new.id, new.ref, 'status', old.status, new.status, actor, v_role);
    end if;

    if new.archived_at is distinct from old.archived_at then
      insert into public.audit_log (appointment_id, appointment_ref, action, new_status, actor_id, actor_role)
      values (new.id, new.ref, case when new.archived_at is null then 'restored' else 'archived' end,
              new.status, actor, v_role);
    end if;

    select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value)) into changes
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
     where o.key in ('first_name', 'last_name', 'email', 'phone', 'address', 'service', 'appt_date', 'time_slot', 'note')
       and o.value is distinct from n.value;

    if changes is not null then
      insert into public.audit_log (appointment_id, appointment_ref, action, new_status, details, actor_id, actor_role)
      values (new.id, new.ref, 'edited', new.status, changes, actor, v_role);
    end if;
  end if;
  return null;
end $$;

drop function public.admin_update_appointment(bigint, text, text, text, date, text, text, text);

create function public.admin_update_appointment(
  p_id bigint, p_first_name text, p_last_name text, p_email text, p_phone text, p_address text,
  p_service text, p_appt_date date, p_time_slot text, p_note text, p_status text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.appointments
     set first_name = p_first_name, last_name = p_last_name, email = p_email, phone = p_phone,
         address = p_address, service = p_service, appt_date = p_appt_date, time_slot = p_time_slot,
         note = p_note, status = p_status
   where id = p_id;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.admin_update_appointment(bigint, text, text, text, text, text, text, date, text, text, text) from public, anon;
grant execute on function public.admin_update_appointment(bigint, text, text, text, text, text, text, date, text, text, text) to authenticated;
