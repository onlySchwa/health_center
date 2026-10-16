-- Email residents when a request is rejected too, not only confirmed.
-- Run once in Supabase → SQL Editor, after 0007_confirmation_emails.sql.
-- (Recovered from the project's applied-migration history on 2026-10-17.)

alter table public.appointments rename column confirmation_email_status   to email_status;
alter table public.appointments rename column confirmation_email_attempts to email_attempts;
alter table public.appointments rename column confirmation_email_error    to email_error;
alter table public.appointments rename column confirmation_email_sent_at  to email_sent_at;

alter table public.appointments
  add column email_for text check (email_for in ('confirmed', 'rejected'));

update public.appointments set email_for = 'confirmed' where email_status is not null;

drop function public.admin_record_confirmation_email(bigint, text, text);

create function public.admin_record_status_email(p_id bigint, p_for text, p_status text, p_error text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
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

revoke execute on function public.admin_record_status_email(bigint, text, text, text) from public, anon;
grant execute on function public.admin_record_status_email(bigint, text, text, text) to authenticated;
