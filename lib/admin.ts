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

async function listAllUsers() {
  const client = await clerkClient();
  const users = [];
  for (let offset = 0; ; offset += 500) {
    const { data, totalCount } = await client.users.getUserList({ limit: 500, offset });
    users.push(...data);
    if (data.length === 0 || offset + data.length >= totalCount) return users;
  }
}

// Registered residents = every Clerk account without a staff or admin role.
const listResidentUsers = async () => (await listAllUsers()).filter((u) => !u.publicMetadata.role);

export type AccountRole = "resident" | "staff" | "admin";

export type Account = {
  id: string;
  name: string;
  email: string | null;
  role: AccountRole;
  // Services a staff member handles; empty for everyone else.
  services: string[];
  banned: boolean;
  lastSignInAt: number | null;
};

// Every Clerk account with its role, for the accounts page. Plain fields only.
export async function getAccounts(): Promise<Account[]> {
  const users = await listAllUsers();
  return users
    .map((u) => {
      const meta = u.publicMetadata as { role?: unknown; services?: unknown };
      const role: AccountRole = meta.role === "admin" || meta.role === "staff" ? meta.role : "resident";
      return {
        id: u.id,
        name: u.fullName?.trim() || u.primaryEmailAddress?.emailAddress || "Unnamed account",
        email: u.primaryEmailAddress?.emailAddress ?? null,
        role,
        services: role === "staff" && Array.isArray(meta.services) ? meta.services.filter((s) => typeof s === "string") : [],
        banned: u.banned,
        lastSignInAt: u.lastSignInAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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
  "id" | "ref" | "service" | "appt_date" | "time_slot" | "status" | "phone" | "address" | "note" | "follow_up_of" | "archived_at"
>;

// Every appointment the resident booked, archived ones included, newest first.
export async function getResidentAppointments(userId: string) {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select("id, ref, service, appt_date, time_slot, status, phone, address, note, follow_up_of, archived_at")
    .eq("user_id", userId)
    .order("appt_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load the resident's appointments: ${error.message}`);
  return data as ResidentAppointmentRow[];
}

// How the confirmed/rejected emails to residents went, for Settings → Email delivery.
export async function getEmailDelivery() {
  const supabase = createSupabase();
  const [sent, failed, noEmail, last] = await Promise.all([
    countAppointments().eq("email_status", "sent"),
    countAppointments().eq("email_status", "failed"),
    countAppointments().eq("email_status", "no_email"),
    supabase
      .from("appointments")
      .select("ref, email_error, updated_at")
      .is("archived_at", null)
      .eq("email_status", "failed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const failedResult = [sent, failed, noEmail, last].find((r) => r.error);
  if (failedResult?.error) throw new Error(`Could not load email delivery: ${failedResult.error.message}`);
  return {
    sent: sent.count ?? 0,
    failed: failed.count ?? 0,
    noEmail: noEmail.count ?? 0,
    lastFailure: last.data as { ref: string; email_error: string | null; updated_at: string } | null,
  };
}

// Number of appointments per service name, archived ones included, for the services page.
export async function getAppointmentCountsByService() {
  const { data, error } = await createSupabase().from("appointments").select("service").limit(10000);
  if (error) throw new Error(`Could not count appointments: ${error.message}`);
  const counts = new Map<string, number>();
  for (const { service } of data) counts.set(service, (counts.get(service) ?? 0) + 1);
  return counts;
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
  "id, ref, resident_name, first_name, last_name, email, phone, address, service, appt_date, time_slot, note, status, follow_up_of, email_for, email_status, email_error, updated_at, archived_at";

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

// Each entry is about an appointment (appointment_ref set) or, for account actions, an account (target set).
export type ActivityEntry = {
  id: number;
  action:
    | "created" | "status" | "edited" | "archived" | "restored" | "deleted"
    | "role_changed" | "deactivated" | "reactivated"
    | "service_added" | "service_updated"
    | "settings_updated"
    | "email_retried";
  old_status: Status | null;
  new_status: Status | null;
  // "edited": { field: { from, to } }. "deleted": a snapshot of the appointment's details.
  // "role_changed": { from: { role, services }, to: { role, services } }.
  // "service_added": { service, active }. "service_updated": { service, changes: { field: { from, to } } }.
  // "settings_updated": { changes: { field: { from, to } } }.
  // "email_retried": { result: "sent" | "failed" | "no_email" | "skipped", email_for: "confirmed" | "rejected" | null }.
  details: Record<string, unknown> | null;
  actor_role: "resident" | "staff" | "admin" | "system";
  actor_name: string;
  created_at: string;
  appointment_ref: string | null;
  // null once the appointment has been deleted.
  appointment: { resident_name: string; service: string } | null;
  target_name: string | null;
};

export const isAccountAction = (action: ActivityEntry["action"]) =>
  action === "role_changed" || action === "deactivated" || action === "reactivated";

const auditColumns =
  "id, action, old_status, new_status, details, actor_id, actor_role, created_at, appointment_ref, target_user_id, appointment:appointments(resident_name, service)";

type AuditRow = { actor_id: string | null; target_user_id: string | null; appointment: unknown } & Record<string, unknown>;

// Names for the people in each entry come from Clerk, 100 ids per call.
async function withNames(rows: AuditRow[]): Promise<ActivityEntry[]> {
  const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.target_user_id]).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  const client = await clerkClient();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: users } = await client.users.getUserList({ userId: ids.slice(i, i + 100), limit: 100 });
    for (const u of users) {
      names.set(u.id, u.fullName || u.primaryEmailAddress?.emailAddress || u.id);
    }
  }

  return rows.map(({ actor_id, target_user_id, appointment, ...row }) => ({
    ...row,
    actor_name: actor_id ? (names.get(actor_id) ?? "Deleted account") : "Supabase (manual edit)",
    target_name: target_user_id ? (names.get(target_user_id) ?? "Deleted account") : null,
    appointment: appointment as ActivityEntry["appointment"],
  })) as ActivityEntry[];
}

// One appointment's history, oldest first.
export async function getActivityLog({ appointmentId }: { appointmentId: number }): Promise<ActivityEntry[]> {
  const { data, error } = await createSupabase()
    .from("audit_log")
    .select(auditColumns)
    .eq("appointment_id", appointmentId)
    .order("created_at")
    .limit(100);
  if (error) throw new Error(`Could not load activity log: ${error.message}`);
  return withNames(data as AuditRow[]);
}

export const auditActionGroups = {
  booked: { label: "Booked", actions: ["created"] },
  status: { label: "Status changes", actions: ["status"] },
  edited: { label: "Edited details", actions: ["edited"] },
  archive: { label: "Archived or restored", actions: ["archived", "restored"] },
  emails: { label: "Email retries", actions: ["email_retried"] },
  deleted: { label: "Deleted", actions: ["deleted"] },
  accounts: { label: "Account changes", actions: ["role_changed", "deactivated", "reactivated"] },
  services: { label: "Service changes", actions: ["service_added", "service_updated"] },
  settings: { label: "Settings changes", actions: ["settings_updated"] },
} satisfies Record<string, { label: string; actions: ActivityEntry["action"][] }>;

export type AuditFilters = {
  who?: "team" | "residents";
  group?: keyof typeof auditActionGroups;
  from?: string; // YYYY-MM-DD, Philippine time
  to?: string;
  search?: string; // appointment ID, or a person's name or email
  page: number; // from 1
};

export const AUDIT_PAGE_SIZE = 50;

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

// One page of the audit log, newest first, plus how many entries match in total.
export async function getAuditLog(f: AuditFilters): Promise<{ entries: ActivityEntry[]; total: number }> {
  let query = createSupabase().from("audit_log").select(auditColumns, { count: "exact" });
  if (f.who === "team") query = query.in("actor_role", ["staff", "admin"]);
  if (f.who === "residents") query = query.eq("actor_role", "resident");
  if (f.group) query = query.in("action", auditActionGroups[f.group].actions);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+08:00`);
  if (f.to) query = query.lt("created_at", `${nextDay(f.to)}T00:00:00+08:00`);

  // Letters, digits, spaces, hyphens, dots and @ only, so the text can't alter the filter.
  const term = (f.search ?? "").replace(/[^\p{L}\p{N} .@-]/gu, "").trim().slice(0, 60);
  if (term) {
    // Matches the appointment ID, or anyone (actor or changed account) whose name or email matches.
    const client = await clerkClient();
    const { data: people } = await client.users.getUserList({ query: term, limit: 100 });
    const ids = people.map((u) => u.id).filter((id) => /^[\w-]+$/.test(id));
    const peopleFilter = ids.length ? `,actor_id.in.(${ids.join(",")}),target_user_id.in.(${ids.join(",")})` : "";
    query = query.or(`appointment_ref.ilike."%${term}%"${peopleFilter}`);
  }

  const start = (f.page - 1) * AUDIT_PAGE_SIZE;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + AUDIT_PAGE_SIZE - 1);
  if (error) throw new Error(`Could not load audit log: ${error.message}`);
  return { entries: await withNames(data as AuditRow[]), total: count ?? 0 };
}
