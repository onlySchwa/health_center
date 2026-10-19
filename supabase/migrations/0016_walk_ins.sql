-- Staff record walk-in visits for residents who come in without booking online (no internet or
-- account). Run once in Supabase → SQL Editor, after 0015_follow_up_and_undo.sql.

begin;

alter table public.appointments
  add column walk_in boolean not null default false;

-- Records a walk-in for today in one of the staff member's services, saved as confirmed so staff
-- mark it completed or missed afterwards as usual. The online booking rules (days ahead, same-day,
-- full slots, closed dates) don't apply: the resident is already here. Each walk-in gets its own
-- placeholder user id, so it's never grouped with another resident's visits.
-- The insert is logged as "created" by the staff member (log_appointment_change).
create function public.staff_record_walk_in(
  p_first_name text, p_last_name text, p_phone text, p_address text, p_service text, p_slot text, p_note text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  s      public.services;
  new_ref text;
begin
  if not public.is_staff_for(p_service) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into s from public.services where name = p_service;
  if not found or not s.active then
    raise exception 'Please choose a service.' using errcode = 'P0001';
  end if;
  if not (p_slot = any (s.time_slots)) then
    raise exception '% isn''t offered at that time. Please choose another time.', s.name using errcode = 'P0001';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Please enter the mobile number.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_address), '') = '' then
    raise exception 'Please enter the address.' using errcode = 'P0001';
  end if;

  insert into public.appointments
    (user_id, first_name, last_name, phone, address, service, appt_date, time_slot, note, status, walk_in)
  values
    ('walk-in:' || gen_random_uuid(), p_first_name, p_last_name, p_phone, p_address, p_service,
     public.manila_today(), p_slot, p_note, 'confirmed', true)
  returning ref into new_ref;
  return new_ref;
end $$;

revoke execute on function public.staff_record_walk_in(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.staff_record_walk_in(text, text, text, text, text, text, text) to authenticated;

commit;
