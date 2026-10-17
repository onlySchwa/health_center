"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { after } from "next/server";
import { isAdmin, type AccountRole } from "@/lib/admin";
import { sendAppointmentEmail } from "@/lib/appointment-email";
import { services, statusStyle, timeSlots } from "@/lib/appointment-options";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { createSupabase } from "@/lib/supabase";

export type ActionResult = { ok: true } | { ok: false; error: string };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Booking details from a form, shared by resident requests and admin edits.
// Email and address may be blank here only because older appointments lack them;
// new resident requests must include both (see requestAppointment).
function readAppointment(input: Record<string, unknown>) {
  const appointment = {
    first_name: text(input.firstName, 50),
    last_name: text(input.lastName, 50),
    email: text(input.email, 254) || null,
    phone: text(input.phone, 20) || null,
    address: text(input.address, 200) || null,
    service: text(input.service, 60),
    appt_date: text(input.date, 10),
    time_slot: text(input.time, 40),
    note: text(input.note, 500) || null,
  };

  if (!appointment.first_name) return { error: "Please enter your first name." };
  if (!appointment.last_name) return { error: "Please enter your last name." };
  // Same pattern as the database check in 0009_stricter_email_check.sql.
  if (appointment.email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(appointment.email)) {
    return { error: "Please enter a valid email address." };
  }
  if (appointment.phone && !/^[0-9+ -]{7,20}$/.test(appointment.phone)) {
    return { error: "Please enter a valid mobile number." };
  }
  if (appointment.address && appointment.address.length < 5) return { error: "Please enter your full address." };
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
  if (!appointment.email) return { ok: false, error: "Please enter your email address." };
  if (!appointment.address) return { ok: false, error: "Please enter your address." };
  if (appointment.appt_date < manilaToday()) return { ok: false, error: "Please choose today or a future date." };
  // Residents book Monday to Friday only (admins can still set any date when editing).
  const weekday = new Date(`${appointment.appt_date}T00:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return { ok: false, error: "Appointments are available Monday to Friday only." };

  const { data, error } = await createSupabase().from("appointments").insert(appointment).select("ref").single();
  if (error) {
    console.error("requestAppointment failed:", error.message);
    return { ok: false, error: "We couldn't save your request. Please try again." };
  }

  // Email the resident a copy after responding, so a slow or failed email never holds up the booking.
  const email = appointment.email;
  after(async () => {
    const sent = await sendAppointmentEmail("received", {
      to: email,
      firstName: appointment.first_name,
      fullName: `${appointment.first_name} ${appointment.last_name}`,
      ref: data.ref,
      service: appointment.service,
      apptDate: appointment.appt_date,
      timeSlot: appointment.time_slot,
      phone: appointment.phone,
      address: appointment.address,
      note: appointment.note,
    });
    if (!sent.ok) console.error(`Request-received email for ${data.ref} not sent:`, sent.error);
  });
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
  // The decision stands even if the email fails; the result is recorded and shown on the admin page.
  await emailStatusChange(id);
  refresh();
  return { ok: true };
}

// Emails the resident that their request was confirmed or rejected, at most once per decision,
// and records the outcome (see 0008_status_emails.sql). Skips other statuses, past dates, and
// decisions already emailed.
async function emailStatusChange(id: number): Promise<"sent" | "failed" | "no_email" | "skipped"> {
  const supabase = createSupabase();
  const { data: a, error } = await supabase
    .from("appointments")
    .select("id, ref, first_name, email, service, appt_date, time_slot, status, email_for, email_status")
    .eq("id", id)
    .in("status", ["confirmed", "rejected"])
    .maybeSingle();
  if (error || !a) {
    if (error) console.error(`emailStatusChange: couldn't load appointment ${id}:`, error.message);
    return "skipped";
  }
  const decision = a.status as "confirmed" | "rejected";
  const sameDecision = a.email_for === decision;
  if ((sameDecision && a.email_status === "sent") || a.appt_date < manilaToday()) return "skipped";

  const result = a.email
    ? await sendAppointmentEmail(decision, {
        to: a.email,
        firstName: a.first_name,
        ref: a.ref,
        service: a.service,
        apptDate: a.appt_date,
        timeSlot: a.time_slot,
      })
    : ({ ok: false, error: "No email address on file." } as const);
  const status = !a.email ? "no_email" : result.ok ? "sent" : "failed";
  if (!result.ok) console.error(`${decision} email for ${a.ref} not sent:`, result.error);

  const { error: recordError } = await supabase.rpc("admin_record_status_email", {
    p_id: id,
    p_for: decision,
    p_status: status,
    p_error: result.ok ? null : result.error,
  });
  if (recordError) console.error(`Couldn't record ${decision} email result for ${a.ref}:`, recordError.message);
  return status;
}

