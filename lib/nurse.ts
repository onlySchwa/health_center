import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Status } from "@/lib/appointment-options";
import type { HealthIntake } from "@/lib/health-intake";
import { createSupabase } from "@/lib/supabase";

// Data for the nurse dashboard. Row-level security lets nurses read every appointment and its
// health form, and change nothing (0017_nurse_intake_roster.sql).

// Nurse = role "nurse" in the user's Clerk public metadata. Returns their user ID, or null for everyone else.
export async function getNurseId() {
  const { userId, sessionClaims } = await auth();
  return userId && sessionClaims?.metadata?.role === "nurse" ? userId : null;
}

export type Patient = {
  id: number;
  ref: string;
  resident_name: string;
  phone: string | null;
  address: string | null;
  service: string;
  time_slot: string;
  note: string | null;
  status: Status;
  walk_in: boolean;
  // null for walk-ins and bookings made before the health form existed.
  intake: (HealthIntake & { created_at: string }) | null;
};

// Everyone booked on one day, except requests that were cancelled or rejected.
export async function getPatients(date: string): Promise<Patient[]> {
  const { data, error } = await createSupabase()
    .from("appointments")
    .select("id, ref, resident_name, phone, address, service, time_slot, note, status, walk_in, intake:health_intakes(*)")
    .eq("appt_date", date)
    .is("archived_at", null)
    .not("status", "in", "(cancelled,rejected)")
    .order("time_slot")
    .order("id");
  if (error) throw new Error(`Could not load patients: ${error.message}`);
  return data as unknown as Patient[];
}
