import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Sent through a Gmail account with an app password (GMAIL_USER, GMAIL_APP_PASSWORD in .env.local).
// Gmail allows about 500 recipients a day.
export type EmailKind = "received" | "confirmed" | "rejected";

export type EmailDetails = {
  to: string;
  firstName: string;
  ref: string;
  service: string;
  apptDate: string;
  timeSlot: string;
  // Only shown in the "received" email, as a copy of what the resident filled in.
  fullName?: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
};

export type EmailResult = { ok: true } | { ok: false; error: string };

const copy: Record<EmailKind, { subject: string; heading: string; message: string }> = {
  received: {
    subject: "We received your appointment request",
    heading: "Request received",
    message: "Thank you for booking with us. Here is a copy of your request. We'll email you again once it's confirmed.",
  },
  confirmed: {
    subject: "Your appointment is confirmed",
    heading: "Appointment confirmed",
    message: "Your appointment is confirmed. Please show this email at the front desk when you arrive.",
  },
  rejected: {
    subject: "Update on your appointment request",
    heading: "Request not approved",
    message: "We're sorry, we couldn't accept this request. Please book another date or contact the health center.",
  },
};

let transport: Transporter | undefined;

// Residents' input goes into the HTML, so it must be escaped.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "full" }).format(new Date(`${iso}T00:00:00+08:00`));

export async function sendAppointmentEmail(kind: EmailKind, d: EmailDetails): Promise<EmailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { ok: false, error: "GMAIL_USER or GMAIL_APP_PASSWORD is not set." };
  transport ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });

  const { subject, heading, message } = copy[kind];
  const rows: [string, string | null | undefined][] = [
    ["Booking ID", d.ref],
    ["Name", d.fullName],
    ["Service", d.service],
    ["Date", longDate(d.apptDate)],
    ["Time", d.timeSlot],
    ...(kind === "received"
      ? ([
          ["Email", d.to],
          ["Mobile number", d.phone],
          ["Address", d.address],
          ["Notes", d.note],
        ] as [string, string | null | undefined][])
      : []),
  ];
  const filled = rows.filter((r): r is [string, string] => Boolean(r[1]));

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10252C">
  <div style="background:#0E3B4A;color:#fff;padding:24px 28px;border-radius:16px 16px 0 0">
    <div style="font-size:12px;letter-spacing:2px;color:#9FE0DC;text-transform:uppercase">Baan Health Care</div>
    <div style="font-size:22px;font-weight:bold;margin-top:6px">${heading}</div>
  </div>
  <div style="border:1px solid #DCE5E6;border-top:0;padding:24px 28px;border-radius:0 0 16px 16px">
    <p style="margin:0 0 6px">Hi ${esc(d.firstName)},</p>
    <p style="margin:0 0 18px;color:#3E5A61">${message}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${filled
        .map(
          ([k, v]) =>
            `<tr><td style="padding:9px 0;border-top:1px solid #DCE5E6;color:#3E5A61;width:38%">${k}</td><td style="padding:9px 0;border-top:1px solid #DCE5E6;font-weight:bold">${esc(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#3E5A61">Baan KM 3 Barangay Health Center</p>
  </div>
</div>`;
  const text = `Hi ${d.firstName},\n\n${message}\n\n${filled.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nBaan KM 3 Barangay Health Center`;

  try {
    await transport.sendMail({ from: `Baan Health Care <${user}>`, to: d.to, subject: `${subject} (${d.ref})`, html, text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown email error." };
  }
}
