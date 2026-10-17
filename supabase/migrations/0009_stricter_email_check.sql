-- Stricter email format: letters, digits and . _ % + - before the @, a real domain after it,
-- and an ending of 2+ letters (.com, .ph). Must match the check in lib/actions.ts.
-- Run once in Supabase → SQL Editor, after 0008_status_emails.sql.

alter table public.appointments
  drop constraint appointments_email_check,
  add constraint appointments_email_check check (
    char_length(email) <= 254
    and email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$'
  );
