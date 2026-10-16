-- Admins can edit appointment details, set any status, archive/restore, and permanently delete.
-- Run once in Supabase → SQL Editor, after 0004_rejected_status.sql.
--
-- These go through admin-only functions instead of wider column grants: row-level security
-- can't limit columns, so granting update on details would let residents and staff edit them too.
-- Every change, including a delete, is written to audit_log, which keeps the history of
-- deleted appointments (appointment_ref plus a snapshot in details).

alter table public.appointments add column archived_at timestamptz;

-- Audit log: what kind of change, what changed, and which appointment even after it's deleted.
alter table public.audit_log
  add column action text,
  add column appointment_ref text,
  add column details jsonb;

update public.audit_log l
   set action = case when l.old_status is null then 'created' else 'status' end,
       appointment_ref = a.ref
  from public.appointments a
 where a.id = l.appointment_id;

alter table public.audit_log
  alter column action set not null,
  add constraint audit_log_action_check
    check (action in ('created', 'status', 'edited', 'archived', 'restored', 'deleted')),
  alter column appointment_ref set not null,
  alter column appointment_id drop not null;

alter table public.audit_log drop constraint audit_log_appointment_id_fkey;
alter table public.audit_log add constraint audit_log_appointment_id_fkey
  foreign key (appointment_id) references public.appointments (id) on delete set null;

-- One trigger for every kind of change.
drop trigger appointments_log_insert on public.appointments;
drop trigger appointments_log_status on public.appointments;

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
            jsonb_build_object('resident_name', old.resident_name, 'phone', old.phone, 'service', old.service,
                               'appt_date', old.appt_date, 'time_slot', old.time_slot, 'note', old.note),
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
     where o.key in ('resident_name', 'phone', 'service', 'appt_date', 'time_slot', 'note')
       and o.value is distinct from n.value;

    if changes is not null then
      insert into public.audit_log (appointment_id, appointment_ref, action, new_status, details, actor_id, actor_role)
      values (new.id, new.ref, 'edited', new.status, changes, actor, v_role);
    end if;
  end if;
  return null;
end $$;

create trigger appointments_log_change
  after insert or update or delete on public.appointments
  for each row execute function public.log_appointment_change();

-- Admin-only operations. Each checks the caller is an admin; the table's check
-- constraints still validate every value.
create function public.admin_update_appointment(
  p_id bigint, p_resident_name text, p_phone text, p_service text,
  p_appt_date date, p_time_slot text, p_note text, p_status text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.appointments
     set resident_name = p_resident_name, phone = p_phone, service = p_service, appt_date = p_appt_date,
         time_slot = p_time_slot, note = p_note, status = p_status
   where id = p_id;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
end $$;

create function public.admin_set_archived(p_id bigint, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.appointments
     set archived_at = case when p_archived then now() end
   where id = p_id;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
end $$;

create function public.admin_delete_appointment(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.appointments where id = p_id;
  if not found then raise exception 'appointment not found' using errcode = 'P0002'; end if;
end $$;

revoke execute on function public.admin_update_appointment(bigint, text, text, text, date, text, text, text) from public, anon;
revoke execute on function public.admin_set_archived(bigint, boolean) from public, anon;
revoke execute on function public.admin_delete_appointment(bigint) from public, anon;
grant execute on function public.admin_update_appointment(bigint, text, text, text, date, text, text, text) to authenticated;
grant execute on function public.admin_set_archived(bigint, boolean) to authenticated;
grant execute on function public.admin_delete_appointment(bigint) to authenticated;
