"use server";

import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { services, statusStyle, timeSlots } from "@/lib/appointment-options";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { createSupabase } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Booking details from a form, shared by resident requests and admin edits.
function readAppointment(input: Record<string, unknown>) {
  const appointment = {
    resident_name: text(input.name, 100),
    phone: text(input.phone, 20),
    service: text(input.service, 60),
    appt_date: text(input.date, 10),
    time_slot: text(input.time, 40),
    note: text(input.note, 500) || null,
  };

  if (appointment.resident_name.length < 2) return { error: "Please enter your full name." };
  if (!/^[0-9+ -]{7,20}$/.test(appointment.phone)) return { error: "Please enter a valid mobile number." };
  if (!services.includes(appointment.service)) return { error: "Please choose a service." };
  if (!timeSlots.includes(appointment.time_slot)) return { error: "Please choose a time." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment.appt_date)) return { error: "Please choose a date." };
  return { appointment };
}

export async function requestAppointment(input: Record<string, unknown>): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Please sign in to request an appointment." };

  const result = readAppointment(input);
  if (!result.appointment) return { ok: false, error: result.error };
  const { appointment } = result;
  if (appointment.appt_date < manilaToday()) return { ok: false, error: "Please choose today or a future date." };

  const { error } = await createSupabase().from("appointments").insert(appointment);
  if (error) {
    console.error("requestAppointment failed:", error.message);
    return { ok: false, error: "We couldn't save your request. Please try again." };
  }
  refresh();
  return { ok: true };
}

export async function cancelAppointment(id: number): Promise<ActionResult> {
  const { userId } = await auth();
  if (!userId || !Number.isInteger(id)) return { ok: false, error: "Not allowed." };

  // Row-level security only lets residents cancel their own pending/confirmed appointments.
  const { data, error } = await createSupabase()
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "This appointment can't be cancelled." };
  refresh();
  return { ok: true };
}

export async function markAppointment(id: number, status: "completed" | "missed"): Promise<ActionResult> {
  const staff = await getStaffAccess();
  if (!staff || !Number.isInteger(id) || (status !== "completed" && status !== "missed")) {
    return { ok: false, error: "Not allowed." };
  }

  // Row-level security limits this to the staff member's services and to due, open appointments.
  const { data, error } = await createSupabase()
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "This appointment can't be updated." };
  refresh();
  return { ok: true };
}

export async function reviewAppointment(id: number, status: "confirmed" | "rejected"): Promise<ActionResult> {
  if (!(await isAdmin()) || !Number.isInteger(id) || (status !== "confirmed" && status !== "rejected")) {
    return { ok: false, error: "Not allowed." };
  }

  // Row-level security limits this to pending requests, and confirming to today or later.
  const { data, error } = await createSupabase()
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "This request can't be updated." };
  refresh();
  return { ok: true };
}

// Admin edits, archives and deletes go through admin-only database functions (see 0005_admin_manage.sql).
export async function adminUpdateAppointment(id: number, input: Record<string, unknown>): Promise<ActionResult> {
  if (!(await isAdmin()) || !Number.isInteger(id)) return { ok: false, error: "Not allowed." };

  const result = readAppointment(input);
  if (!result.appointment) return { ok: false, error: result.error };
  const status = text(input.status, 20);
  if (!Object.hasOwn(statusStyle, status)) return { ok: false, error: "Please choose a status." };

  const a = result.appointment;
  const { error } = await createSupabase().rpc("admin_update_appointment", {
    p_id: id,
    p_resident_name: a.resident_name,
    p_phone: a.phone,
    p_service: a.service,
    p_appt_date: a.appt_date,
    p_time_slot: a.time_slot,
    p_note: a.note,
    p_status: status,
  });
  if (error) {
    console.error("adminUpdateAppointment failed:", error.message);
    return { ok: false, error: "This appointment couldn't be saved." };
  }
  refresh();
  return { ok: true };
}

export async function setAppointmentArchived(id: number, archived: boolean): Promise<ActionResult> {
  if (!(await isAdmin()) || !Number.isInteger(id) || typeof archived !== "boolean") {
    return { ok: false, error: "Not allowed." };
  }
  const { error } = await createSupabase().rpc("admin_set_archived", { p_id: id, p_archived: archived });
  if (error) {
    console.error("setAppointmentArchived failed:", error.message);
    return { ok: false, error: "This appointment couldn't be updated." };
  }
  refresh();
  return { ok: true };
}

export async function deleteAppointment(id: number): Promise<ActionResult> {
  if (!(await isAdmin()) || !Number.isInteger(id)) return { ok: false, error: "Not allowed." };
  const { error } = await createSupabase().rpc("admin_delete_appointment", { p_id: id });
  if (error) {
    console.error("deleteAppointment failed:", error.message);
    return { ok: false, error: "This appointment couldn't be deleted." };
  }
  refresh();
  return { ok: true };
}
