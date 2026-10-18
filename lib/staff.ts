import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Status } from "@/lib/appointment-options";
import { manilaToday, type StaffAppointment } from "@/lib/appointments";
import { createSupabase } from "@/lib/supabase";

// Data for the staff pages. Every query is also limited by row-level security to the staff
// member's own services ("Staff see appointments for their services", 0001_appointments.sql).

const DAY = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDaysIso = (iso: string, days: number) => toIso(toMs(iso) + days * DAY);
export const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toMs(v));
// ISO weekday, 1 = Monday … 7 = Sunday (matches services.days).
export const isoWeekday = (iso: string) => new Date(toMs(iso)).getUTCDay() || 7;
export const weekStart = (iso: string) => addDaysIso(iso, 1 - isoWeekday(iso));

// Requests and confirmed visits hold a slot; the rest are history.
export const holdsSlot = (status: Status) => status === "pending" || status === "confirmed";

// user_id stays on the server: it's only used to group a resident's bookings, never rendered.
export type ScheduleRow = StaffAppointment & { user_id: string };

const scheduleColumns =
  "id, ref, user_id, resident_name, email, phone, address, service, appt_date, time_slot, note, status, follow_up_of";

// Non-archived appointments for the staff member's services between two dates (inclusive).
export async function getStaffSchedule(services: string[], from: string, to: string) {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select(scheduleColumns)
    .in("service", services)
    .is("archived_at", null)
    .gte("appt_date", from)
    .lte("appt_date", to)
    .order("appt_date")
    .order("time_slot")
    .limit(2000);
  if (error) throw new Error(`Could not load the schedule: ${error.message}`);
  return data as ScheduleRow[];
}

// IDs of open bookings where the same resident holds two or more on the same day and time slot.
export function findOverlaps(rows: ScheduleRow[]) {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!holdsSlot(r.status)) continue;
    const key = `${r.user_id}|${r.appt_date}|${r.time_slot}`;
    groups.set(key, [...(groups.get(key) ?? []), r.id]);
  }
  return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
}

export const UNDO_MINUTES = 10; // must match staff_undo_mark (0015_follow_up_and_undo.sql)

// For the rows on screen: which completed visits already have an open follow-up, and which
// completed/missed marks the current staff member made recently enough to undo (until when).
// The database functions check both again; this only decides which buttons to show.
export async function getStaffRowState(rows: { id: number; status: Status }[]) {
  const ids = rows.map((r) => r.id);
  const withFollowUp = new Set<number>();
  const undoUntil = new Map<number, string>();
  if (ids.length === 0) return { withFollowUp, undoUntil };

  const supabase = createSupabase();
  const { userId } = await auth();
  const since = new Date(Date.now() - UNDO_MINUTES * 60_000).toISOString();
  const [followUps, marks] = await Promise.all([
    supabase.from("appointments").select("follow_up_of").in("follow_up_of", ids).in("status", ["pending", "confirmed"]).is("archived_at", null),
    supabase
      .from("audit_log")
      .select("appointment_id, new_status, actor_id, created_at")
      .in("appointment_id", ids)
      .eq("action", "status")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
  ]);
  if (followUps.error) throw new Error(`Could not load follow-ups: ${followUps.error.message}`);
  if (marks.error) throw new Error(`Could not load recent marks: ${marks.error.message}`);

  for (const f of followUps.data) withFollowUp.add(f.follow_up_of as number);
  const status = new Map(rows.map((r) => [r.id, r.status]));
  const latest = new Set<number>();
  for (const m of marks.data) {
    if (latest.has(m.appointment_id)) continue; // newest first: only the latest change counts
    latest.add(m.appointment_id);
    const current = status.get(m.appointment_id);
    if (m.actor_id === userId && m.new_status === current && (current === "completed" || current === "missed")) {
      undoUntil.set(m.appointment_id, new Date(Date.parse(m.created_at) + UNDO_MINUTES * 60_000).toISOString());
    }
  }
  return { withFollowUp, undoUntil };
}

