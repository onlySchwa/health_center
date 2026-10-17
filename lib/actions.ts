"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { isAdmin, type AccountRole } from "@/lib/admin";
import { sendAppointmentEmail, sendTestEmail } from "@/lib/appointment-email";
import { statusStyle, timeSlots } from "@/lib/appointment-options";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { getServices, SERVICES_TAG } from "@/lib/services";
import { getSettings, SETTINGS_TAG } from "@/lib/settings";
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
  if (!appointment.service) return { error: "Please choose a service." };
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

  // Service days and times, same-day, days ahead, closed dates and full slots: one database function
  // decides (see 0012_settings.sql) and the insert policy runs it again. Admins can set any date when editing.
  const supabase = createSupabase();
  const { data: ruleError, error: ruleCheckError } = await supabase.rpc("booking_rule_error", {
    p_service: appointment.service,
    p_date: appointment.appt_date,
    p_slot: appointment.time_slot,
  });
  if (ruleCheckError) console.error("booking_rule_error failed:", ruleCheckError.message);
  if (ruleError) return { ok: false, error: ruleError };

  const { data, error } = await supabase.from("appointments").insert(appointment).select("ref").single();
  if (error) {
    console.error("requestAppointment failed:", error.message);
    return { ok: false, error: "We couldn't save your request. Please try again." };
  }

  // Emails go out after responding, so a slow or failed email never holds up the booking.
  const settings = await getSettings();
  const email = appointment.email;
  const details = {
    firstName: appointment.first_name,
    fullName: `${appointment.first_name} ${appointment.last_name}`,
    ref: data.ref,
    service: appointment.service,
    apptDate: appointment.appt_date,
    timeSlot: appointment.time_slot,
    phone: appointment.phone,
    address: appointment.address,
    note: appointment.note,
  };
  after(async () => {
    if (settings.emailOnRequest) {
      const sent = await sendAppointmentEmail("received", { to: email, ...details });
      if (!sent.ok) console.error(`Request-received email for ${data.ref} not sent:`, sent.error);
    }
    if (settings.alertNewRequests) {
      for (const to of await adminEmails()) {
        const sent = await sendAppointmentEmail("alert", { to, residentEmail: email, ...details });
        if (!sent.ok) console.error(`New-request alert for ${data.ref} to an admin not sent:`, sent.error);
      }
    }
  });
  refresh();
  return { ok: true };
}

