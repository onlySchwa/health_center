import { connection } from "next/server";
import { isAdmin } from "@/lib/admin";
import { manilaToday } from "@/lib/appointments";
import { getReportRows, longDate, parseReportFilters } from "@/lib/reports";
import { getServices } from "@/lib/services";

// Quotes a CSV cell, and stops spreadsheet apps from running it as a formula.
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// CSV of the appointments in the report's range. No contact details: IDs, dates, services and statuses only.
export async function GET(request: Request) {
  // proxy.ts already blocks non-admins from /admin; check again here since this returns data directly.
  if (!(await isAdmin())) return new Response("Not allowed.", { status: 403 });
  await connection();

  let rows, filters;
  try {
    const serviceNames = (await getServices()).map((s) => s.name);
    filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams), manilaToday(), serviceNames);
    rows = await getReportRows(filters);
  } catch (error) {
    console.error(error);
    return new Response("The report couldn't be generated. Please try again.", { status: 500 });
  }

  const lines = [
    ["Appointment ID", "Date", "Day", "Time slot", "Service", "Status"],
    ...rows.map((r) => [r.ref, r.appt_date, longDate(r.appt_date).split(",")[0], r.time_slot, r.service, r.status]),
  ].map((line) => line.map(cell).join(","));

  // The BOM makes Excel read the file as UTF-8 (time slots contain an en dash).
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="appointments-${filters.from}-to-${filters.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