export type StaffResident = {
  ref: string; // their latest appointment, used to open the profile without exposing the account ID
  name: string;
  email: string | null;
  phone: string | null;
  visits: number;
  completed: number;
  lastVisit: string | null; // last completed visit
  nextVisit: string | null; // next open booking
};

// Residents who booked one of the staff member's services, newest booking first per resident.
export async function getStaffResidents(services: string[]): Promise<StaffResident[]> {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select("ref, user_id, resident_name, email, phone, appt_date, status")
    .in("service", services)
    .is("archived_at", null) // archived records are hidden from staff, as on Appointments
    .order("appt_date", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Could not load residents: ${error.message}`);

  const today = manilaToday();
  const byResident = new Map<string, StaffResident>();
  for (const a of data as (Pick<ScheduleRow, "ref" | "user_id" | "resident_name" | "email" | "phone" | "appt_date" | "status">)[]) {
    let r = byResident.get(a.user_id);
    if (!r) {
      r = { ref: a.ref, name: a.resident_name, email: a.email, phone: a.phone, visits: 0, completed: 0, lastVisit: null, nextVisit: null };
      byResident.set(a.user_id, r);
    }
    r.visits += 1;
    if (a.status === "completed") {
      r.completed += 1;
      r.lastVisit ??= a.appt_date; // rows are newest first
    }
    if (holdsSlot(a.status) && a.appt_date >= today) r.nextVisit = a.appt_date; // ends on the soonest
  }
  return [...byResident.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Every appointment, in the staff member's services, of the resident who owns appointment `ref`.
export async function getStaffResidentHistory(services: string[], ref: string) {
  const supabase = createSupabase();
  const { data: owner, error } = await supabase
    .from("appointments")
    .select("user_id")
    .in("service", services)
    .is("archived_at", null)
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw new Error(`Could not load the resident: ${error.message}`);
  if (!owner) return null;

  const { data, error: historyError } = await supabase
    .from("appointments")
    .select("id, ref, resident_name, email, phone, address, service, appt_date, time_slot, note, status, follow_up_of")
    .in("service", services)
    .is("archived_at", null)
    .eq("user_id", owner.user_id)
    .order("appt_date", { ascending: false })
    .limit(200);
  if (historyError) throw new Error(`Could not load the resident's appointments: ${historyError.message}`);
  return data as StaffAppointment[];
}

export type StaffNotice = {
  kind: "request" | "update" | "email" | "schedule";
  title: string;
  text: string;
  at: string | null; // ISO timestamp, for sorting and display
  href?: string;
};

type AuditEntry = {
  appointment_id: number;
  appointment_ref: string | null;
  action: "status" | "edited";
  new_status: Status | null;
  details: Record<string, { from: unknown; to: unknown }> | null;
  actor_id: string | null;
  actor_role: "resident" | "staff" | "admin" | "system";
  created_at: string;
};

// Recent activity in the staff member's services, newest first: new requests; confirmations,
// rejections, cancellations and reschedules (exact, from the audit log; 0014_staff_review.sql);
// failed emails and visits on closed dates.
export async function getStaffNotices(services: string[], closedDates: string[]): Promise<StaffNotice[]> {
  const supabase = createSupabase();
  const { userId } = await auth();
  const today = manilaToday();
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const base = () =>
    supabase
      .from("appointments")
      .select("id, ref, resident_name, service, appt_date, time_slot, status, created_at, updated_at")
      .in("service", services)
      .is("archived_at", null);

  const [audit, ...results] = await Promise.all([
    supabase
      .from("audit_log")
      .select("appointment_id, appointment_ref, action, new_status, details, actor_id, actor_role, created_at")
      .in("action", ["status", "edited"])
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(60),
    // Same requests as Appointments → Requests: still pending and not yet past.
    base().eq("status", "pending").gte("appt_date", today).gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(30),
    base().eq("email_status", "failed").gte("appt_date", today).limit(30),
    closedDates.some((d) => d >= today)
      ? base().in("appt_date", closedDates.filter((d) => d >= today)).in("status", ["pending", "confirmed"]).limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const failed = [audit, ...results].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load notifications: ${failed.error.message}`);
  type Row = { id: number; ref: string; resident_name: string; service: string; appt_date: string; time_slot: string; status: Status; created_at: string; updated_at: string };
  const [requests, emails, onClosedDays] = results.map((r) => (r.data ?? []) as Row[]);

  // Decisions, cancellations and date/time changes. Completed/missed marks are staff's own work, so they're left out.
  const entries = ((audit.data ?? []) as AuditEntry[]).filter((e) =>
    e.action === "status"
      ? e.new_status === "confirmed" || e.new_status === "rejected" || e.new_status === "cancelled"
      : Boolean(e.details?.appt_date || e.details?.time_slot),
  );
  const ids = [...new Set(entries.map((e) => e.appointment_id))];
  const { data: changed, error: changedError } = ids.length
    ? await base().in("id", ids)
    : { data: [], error: null };
  if (changedError) throw new Error(`Could not load notifications: ${changedError.message}`);
  const byId = new Map((changed as Row[]).map((a) => [a.id, a]));
  const actors = { resident: "the resident", staff: "a staff member", admin: "an admin", system: "the system" };
  const by = (e: AuditEntry) => (e.actor_id && e.actor_id === userId ? "you" : actors[e.actor_role]);

  const when = (a: Pick<Row, "service" | "appt_date" | "time_slot">) => `${a.service} · ${a.appt_date} · ${a.time_slot.split(" (")[0]}`;
  const updates = entries.flatMap((e): StaffNotice[] => {
    const a = byId.get(e.appointment_id); // missing when archived since
    if (!a) return [];
    if (e.action === "status") {
      return [{ kind: "update" as const, title: `${a.resident_name}'s appointment was ${e.new_status} by ${by(e)}`, text: `${a.ref} · ${when(a)}`, at: e.created_at }];
    }
    const from = { ...a, appt_date: String(e.details?.appt_date?.from ?? a.appt_date), time_slot: String(e.details?.time_slot?.from ?? a.time_slot) };
    const to = { ...a, appt_date: String(e.details?.appt_date?.to ?? a.appt_date), time_slot: String(e.details?.time_slot?.to ?? a.time_slot) };
    return [{
      kind: "schedule" as const,
      title: `${a.resident_name}'s visit was rescheduled by ${by(e)}`,
      text: `${a.ref} · ${from.appt_date} ${from.time_slot.split(" (")[0]} → ${to.appt_date} ${to.time_slot.split(" (")[0]}`,
      at: e.created_at,
      href: `/staff/schedule?date=${to.appt_date}`,
    }];
  });
  return [
    ...onClosedDays.map((a) => ({
      kind: "schedule" as const,
      title: `${a.ref} is booked on a closed day`,
      text: `${a.resident_name} · ${when(a)}. Contact the resident to reschedule.`,
      at: null,
      href: `/staff/schedule?date=${a.appt_date}`,
    })),
    ...emails.map((a) => ({
      kind: "email" as const,
      title: `Email to ${a.resident_name} failed`,
      text: `${a.ref} · ${when(a)}. The resident may not know their request was ${a.status}.`,
      at: a.updated_at,
    })),
    ...requests.map((a) => ({
      kind: "request" as const,
      title: `New request from ${a.resident_name}`,
      text: `${a.ref} · ${when(a)}`,
      at: a.created_at,
      href: "/staff/appointments?view=requests",
    })),
    ...updates,
    // Closed-day problems (no timestamp) stay on top; the rest newest first.
  ].sort((a, b) => (a.at ?? "9999").localeCompare(b.at ?? "9999") * -1);
}