// Every admin's primary email address, from Clerk.
async function adminEmails() {
  const client = await clerkClient();
  const emails: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, totalCount } = await client.users.getUserList({ limit: 500, offset });
    for (const u of data) {
      const email = u.primaryEmailAddress?.emailAddress;
      if (u.publicMetadata.role === "admin" && !u.banned && email) emails.push(email);
    }
    if (data.length === 0 || offset + data.length >= totalCount) return emails;
  }
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
// Automatic sends follow Settings → "Confirmed or rejected" emails; an admin's manual resend always tries.
async function emailStatusChange(id: number, manual = false): Promise<"sent" | "failed" | "no_email" | "skipped"> {
  if (!manual && !(await getSettings()).emailOnDecision) return "skipped";
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
  const status = await emailStatusChange(id, true);
  // Record the retry and how it went (see 0013_email_retry_audit.sql).
  const { error: logError } = await createSupabase().rpc("admin_log_email_retry", { p_id: id, p_result: status });
  if (logError) console.error(`Couldn't record email retry for appointment ${id}:`, logError.message);
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
  // Any service on record, disabled ones included, so old appointments stay editable.
  if (!(await getServices()).some((s) => s.name === a.service)) return { ok: false, error: "Please choose a service." };
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
  const names = (await getServices()).map((s) => s.name);
  const picked = Array.isArray(staffServices) ? names.filter((s) => staffServices.includes(s)) : [];
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

// Adds a service, or updates one's description, requirements, schedule and active flag.
// Names are fixed once created (appointments and staff assignments refer to them), and the
// database function checks the admin role and writes the audit entry (see 0011_services.sql).
export async function saveService(input: Record<string, unknown>, isNew: boolean): Promise<ActionResult> {
  if (!(await isAdmin()) || typeof isNew !== "boolean") return { ok: false, error: "Not allowed." };

  const name = text(input.name, 60);
  const days = Array.isArray(input.days) ? [1, 2, 3, 4, 5].filter((d) => (input.days as unknown[]).includes(d)) : [];
  const slots = Array.isArray(input.timeSlots) ? timeSlots.filter((t) => (input.timeSlots as unknown[]).includes(t)) : [];
  if (name.length < 3) return { ok: false, error: "Please enter a service name (at least 3 characters)." };
  if (days.length === 0) return { ok: false, error: "Choose at least one day." };
  if (slots.length === 0) return { ok: false, error: "Choose at least one time slot." };

  const existing = (await getServices()).find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (isNew && existing) return { ok: false, error: "A service with that name already exists." };
  if (!isNew && !existing) return { ok: false, error: "That service no longer exists." };

  const { error } = await createSupabase().rpc("admin_save_service", {
    p_name: isNew ? name : existing!.name,
    p_is_new: isNew,
    p_description: text(input.description, 300),
    p_requirements: text(input.requirements, 300),
    p_days: days,
    p_time_slots: slots,
    p_active: input.active !== false,
  });
  if (error) {
    console.error("saveService failed:", error.message);
    return { ok: false, error: "This service couldn't be saved." };
  }
  updateTag(SERVICES_TAG);
  refresh();
  return { ok: true };
}

const optionalLimit = (value: unknown, max: number) => {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
};

// Saves clinic details, booking rules and email switches. The database function checks the
// admin role, validates every value and writes the audit entry (see 0012_settings.sql).
export async function saveSettings(input: Record<string, unknown>): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not allowed." };

  const phone = text(input.phone, 20);
  if (phone && !/^[0-9+ -]{7,20}$/.test(phone)) return { ok: false, error: "Please enter a valid phone number." };
  const facebookUrl = text(input.facebookUrl, 200);
  const messengerUrl = text(input.messengerUrl, 200);
  for (const url of [facebookUrl, messengerUrl]) {
    if (url && !/^https:\/\/\S+$/.test(url)) return { ok: false, error: "Links must start with https://" };
  }
  const maxDaysAhead = optionalLimit(input.maxDaysAhead, 365);
  const maxPerSlot = optionalLimit(input.maxPerSlot, 500);
  if (maxDaysAhead === undefined) return { ok: false, error: "Days ahead must be a whole number from 1 to 365, or blank." };
  if (maxPerSlot === undefined) return { ok: false, error: "Bookings per slot must be a whole number from 1 to 500, or blank." };
  const closedDates = Array.isArray(input.closedDates)
    ? [...new Set(input.closedDates.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))]
    : [];
  const clinicName = text(input.clinicName, 100);
  if (clinicName.length < 3) return { ok: false, error: "Please enter the clinic's name." };

  const { error } = await createSupabase().rpc("admin_save_settings", {
    p: {
      clinic_name: clinicName,
      address: text(input.address, 200),
      clinic_days: text(input.clinicDays, 100),
      clinic_hours: text(input.clinicHours, 100),
      phone,
      facebook_url: facebookUrl,
      messenger_url: messengerUrl,
      max_days_ahead: maxDaysAhead,
      max_per_slot: maxPerSlot,
      allow_same_day: input.allowSameDay === true,
      closed_dates: closedDates,
      email_on_request: input.emailOnRequest === true,
      email_on_decision: input.emailOnDecision === true,
      alert_new_requests: input.alertNewRequests === true,
    },
  });
  if (error) {
    console.error("saveSettings failed:", error.message);
    return { ok: false, error: "The settings couldn't be saved." };
  }
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: true };
}

// Sends a test email to the signed-in admin, to check Gmail sending works.
export async function sendAdminTestEmail(): Promise<ActionResult & { to?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not allowed." };
  const { userId } = await auth();
  const user = await (await clerkClient()).users.getUser(userId!);
  const to = user.primaryEmailAddress?.emailAddress;
  if (!to) return { ok: false, error: "Your account has no email address." };
  const sent = await sendTestEmail(to);
  return sent.ok ? { ok: true, to } : { ok: false, error: `Gmail didn't send it: ${sent.error}` };
}
