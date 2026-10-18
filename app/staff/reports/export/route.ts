import { connection } from "next/server";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { getReportRows, parseReportFilters, reportCsvResponse } from "@/lib/reports";

// CSV of the staff member's own services only. No contact details: IDs, dates, services and statuses.
export async function GET(request: Request) {
  // proxy.ts already blocks non-staff from /staff; check again here since this returns data directly.
  const staff = await getStaffAccess();
  if (!staff || staff.services.length === 0) return new Response("Not allowed.", { status: 403 });
  await connection();

  try {
    const filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams), manilaToday(), staff.services);
    return reportCsvResponse(await getReportRows(filters, staff.services), filters);
  } catch (error) {
    console.error(error);
    return new Response("The report couldn't be generated. Please try again.", { status: 500 });
  }
}
