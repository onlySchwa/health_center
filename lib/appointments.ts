import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Status } from "@/lib/appointment-options";
import { createSupabase } from "@/lib/supabase";

export function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

export function formatApptDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00+08:00`);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", ...opts }).format(date);
  return { day: part({ day: "2-digit" }), month: part({ month: "short" }), weekday: part({ weekday: "long" }) };
}

// Staff = role "staff" in the user's Clerk public metadata. Returns null for everyone else.
export async function getStaffAccess() {
  const { userId, sessionClaims } = await auth();
  const meta = sessionClaims?.metadata;
  if (!userId || meta?.role !== "staff") return null;
  return { services: Array.isArray(meta.services) ? meta.services : [] };
}

export type ResidentAppointment = {
  id: number;
  ref: string;
  service: string;
  appt_date: string;
  time_slot: string;
  status: Status;
};

export async function getMyAppointments(): Promise<ResidentAppointment[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const { data, error } = await createSupabase()
    .from("appointments")
    .select("id, ref, service, appt_date, time_slot, status")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("appt_date", { ascending: false });
  if (error) throw new Error(`Could not load appointments: ${error.message}`);
  return data;
}

// Only the fields staff need for their duties: no email, no account ID.
export type StaffAppointment = ResidentAppointment & {
  resident_name: string;
  phone: string;
  note: string | null;
};

export type StaffView = "today" | "upcoming" | "all";

export async function getStaffAppointments(services: string[], view: StaffView, search: string) {
  const today = manilaToday();
  let query = createSupabase()
    .from("appointments")
    .select("id, ref, resident_name, phone, service, appt_date, time_slot, note, status")
    .in("service", services)
    .is("archived_at", null);

  if (view === "today") query = query.eq("appt_date", today);
  if (view === "upcoming") query = query.gte("appt_date", today).in("status", ["pending", "confirmed"]);

  // Letters, digits, spaces and hyphens only, so the text can't alter the filter.
  const term = search.replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 60);
  if (term) query = query.or(`resident_name.ilike."%${term}%",ref.ilike."%${term}%"`);

  const { data, error } = await query
    .order("appt_date", { ascending: view !== "all" })
    .order("time_slot")
    .limit(200);
  if (error) throw new Error(`Could not load appointments: ${error.message}`);
  return data as StaffAppointment[];
}

export async function getStaffCounts(services: string[]) {
  const today = manilaToday();
  const base = () =>
    createSupabase()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .in("service", services)
      .is("archived_at", null);

  const results = await Promise.all([
    base().eq("appt_date", today).not("status", "in", "(cancelled,rejected)"),
    base().eq("appt_date", today).eq("status", "completed"),
    base().eq("appt_date", today).eq("status", "missed"),
    base().gte("appt_date", today).in("status", ["pending", "confirmed"]),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load counts: ${failed.error.message}`);

  const [todayTotal, completedToday, missedToday, upcomingOpen] = results.map((r) => r.count ?? 0);
  return { todayTotal, completedToday, missedToday, upcomingOpen };
}
