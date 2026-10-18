import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { ReportView } from "@/components/report-view";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { getReportRows, parseReportFilters, summarize } from "@/lib/reports";
import { getServices } from "@/lib/services";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "Reports — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

export default function StaffReportsPage({ searchParams }: PageProps<"/staff/reports">) {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink print:bg-white">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <ReportsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ReportsContent({ searchParams }: { searchParams: PageProps<"/staff/reports">["searchParams"] }) {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();

  await connection(); // the default range ends today
  const services = await getServices().catch((error) => {
    console.error(error);
    return [];
  });
  const mine = services.filter((s) => staff.services.includes(s.name));
  const filters = parseReportFilters(await searchParams, manilaToday(), staff.services);
  const rows =
    staff.services.length === 0
      ? []
      : await getReportRows(filters, staff.services).catch((error) => {
          console.error(error);
          return null;
        });

  return (
    <ReportView
      basePath="/staff/reports"
      filters={filters}
      services={mine}
      allLabel="All my services"
      report={rows && summarize(rows, filters, staff.services)}
    />
  );
}
