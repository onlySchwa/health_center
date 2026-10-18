import { connection } from "next/server";
import { isAdmin } from "@/lib/admin";
import { manilaToday } from "@/lib/appointments";
import { getReportRows, parseReportFilters, reportCsvResponse } from "@/lib/reports";
import { getServices } from "@/lib/services";

// CSV of the appointments in the report's range. No contact details: IDs, dates, services and statuses only.
export async function GET(request: Request) {
  // proxy.ts already blocks non-admins from /admin; check again here since this returns data directly.
  if (!(await isAdmin())) return new Response("Not allowed.", { status: 403 });
  await connection();

  try {
    const serviceNames = (await getServices()).map((s) => s.name);
    const filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams), manilaToday(), serviceNames);
    return reportCsvResponse(await getReportRows(filters), filters);
  } catch (error) {
    console.error(error);
    return new Response("The report couldn't be generated. Please try again.", { status: 500 });
  }
}