export async function retryStatusEmail(id: number): Promise<ActionResult> {
  if (!(await isAdmin()) || !Number.isInteger(id)) return { ok: false, error: "Not allowed." };
  const status = await emailStatusChange(id);
  refresh();
  if (status === "sent" || status === "skipped") return { ok: true };
  return {
    ok: false,
    error: status === "no_email" ? "No email on file. Add one with Edit, then retry." : "Still couldn't send. Try again later.",
  };
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
    p_first_name: a.first_name,
    p_last_name: a.last_name,
    p_email: a.email,
    p_phone: a.phone,
    p_address: a.address,
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
  // Confirming or rejecting from the edit dialog counts too. Decisions already emailed are skipped.
  if (status === "confirmed" || status === "rejected") await emailStatusChange(id);
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

// Account changes are made in Clerk (where roles live), then recorded through an admin-only
// database function (see 0010_account_audit.sql). Admins can't change their own account,
// so there's always at least one admin left.
async function checkAccountChange(userId: unknown) {
  const { userId: me } = await auth();
  if (!(await isAdmin()) || typeof userId !== "string" || !userId) return "Not allowed.";
  if (userId === me) return "You can't change your own account.";
  return null;
}

async function logAccountChange(userId: string, action: "role_changed" | "deactivated" | "reactivated", details?: object) {
  const { error } = await createSupabase().rpc("admin_log_account_change", {
    p_target_user_id: userId,
    p_action: action,
    p_details: details ?? null,
  });
  if (error) console.error(`Couldn't record ${action} for ${userId}:`, error.message);
  return !error;
}

const roles: AccountRole[] = ["resident", "staff", "admin"];

export async function setAccountRole(userId: string, role: unknown, staffServices: unknown): Promise<ActionResult> {
  const denied = await checkAccountChange(userId);
  if (denied) return { ok: false, error: denied };
  if (!roles.includes(role as AccountRole)) return { ok: false, error: "Please choose a role." };
  const picked = Array.isArray(staffServices) ? services.filter((s) => staffServices.includes(s)) : [];
  if (role === "staff" && picked.length === 0) return { ok: false, error: "Choose at least one service for this staff member." };

  const client = await clerkClient();
  let before;
  try {
    const user = await client.users.getUser(userId);
    const meta = user.publicMetadata as { role?: unknown; services?: unknown };
    before = { role: typeof meta.role === "string" ? meta.role : "resident", services: Array.isArray(meta.services) ? meta.services : [] };
    // Clerk merges metadata; null removes a key, so residents end up with neither.
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: role === "resident" ? null : role, services: role === "staff" ? picked : null },
    });
  } catch (error) {
    console.error("setAccountRole failed:", error);
    return { ok: false, error: "This account couldn't be updated." };
  }

  const logged = await logAccountChange(userId, "role_changed", { from: before, to: { role, services: role === "staff" ? picked : [] } });
  refresh();
  return logged ? { ok: true } : { ok: false, error: "The role was changed, but it couldn't be recorded in the audit log." };
}

// Deactivating bans the account in Clerk: it's signed out everywhere and can't sign in until reactivated.
export async function setAccountActive(userId: string, active: boolean): Promise<ActionResult> {
  const denied = await checkAccountChange(userId);
  if (denied) return { ok: false, error: denied };
  if (typeof active !== "boolean") return { ok: false, error: "Not allowed." };

  try {
    const client = await clerkClient();
    await (active ? client.users.unbanUser(userId) : client.users.banUser(userId));
  } catch (error) {
    console.error("setAccountActive failed:", error);
    return { ok: false, error: "This account couldn't be updated." };
  }

  const logged = await logAccountChange(userId, active ? "reactivated" : "deactivated");
  refresh();
  return logged
    ? { ok: true }
    : { ok: false, error: `The account was ${active ? "reactivated" : "deactivated"}, but it couldn't be recorded in the audit log.` };
}
