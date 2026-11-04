import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { createSupabase } from "@/lib/supabase";

// The daily duty roster (0017_nurse_intake_roster.sql). Admins set it; nurses and staff read it.

export type DutyRole = "nurse" | "staff";
export type OnDuty = { userId: string; role: DutyRole; name: string };

// Everyone on duty on one day, nurses first, with their names from Clerk.
export async function getOnDuty(date: string): Promise<OnDuty[]> {
  const { data, error } = await createSupabase()
    .from("duty_roster")
    .select("user_id, role")
    .eq("duty_date", date);
  if (error) throw new Error(`Could not load the duty roster: ${error.message}`);
  if (data.length === 0) return [];

  const client = await clerkClient();
  const { data: users } = await client.users.getUserList({ userId: data.map((r) => r.user_id), limit: 100 });
  const names = new Map(users.map((u) => [u.id, u.fullName?.trim() || u.primaryEmailAddress?.emailAddress || "Unnamed account"]));
  return data
    .map((r) => ({ userId: r.user_id, role: r.role as DutyRole, name: names.get(r.user_id) ?? "Deleted account" }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "nurse" ? -1 : 1));
}

// The days (YYYY-MM-DD) one person is on duty, from `from` onwards, soonest first.
export async function getDutyDays(userId: string, from: string, limit = 7): Promise<string[]> {
  const { data, error } = await createSupabase()
    .from("duty_roster")
    .select("duty_date")
    .eq("user_id", userId)
    .gte("duty_date", from)
    .order("duty_date")
    .limit(limit);
  if (error) throw new Error(`Could not load duty days: ${error.message}`);
  return data.map((r) => r.duty_date);
}

export const formatDutyDay = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${iso}T00:00:00+08:00`),
  );
