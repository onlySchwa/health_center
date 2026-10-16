-- Track the confirmation email sent when an admin confirms a request.
-- Run once in Supabase → SQL Editor, after 0006_booking_contact_fields.sql.
-- (Recovered from the project's applied-migration history on 2026-10-17.)

alter table public.appointments
  add column confirmation_email_status   text check (confirmation_email_status in ('sent', 'failed', 'no_email')),
  add column confirmation_email_attempts integer not null default 0,
  add column confirmation_email_error    text check (char_length(confirmation_email_error) <= 300),
  add column confirmation_email_sent_at  timestamptz;

create function public.admin_record_confirmation_email(p_id bigint, p_status text, p_error text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.appointments
     set confirmation_email_status   = p_status,
         confirmation_email_attempts = confirmation_email_attempts + case when p_status = 'failed' then 1 else 0 end,
         confirmation_email_error    = case when p_status = 'sent' then null else left(p_error, 300) end,
         confirmation_email_sent_at  = case when p_status = 'sent' then now() end
   where id = p_id
     and status = 'confirmed'
     and confirmation_email_status is distinct from 'sent';
end $$;

revoke execute on function public.admin_record_confirmation_email(bigint, text, text) from public, anon;
grant execute on function public.admin_record_confirmation_email(bigint, text, text) to authenticated;
