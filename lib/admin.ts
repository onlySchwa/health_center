import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { Status } from "@/lib/appointment-options";
import { manilaToday, type StaffAppointment } from "@/lib/appointments";
import { createSupabase } from "@/lib/supabase";

// Admin = role "admin" in the user's Clerk public metadata.
export async function isAdmin() {
  const { userId, sessionClaims } = await auth();
  return Boolean(userId) && sessionClaims?.metadata?.role === "admin";
}

// Registered residents = every Clerk account without a staff or admin role.
async function listResidentUsers() {
  const client = await clerkClient();
  const residents = [];
  for (let offset = 0; ; offset += 500) {
    const { data, totalCount } = await client.users.getUserList({ limit: 500, offset });
    residents.push(...data.filter((u) => !u.publicMetadata.role));
    if (data.length === 0 || offset + data.length >= totalCount) return residents;
  }
}

const countResidents = async () => (await listResidentUsers()).length;

export type Resident = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  joinedAt: number;
  lastSignInAt: number | null;
  banned: boolean;
  // Another account has the same name or mobile number. Clerk already blocks a second account per email.
  possibleDuplicate: boolean;
};

// Only plain fields leave this function, never the full Clerk user object.
export async function getResidents(): Promise<Resident[]> {
  const users = await listResidentUsers();
  // Keys for spotting the same person twice; empty when the account has no name or phone.
  const nameKey = (u: (typeof users)[number]) => (u.fullName ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const phoneKey = (u: (typeof users)[number]) => u.primaryPhoneNumber?.phoneNumber.replace(/\D/g, "") ?? "";
  const seen = new Map<string, number>();
  for (const u of users) {
    for (const key of [`n:${nameKey(u)}`, `p:${phoneKey(u)}`]) {
      if (key.length > 2) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  const isShared = (key: string) => key.length > 2 && seen.get(key)! > 1;

  return users
    .map((u) => ({
      id: u.id,
      name: u.fullName?.trim() || u.primaryEmailAddress?.emailAddress || "Unnamed account",
      email: u.primaryEmailAddress?.emailAddress ?? null,
      phone: u.primaryPhoneNumber?.phoneNumber ?? null,
      joinedAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      banned: u.banned,
      possibleDuplicate: isShared(`n:${nameKey(u)}`) || isShared(`p:${phoneKey(u)}`),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type ResidentAppointmentRow = Pick<
  AdminAppointment,
  "id" | "ref" | "service" | "appt_date" | "time_slot" | "status" | "phone" | "address" | "archived_at"
>;

// Every appointment the resident booked, archived ones included, newest first.
export async function getResidentAppointments(userId: string) {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select("id, ref, service, appt_date, time_slot, status, phone, address, archived_at")
    .eq("user_id", userId)
    .order("appt_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load the resident's appointments: ${error.message}`);
  return data as ResidentAppointmentRow[];
}

// Number of appointments per resident (user id), for the residents list.
export async function getAppointmentCountsByResident() {
  const { data, error } = await createSupabase().from("appointments").select("user_id").limit(10000);
  if (error) throw new Error(`Could not count appointments: ${error.message}`);
  const counts = new Map<string, number>();
  for (const { user_id } of data) if (user_id) counts.set(user_id, (counts.get(user_id) ?? 0) + 1);
  return counts;
}

export const formatTimestamp = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

const statuses: Status[] = ["pending", "confirmed", "completed", "missed", "rejected", "cancelled"];

// Count of non-archived appointments, to narrow down with filters.
const countAppointments = () =>
  createSupabase().from("appointments").select("id", { count: "exact", head: true }).is("archived_at", null);

// Upcoming confirmed/rejected appointments whose email to the resident didn't go out.
const countUnsentEmails = () =>
  countAppointments()
    .in("status", ["confirmed", "rejected"])
    .gte("appt_date", manilaToday())
    .in("email_status", ["failed", "no_email"]);

export async function getUnsentEmailCount() {
  const { count, error } = await countUnsentEmails();
  if (error) throw new Error(`Could not load unsent email count: ${error.message}`);
  return count ?? 0;
}

export async function getAdminCounts() {
  const [residents, todayResult, unsentResult, ...statusResults] = await Promise.all([
    countResidents(),
    countAppointments().eq("appt_date", manilaToday()).not("status", "in", "(cancelled,rejected)"),
    countUnsentEmails(),
    ...statuses.map((s) => countAppointments().eq("status", s)),
  ]);
  const failed = [todayResult, unsentResult, ...statusResults].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load counts: ${failed.error.message}`);

  const byStatus = Object.fromEntries(statuses.map((s, i) => [s, statusResults[i].count ?? 0])) as Record<Status, number>;
  return {
    residents,
    today: todayResult.count ?? 0,
    pending: byStatus.pending,
    unsentEmails: unsentResult.count ?? 0,
    byStatus,
  };
}

export type UpcomingAppointment = Pick<
  StaffAppointment,
  "id" | "ref" | "resident_name" | "service" | "appt_date" | "time_slot" | "status"
>;

// Open (pending or confirmed) appointments from today on, soonest first.
export async function getUpcomingAppointments() {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select("id, ref, resident_name, service, appt_date, time_slot, status")
    .is("archived_at", null)
    .in("status", ["pending", "confirmed"])
    .gte("appt_date", manilaToday())
    .order("appt_date")
    .order("time_slot")
    .limit(200);
  if (error) throw new Error(`Could not load upcoming appointments: ${error.message}`);
  return data as UpcomingAppointment[];
}

export type AdminAppointment = StaffAppointment & {
  first_name: string;
  last_name: string;
  email: string | null;
  address: string | null;
  email_for: "confirmed" | "rejected" | null;
  email_status: "sent" | "failed" | "no_email" | null;
  email_error: string | null;
  updated_at: string;
  archived_at: string | null;
};

const adminColumns =
  "id, ref, resident_name, first_name, last_name, email, phone, address, service, appt_date, time_slot, note, status, email_for, email_status, email_error, updated_at, archived_at";

// Filters on the confirmed/rejected email: "failed" includes appointments with no address to send to.
export type EmailFilter = "failed" | "sent" | "none";

// "pending" = requests waiting for review; "history" = every appointment, newest first;
// "archived" = appointments an admin has hidden from everyone else.
export async function getAdminAppointments(tab: "pending" | "history" | "archived", search: string, email?: EmailFilter) {
  let query = createSupabase().from("appointments").select(adminColumns);

  query = tab === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (tab === "pending") query = query.eq("status", "pending");
  if (email === "failed") query = query.in("email_status", ["failed", "no_email"]);
  if (email === "sent") query = query.eq("email_status", "sent");
  if (email === "none") query = query.is("email_status", null);

  // Letters, digits, spaces and hyphens only, so the text can't alter the filter.
  const term = search.replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 60);
  if (term) query = query.or(`resident_name.ilike."%${term}%",ref.ilike."%${term}%"`);

  const { data, error } = await query
    .order("appt_date", { ascending: tab === "pending" })
    .order("time_slot")
    .limit(200);
  if (error) throw new Error(`Could not load appointments: ${error.message}`);
  return data as AdminAppointment[];
}

export type AppointmentDetail = AdminAppointment & {
  created_at: string;
  email_attempts: number;
  email_sent_at: string | null;
};

// One appointment, archived or not, for the details panel. null if it doesn't exist.
export async function getAdminAppointment(id: number) {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select(`${adminColumns}, created_at, email_attempts, email_sent_at`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load appointment ${id}: ${error.message}`);
  return data as AppointmentDetail | null;
}

export type ActivityEntry = {
  id: number;
  action: "created" | "status" | "edited" | "archived" | "restored" | "deleted";
  old_status: Status | null;
  new_status: Status;
  // "edited": { field: { from, to } }. "deleted": a snapshot of the appointment's details.
  details: Record<string, unknown> | null;
  actor_role: "resident" | "staff" | "admin" | "system";
  actor_name: string;
  created_at: string;
  appointment_ref: string;
  // null once the appointment has been deleted.
  appointment: { resident_name: string; service: string } | null;
};

// Latest 100 entries, so at most 100 distinct people to look up in Clerk (its per-call limit).
// With appointmentId: that appointment's history, oldest first.
export async function getActivityLog({ staffOnly = false, appointmentId }: { staffOnly?: boolean; appointmentId?: number } = {}): Promise<ActivityEntry[]> {
  let query = createSupabase()
    .from("audit_log")
    .select(
      "id, action, old_status, new_status, details, actor_id, actor_role, created_at, appointment_ref, appointment:appointments(resident_name, service)",
    );
  if (staffOnly) query = query.in("actor_role", ["staff", "admin"]);
  if (appointmentId !== undefined) query = query.eq("appointment_id", appointmentId);

  const { data, error } = await query.order("created_at", { ascending: appointmentId !== undefined }).limit(100);
  if (error) throw new Error(`Could not load activity log: ${error.message}`);

  const ids = [...new Set(data.map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const client = await clerkClient();
    const { data: users } = await client.users.getUserList({ userId: ids, limit: 100 });
    for (const u of users) {
      names.set(u.id, u.fullName || u.primaryEmailAddress?.emailAddress || u.id);
    }
  }

  return data.map(({ actor_id, appointment, ...row }) => ({
    ...row,
    actor_name: actor_id ? (names.get(actor_id) ?? "Deleted account") : "Supabase (manual edit)",
    appointment: appointment as unknown as ActivityEntry["appointment"],
  })) as ActivityEntry[];
}
