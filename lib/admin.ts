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
async function countResidents() {
  const client = await clerkClient();
  let count = 0;
  for (let offset = 0; ; offset += 500) {
    const { data, totalCount } = await client.users.getUserList({ limit: 500, offset });
    count += data.filter((u) => !u.publicMetadata.role).length;
    if (data.length === 0 || offset + data.length >= totalCount) return count;
  }
}

export async function getAdminCounts() {
  const today = manilaToday();
  const base = () =>
    createSupabase().from("appointments").select("id", { count: "exact", head: true }).is("archived_at", null);

  const [residents, todayResult, pendingResult, unsentResult] = await Promise.all([
    countResidents(),
    base().eq("appt_date", today).not("status", "in", "(cancelled,rejected)"),
    base().eq("status", "pending"),
    // Upcoming confirmed/rejected appointments whose email to the resident didn't go out.
    base().in("status", ["confirmed", "rejected"]).gte("appt_date", today).in("email_status", ["failed", "no_email"]),
  ]);
  const failed = [todayResult, pendingResult, unsentResult].find((r) => r.error);
  if (failed?.error) throw new Error(`Could not load counts: ${failed.error.message}`);

  return {
    residents,
    today: todayResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    unsentEmails: unsentResult.count ?? 0,
  };
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

// "pending" = requests waiting for review; "history" = every appointment, newest first;
// "archived" = appointments an admin has hidden from everyone else.
export async function getAdminAppointments(tab: "pending" | "history" | "archived", search: string) {
  let query = createSupabase()
    .from("appointments")
    .select(
      "id, ref, resident_name, first_name, last_name, email, phone, address, service, appt_date, time_slot, note, status, email_for, email_status, email_error, updated_at, archived_at",
    );

  query = tab === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (tab === "pending") query = query.eq("status", "pending");

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
export async function getActivityLog(staffOnly: boolean): Promise<ActivityEntry[]> {
  let query = createSupabase()
    .from("audit_log")
    .select(
      "id, action, old_status, new_status, details, actor_id, actor_role, created_at, appointment_ref, appointment:appointments(resident_name, service)",
    );
  if (staffOnly) query = query.in("actor_role", ["staff", "admin"]);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
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
