-- Baan Health Care: appointments table and access rules.
-- Run once in Supabase → SQL Editor. Requires the Clerk third-party auth
-- integration (see README) so auth.jwt() holds the Clerk session token.
--
-- Who can do what (enforced by the database, not just the app):
--   Residents: request (insert), see their own, cancel their own pending/confirmed.
--   Staff:     see appointments for their assigned services only, and mark
--              them completed or missed. Nothing else can be changed.
--   Nobody:    can delete through the API.

create table public.appointments (
  id            bigint generated always as identity primary key,
  ref           text generated always as ('BHC-' || lpad(id::text, 6, '0')) stored unique,
  user_id       text not null default (auth.jwt() ->> 'sub'),
  resident_name text not null check (char_length(resident_name) between 2 and 100),
  phone         text not null check (char_length(phone) between 7 and 20),
  service       text not null check (service in (
                  'General consultation', 'Child immunization', 'Prenatal & maternal care',
                  'Family planning', 'BP & blood sugar check', 'Medicine & referrals')),
  appt_date     date not null,
  time_slot     text not null check (time_slot in ('Morning (8 AM – 12 NN)', 'Afternoon (1 PM – 5 PM)')),
  note          text check (char_length(note) <= 500),
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'completed', 'missed', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create index appointments_user_id_idx on public.appointments (user_id);
create index appointments_service_date_idx on public.appointments (service, appt_date);

-- Health center's local date (the database clock is UTC).
create function public.manila_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Manila')::date $$;

-- True when the signed-in Clerk user is staff assigned to this service.
-- Role and services come from the user's Clerk public metadata.
create function public.is_staff_for(svc text) returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'metadata' ->> 'role', '') = 'staff'
     and coalesce(auth.jwt() -> 'metadata' -> 'services', '[]'::jsonb) ? svc
$$;

-- Record who changed a row and when.
create function public.stamp_appointment_update() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'sub';
  return new;
end $$;

create trigger appointments_stamp_update
  before update on public.appointments
  for each row execute function public.stamp_appointment_update();

-- Column-level privileges: only these columns can ever be written, and no deletes.
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant insert (resident_name, phone, service, appt_date, time_slot, note) on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;

alter table public.appointments enable row level security;

create policy "Residents see their own appointments"
  on public.appointments for select to authenticated
  using (user_id = auth.jwt() ->> 'sub');

create policy "Staff see appointments for their services"
  on public.appointments for select to authenticated
  using (public.is_staff_for(service));

create policy "Residents request appointments for themselves"
  on public.appointments for insert to authenticated
  with check (user_id = auth.jwt() ->> 'sub' and appt_date >= public.manila_today());

create policy "Residents cancel their own open appointments"
  on public.appointments for update to authenticated
  using (user_id = auth.jwt() ->> 'sub' and status in ('pending', 'confirmed'))
  with check (user_id = auth.jwt() ->> 'sub' and status = 'cancelled');

create policy "Staff mark due appointments completed or missed"
  on public.appointments for update to authenticated
  using (public.is_staff_for(service) and status in ('pending', 'confirmed') and appt_date <= public.manila_today())
  with check (public.is_staff_for(service) and status in ('completed', 'missed'));
