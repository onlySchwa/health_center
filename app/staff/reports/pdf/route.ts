import { connection } from "next/server";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { renderReportPdf } from "@/lib/report-pdf";
import { getReportRows, parseReportFilters } from "@/lib/reports";

// PDF of the staff report: the same layout as the admin one, limited to the staff member's services.
export async function GET(request: Request) {
  // proxy.ts already blocks non-staff from /staff; check again here since this returns data directly.
  const staff = await getStaffAccess();
  if (!staff || staff.services.length === 0) return new Response("Not allowed.", { status: 403 });
  await connection();

  try {
    const filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams), manilaToday(), staff.services);
    const pdf = await renderReportPdf(filters, await getReportRows(filters, staff.services), staff.services);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="appointments-report-${filters.from}-to-${filters.to}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("The PDF couldn't be generated. Please try again.", { status: 500 });
  }
}
