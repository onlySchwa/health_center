-- Retire the "BP & blood sugar check" and "Medicine & referrals" services.
-- Run once in Supabase → SQL Editor, after 0001_appointments.sql.
-- Existing appointments under those services are moved to General consultation.

begin;

update public.appointments
   set service = 'General consultation'
 where service in ('BP & blood sugar check', 'Medicine & referrals');

alter table public.appointments drop constraint appointments_service_check;

alter table public.appointments add constraint appointments_service_check
  check (service in (
    'General consultation', 'Child immunization', 'Prenatal & maternal care', 'Family planning'));

commit;
