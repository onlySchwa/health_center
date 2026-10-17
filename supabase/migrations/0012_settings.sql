-- Clinic settings admins manage: the details shown on the website, booking rules and which
-- emails go out. One row. Booking rules are checked in one place, booking_rule_error(), which
-- both the residents' insert policy and the booking form use.
-- Run once in Supabase → SQL Editor, after 0011_services.sql.

create table public.clinic_settings (
  id                 boolean primary key default true check (id), -- only ever one row
  -- Shown on the website
  clinic_name        text not null default 'Baan KM 3 Barangay Health Center' check (char_length(clinic_name) between 3 and 100),
  address            text not null default 'Baan KM 3, Butuan City' check (char_length(address) <= 200),
  clinic_days        text not null default '' check (char_length(clinic_days) <= 100),
  clinic_hours       text not null default '' check (char_length(clinic_hours) <= 100),
  phone              text not null default '' check (phone = '' or phone ~ '^[0-9+ -]{7,20}$'),
  facebook_url       text not null default '' check (facebook_url = '' or facebook_url ~ '^https://[^\s]{1,200}$'),
  messenger_url      text not null default 'https://m.me/Worcestersher' check (messenger_url = '' or messenger_url ~ '^https://[^\s]{1,200}$'),
  -- Booking rules (null = no limit)
  max_days_ahead     integer check (max_days_ahead between 1 and 365),
  max_per_slot       integer check (max_per_slot between 1 and 500),
  allow_same_day     boolean not null default true,
  closed_dates       date[] not null default '{}',
  -- Emails
  email_on_request   boolean not null default true,  -- "we received your request" to the resident
  email_on_decision  boolean not null default true,  -- confirmed / rejected to the resident
  alert_new_requests boolean not null default false, -- new request alert to every admin
  updated_at         timestamptz not null default now()
);

-- Today's behaviour: everything on, no extra limits.
insert into public.clinic_settings default values;

-- Nothing here is private, so anyone can read it; only admin_save_settings writes it.
alter table public.clinic_settings enable row level security;
create policy "Anyone reads clinic settings" on public.clinic_settings for select to anon, authenticated using (true);
grant select on public.clinic_settings to anon, authenticated;

-- Why a resident can't book this service, date and time slot, or null if they can.
-- Security definer so it can count every booking in a slot, not just the caller's own.
create function public.booking_rule_error(p_service text, p_date date, p_slot text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  s     public.services;
  cfg   public.clinic_settings;
  today date := public.manila_today();
  taken integer;
begin
  select * into s from public.services where name = p_service;
  if not found or not s.active then return 'Please choose a service.'; end if;
  if p_date is null or p_date < today then return 'Please choose today or a future date.'; end if;
  if not (extract(isodow from p_date)::smallint = any (s.days)) then
    return format('%s isn''t offered on that day. Please choose another date.', s.name);
  end if;
  if not (p_slot = any (s.time_slots)) then
    return format('%s isn''t offered at that time. Please choose another time.', s.name);
  end if;

  select * into cfg from public.clinic_settings;
  if p_date = today and not cfg.allow_same_day then
    return 'Same-day booking is closed. Please choose a later date.';
  end if;
  if cfg.max_days_ahead is not null and p_date > today + cfg.max_days_ahead then
    return format('You can book up to %s days ahead. Please choose an earlier date.', cfg.max_days_ahead);
  end if;
  if p_date = any (cfg.closed_dates) then
    return 'The health center is closed on that day. Please choose another date.';
  end if;
  if cfg.max_per_slot is not null then
    select count(*) into taken from public.appointments
     where service = p_service and appt_date = p_date and time_slot = p_slot
       and status in ('pending', 'confirmed') and archived_at is null;
    if taken >= cfg.max_per_slot then
      return 'That time slot is fully booked. Please choose another time or date.';
    end if;
  end if;
  return null;
end $$;

revoke execute on function public.booking_rule_error(text, date, text) from public, anon;
grant execute on function public.booking_rule_error(text, date, text) to authenticated;

-- Residents' bookings must pass every rule. Replaces the service-only check from 0011.
drop policy "Residents request appointments for themselves" on public.appointments;
create policy "Residents request appointments for themselves"
  on public.appointments for insert to authenticated
  with check (
    user_id = auth.jwt() ->> 'sub'
    and public.booking_rule_error(service, appt_date, time_slot) is null
  );

-- Settings changes go in the audit log, with what changed in details.
alter table public.audit_log
  drop constraint audit_log_action_check,
  add constraint audit_log_action_check
    check (action in ('created', 'status', 'edited', 'archived', 'restored', 'deleted',
                      'role_changed', 'deactivated', 'reactivated',
                      'service_added', 'service_updated', 'settings_updated')),
  drop constraint audit_log_subject_check,
  add constraint audit_log_subject_check check (
    case
      when action in ('role_changed', 'deactivated', 'reactivated')
        then target_user_id is not null and appointment_id is null and appointment_ref is null
      when action in ('service_added', 'service_updated')
        then details ? 'service' and target_user_id is null and appointment_id is null and appointment_ref is null
      when action = 'settings_updated'
        then target_user_id is null and appointment_id is null and appointment_ref is null
      else target_user_id is null and appointment_ref is not null and new_status is not null
    end
  );

-- Saves the settings row from a JSON object of the editable fields and logs what changed.
-- Unknown keys are ignored; the table's checks validate every value.
create function public.admin_save_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  before jsonb;
  after_ jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select to_jsonb(c) - 'updated_at' - 'id' into before from public.clinic_settings c;

  update public.clinic_settings set
    clinic_name        = coalesce(p ->> 'clinic_name', clinic_name),
    address            = coalesce(p ->> 'address', address),
    clinic_days        = coalesce(p ->> 'clinic_days', clinic_days),
    clinic_hours       = coalesce(p ->> 'clinic_hours', clinic_hours),
    phone              = coalesce(p ->> 'phone', phone),
    facebook_url       = coalesce(p ->> 'facebook_url', facebook_url),
    messenger_url      = coalesce(p ->> 'messenger_url', messenger_url),
    max_days_ahead     = case when p ? 'max_days_ahead' then (p ->> 'max_days_ahead')::integer else max_days_ahead end,
    max_per_slot       = case when p ? 'max_per_slot' then (p ->> 'max_per_slot')::integer else max_per_slot end,
    allow_same_day     = coalesce((p ->> 'allow_same_day')::boolean, allow_same_day),
    closed_dates       = case when p ? 'closed_dates'
                           then array(select jsonb_array_elements_text(p -> 'closed_dates')::date order by 1)
                           else closed_dates end,
    email_on_request   = coalesce((p ->> 'email_on_request')::boolean, email_on_request),
    email_on_decision  = coalesce((p ->> 'email_on_decision')::boolean, email_on_decision),
    alert_new_requests = coalesce((p ->> 'alert_new_requests')::boolean, alert_new_requests),
    updated_at         = now()
  where id;

  select to_jsonb(c) - 'updated_at' - 'id' into after_ from public.clinic_settings c;
  if before is distinct from after_ then
    insert into public.audit_log (action, details, actor_id, actor_role)
    values ('settings_updated',
            jsonb_build_object('changes', (select jsonb_object_agg(o.key, jsonb_build_object('from', o.value, 'to', n.value))
                                             from jsonb_each(before) o join jsonb_each(after_) n on n.key = o.key
                                            where o.value is distinct from n.value)),
            auth.jwt() ->> 'sub', 'admin');
  end if;
end $$;

revoke execute on function public.admin_save_settings(jsonb) from public, anon;
grant execute on function public.admin_save_settings(jsonb) to authenticated;
