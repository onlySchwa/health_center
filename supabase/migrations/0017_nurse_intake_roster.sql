-- Nurses, the health form residents fill in when booking, and the daily duty roster.
-- Run once in Supabase → SQL Editor, after 0016_walk_ins.sql.
--
--   Nurses:        role "nurse" in Clerk public metadata. They read every appointment and its health
--                  form, so they know each patient before they arrive. They change nothing.
--   Health forms:  one per appointment, in their own table so booking staff (who see contact
--                  details) never see medical details. Readable by the resident, nurses and admins.
--   Duty roster:   which nurses and staff are on duty each day. Admins set it; the team reads it.

begin;

-- True when the signed-in Clerk user has role "nurse" in their public metadata.
create function public.is_nurse() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'metadata' ->> 'role', '') = 'nurse'
$$;

create policy "Nurses see all appointments"
  on public.appointments for select to authenticated
  using ((select public.is_nurse()));

-- 1. Health forms. Only the reason for the visit is required; the rest is what the resident chose to
--    share. Measurements are self-reported, so the nurse still checks them at the visit.
create table public.health_intakes (
  appointment_id   bigint primary key references public.appointments (id) on delete cascade,
  user_id          text not null default (auth.jwt() ->> 'sub'),
  reason           text not null check (char_length(reason) between 3 and 300),
  symptoms         text check (char_length(symptoms) <= 500),
  symptom_duration text check (char_length(symptom_duration) <= 60),
  allergies        text check (char_length(allergies) <= 300),
  medications      text check (char_length(medications) <= 300),
  conditions       text[] not null default '{}' check (conditions <@ array[
                     'Hypertension', 'Diabetes', 'Asthma', 'Heart disease', 'Tuberculosis', 'Kidney disease']),
  other_conditions text check (char_length(other_conditions) <= 200),
  birthdate        date check (birthdate >= '1900-01-01'),
  sex              text check (sex in ('female', 'male')),
  civil_status     text check (civil_status in ('single', 'married', 'widowed', 'separated')),
  philhealth_no    text check (philhealth_no ~ '^[0-9]{2}-?[0-9]{9}-?[0-9]$'),
  emergency_name   text check (char_length(emergency_name) <= 100),
  emergency_phone  text check (emergency_phone ~ '^[0-9+ -]{7,20}$'),
  weight_kg        numeric(4, 1) check (weight_kg between 1 and 300),
  height_cm        numeric(4, 1) check (height_cm between 30 and 250),
  last_period      date,
  created_at       timestamptz not null default now()
);

create index health_intakes_user_id_idx on public.health_intakes (user_id, created_at desc);

revoke all on public.health_intakes from anon, authenticated;
grant select on public.health_intakes to authenticated;
grant insert (appointment_id, reason, symptoms, symptom_duration, allergies, medications, conditions,
              other_conditions, birthdate, sex, civil_status, philhealth_no, emergency_name, emergency_phone,
              weight_kg, height_cm, last_period)
  on public.health_intakes to authenticated;

alter table public.health_intakes enable row level security;

create policy "Residents see their own health forms"
  on public.health_intakes for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

create policy "Nurses and admins see health forms"
  on public.health_intakes for select to authenticated
  using ((select public.is_nurse()) or (select public.is_admin()));

create policy "Residents add a health form to their own appointment"
  on public.health_intakes for insert to authenticated
  with check (
    user_id = (select auth.jwt() ->> 'sub')
    and exists (select 1 from public.appointments a
                 where a.id = appointment_id and a.user_id = (select auth.jwt() ->> 'sub'))
  );

