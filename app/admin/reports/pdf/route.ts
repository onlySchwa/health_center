import { connection } from "next/server";
import { isAdmin } from "@/lib/admin";
import { manilaToday } from "@/lib/appointments";
import { renderReportPdf } from "@/lib/report-pdf";
import { getReportRows, parseReportFilters } from "@/lib/reports";
import { getServices } from "@/lib/services";

// PDF of the report for the filters in the URL: the same summary, charts and appointment list as the page.
export async function GET(request: Request) {
  // proxy.ts already blocks non-admins from /admin; check again here since this returns data directly.
  if (!(await isAdmin())) return new Response("Not allowed.", { status: 403 });
  await connection();

  try {
    const serviceNames = (await getServices()).map((s) => s.name);
    const filters = parseReportFilters(Object.fromEntries(new URL(request.url).searchParams), manilaToday(), serviceNames);
    const pdf = await renderReportPdf(filters, await getReportRows(filters), serviceNames);
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
