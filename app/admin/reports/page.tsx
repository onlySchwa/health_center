import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { ReportView } from "@/components/report-view";
import { isAdmin } from "@/lib/admin";
import { manilaToday } from "@/lib/appointments";
import { getReportRows, parseReportFilters, summarize } from "@/lib/reports";
import { getServices } from "@/lib/services";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Reports — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

export default function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink print:bg-white">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <ReportsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ReportsContent({ searchParams }: { searchParams: PageProps<"/admin/reports">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  await connection(); // the default range ends today
  const services = await getServices().catch((error) => {
    console.error(error);
    return [];
  });
  const serviceNames = services.map((s) => s.name);
  const filters = parseReportFilters(await searchParams, manilaToday(), serviceNames);
  const rows = await getReportRows(filters).catch((error) => {
    console.error(error);
    return null;
  });

  return (
    <ReportView
      basePath="/admin/reports"
      filters={filters}
      services={services}
      allLabel="All services"
      report={rows && summarize(rows, filters, serviceNames)}
    />
  );
}
