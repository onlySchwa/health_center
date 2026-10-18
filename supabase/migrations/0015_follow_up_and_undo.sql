-- Staff book a resident's next visit from a completed one, and undo their own completed/missed mark
-- within 10 minutes. Run once in Supabase → SQL Editor, after 0014_staff_review.sql.

begin;

-- The visit a follow-up was booked from (e.g. dose 2 follows dose 1). Empty for ordinary bookings.
alter table public.appointments
  add column follow_up_of bigint references public.appointments (id);

create index appointments_follow_up_of_idx on public.appointments (follow_up_of) where follow_up_of is not null;

-- The status trigger from 0014 guards staff's direct updates. The functions below run as their
-- owner and do their own, stricter checks, so the trigger leaves those updates to them.
create or replace function public.check_staff_status_change() returns trigger
language plpgsql set search_path = '' as $$
declare
  today date := public.manila_today();
begin
  if current_user <> 'authenticated' or coalesce(auth.jwt() -> 'metadata' ->> 'role', '') <> 'staff' then
    return new;
  end if;
  if (old.status = 'pending' and new.status = 'confirmed' and new.appt_date >= today)
     or (old.status = 'pending' and new.status = 'rejected')
     or (old.status in ('pending', 'confirmed') and new.status in ('completed', 'missed') and new.appt_date <= today)
     or (old.status in ('pending', 'confirmed') and new.status = 'cancelled' and old.user_id = auth.jwt() ->> 'sub') then
    return new;
  end if;
  raise exception 'Staff can''t change this appointment from % to %.', old.status, new.status using errcode = '42501';
end $$;

-- Books the next visit for the resident of completed appointment p_from, in the same service.
-- Saved as confirmed (the resident is there to agree on it), after the usual booking rules.
-- The insert is logged as "created" by the staff member (log_appointment_change).
create function public.staff_book_follow_up(p_from bigint, p_date date, p_slot text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  src     public.appointments;
  problem text;
  new_id  bigint;
begin
  select * into src from public.appointments where id = p_from and archived_at is null;
  if not found or not public.is_staff_for(src.service) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if src.status <> 'completed' then
    raise exception 'Only a completed visit can have a follow-up.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.appointments
              where follow_up_of = p_from and status in ('pending', 'confirmed') and archived_at is null) then
    raise exception 'A follow-up is already booked for this visit.' using errcode = 'P0001';
  end if;
  problem := public.booking_rule_error(src.service, p_date, p_slot);
  if problem is not null then
    raise exception '%', problem using errcode = 'P0001';
  end if;

  insert into public.appointments
    (user_id, first_name, last_name, email, phone, address, service, appt_date, time_slot, status, follow_up_of)
  values
    (src.user_id, src.first_name, src.last_name, src.email, src.phone, src.address, src.service, p_date, p_slot,
     'confirmed', p_from)
  returning id into new_id;
  return new_id;
end $$;

-- Puts a completed/missed appointment back to what it was, if the caller made that mark
-- in the last 10 minutes and nothing has changed it since. Logged as a status change.
create function public.staff_undo_mark(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a    public.appointments;
  last public.audit_log;
begin
  select * into a from public.appointments where id = p_id and archived_at is null;
  if not found or not public.is_staff_for(a.service) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into last from public.audit_log
   where appointment_id = p_id and action = 'status'
   order by created_at desc, id desc limit 1;
  if last.id is null
     or last.actor_id is distinct from auth.jwt() ->> 'sub'
     or last.new_status is distinct from a.status
     or a.status not in ('completed', 'missed')
     or last.old_status not in ('pending', 'confirmed')
     or last.created_at < now() - interval '10 minutes' then
    raise exception 'This mark can no longer be undone. Ask an administrator to correct it.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.appointments
              where follow_up_of = p_id and status in ('pending', 'confirmed') and archived_at is null) then
    raise exception 'A follow-up was booked from this visit. Ask an administrator to cancel it first.' using errcode = 'P0001';
  end if;

  update public.appointments set status = last.old_status where id = p_id;
end $$;

revoke all on function public.staff_book_follow_up(bigint, date, text) from public, anon;
revoke all on function public.staff_undo_mark(bigint) from public, anon;
grant execute on function public.staff_book_follow_up(bigint, date, text) to authenticated;
grant execute on function public.staff_undo_mark(bigint) to authenticated;

commit;
