import { connection } from "next/server";
import { isAdmin } from "@/lib/admin";
import { manilaToday } from "@/lib/appointments";
import { renderReportPdf } from "@/lib/report-pdf";
import { getReportRows, parseReportFilters } from "@/lib/reports";

// PDF of the report for the filters in the URL: the same summary, charts and appointment list as the page.
export async function GET(request: Request) {
  // proxy.ts already blocks non-admins from /admin; check again here since this returns data directly.
  if (!(await isAdmin())) return new Response("Not allowed.", { status: 403 });
  await connection();

  const filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams), manilaToday());
  try {
    const pdf = await renderReportPdf(filters, await getReportRows(filters));
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