-- Saves a resident's request and its health form together, so there's never one without the other.
-- Runs as the caller: the usual insert policies and column grants decide what's allowed.
create function public.request_appointment(
  p_first_name text, p_last_name text, p_email text, p_phone text, p_address text,
  p_service text, p_appt_date date, p_time_slot text, p_note text, p_intake jsonb
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  new_id  bigint;
  new_ref text;
  f       public.health_intakes;
begin
  insert into public.appointments (first_name, last_name, email, phone, address, service, appt_date, time_slot, note)
  values (p_first_name, p_last_name, p_email, p_phone, p_address, p_service, p_appt_date, p_time_slot, p_note)
  returning id, ref into new_id, new_ref;

  f := jsonb_populate_record(null::public.health_intakes, p_intake);
  insert into public.health_intakes
    (appointment_id, reason, symptoms, symptom_duration, allergies, medications, conditions, other_conditions,
     birthdate, sex, civil_status, philhealth_no, emergency_name, emergency_phone, weight_kg, height_cm, last_period)
  values
    (new_id, f.reason, f.symptoms, f.symptom_duration, f.allergies, f.medications, coalesce(f.conditions, '{}'),
     f.other_conditions, f.birthdate, f.sex, f.civil_status, f.philhealth_no, f.emergency_name, f.emergency_phone,
     f.weight_kg, f.height_cm, f.last_period);
  return new_ref;
end $$;

revoke execute on function public.request_appointment(text, text, text, text, text, text, date, text, text, jsonb) from public, anon;
grant execute on function public.request_appointment(text, text, text, text, text, text, date, text, text, jsonb) to authenticated;

-- 2. Duty roster. Roles live in Clerk, so the app checks the person is a nurse or staff member before
--    calling admin_set_duty; the role is kept here as it was on the day.
create table public.duty_roster (
  duty_date  date not null,
  user_id    text not null,
  role       text not null check (role in ('nurse', 'staff')),
  created_at timestamptz not null default now(),
  primary key (duty_date, user_id)
);

create index duty_roster_user_id_idx on public.duty_roster (user_id, duty_date);

revoke all on public.duty_roster from anon, authenticated;
grant select on public.duty_roster to authenticated;

alter table public.duty_roster enable row level security;

create policy "The team reads the duty roster"
  on public.duty_roster for select to authenticated
  using ((select public.is_admin()) or (select public.is_nurse())
         or coalesce((select auth.jwt() -> 'metadata' ->> 'role'), '') = 'staff');

-- Roster changes go in the audit log as account entries: who was put on or taken off duty, and for which day.
alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check
    check (action in ('created', 'status', 'edited', 'archived', 'restored', 'deleted',
                      'role_changed', 'deactivated', 'reactivated',
                      'service_added', 'service_updated', 'settings_updated', 'email_retried',
                      'duty_assigned', 'duty_removed')),
  drop constraint audit_log_subject_check,
  add constraint audit_log_subject_check check (
    case
      when action in ('role_changed', 'deactivated', 'reactivated')
        then target_user_id is not null and appointment_id is null and appointment_ref is null
      when action in ('duty_assigned', 'duty_removed')
        then details ? 'date' and target_user_id is not null and appointment_id is null and appointment_ref is null
      when action in ('service_added', 'service_updated')
        then details ? 'service' and target_user_id is null and appointment_id is null and appointment_ref is null
      when action = 'settings_updated'
        then target_user_id is null and appointment_id is null and appointment_ref is null
      else target_user_id is null and appointment_ref is not null and new_status is not null
    end
  );

-- Puts someone on duty for a day (p_role 'nurse' or 'staff'), or takes them off (p_role null).
-- Does nothing, and logs nothing, if they're already in that state.
create function public.admin_set_duty(p_date date, p_user_id text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  changed integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_role is null then
    delete from public.duty_roster where duty_date = p_date and user_id = p_user_id;
  else
    insert into public.duty_roster (duty_date, user_id, role) values (p_date, p_user_id, p_role)
    on conflict do nothing;
  end if;
  get diagnostics changed = row_count;
  if changed > 0 then
    insert into public.audit_log (action, target_user_id, details, actor_id, actor_role)
    values (case when p_role is null then 'duty_removed' else 'duty_assigned' end, p_user_id,
            jsonb_strip_nulls(jsonb_build_object('date', p_date, 'role', p_role)), auth.jwt() ->> 'sub', 'admin');
  end if;
end $$;

revoke execute on function public.admin_set_duty(date, text, text) from public, anon;
grant execute on function public.admin_set_duty(date, text, text) to authenticated;

commit;
