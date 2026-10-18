import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { NoticeItem } from "@/components/staff-notice";
import { statusStyle, timeSlots } from "@/lib/appointment-options";
import { getStaffAccess, getStaffCounts, manilaToday } from "@/lib/appointments";
import { getSettings } from "@/lib/settings";
import { findOverlaps, getStaffNotices, getStaffSchedule } from "@/lib/staff";
import StaffLoading from "./loading";

export const metadata: Metadata = {
  title: "Staff Dashboard — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";

const quickActions = [
  { href: "/staff/appointments?view=today", label: "Mark today's visits" },
  { href: "/staff/appointments?view=requests", label: "See new requests" },
  { href: "/staff/schedule?view=week", label: "This week's schedule" },
  { href: "/staff/reports", label: "Download a report" },
];

export default function StaffPage() {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={4} />}>
          <DashboardContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function DashboardContent() {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();

  await connection(); // "today" depends on the current time, so compute it per request
  const today = manilaToday();
  const hasServices = staff.services.length > 0;
  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const settings = await getSettings().catch(fail);
  const [counts, todayRows, notices] = hasServices
    ? await Promise.all([
        getStaffCounts(staff.services).catch(fail),
        getStaffSchedule(staff.services, today, today).catch(fail),
        getStaffNotices(staff.services, settings?.closedDates ?? []).catch(fail),
      ])
    : [null, [], []];
  const overlaps = todayRows ? findOverlaps(todayRows) : new Set<number>();

  const todayLabel = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "full" }).format(new Date());
  const stats = [
    { label: "Scheduled today", value: counts?.todayTotal, tone: "text-baan-navy" },
    { label: "Pending requests", value: counts?.pending, tone: "text-baan-orange" },
    { label: "Completed today", value: counts?.completedToday, tone: "text-baan-teal" },
    { label: "Missed today", value: counts?.missedToday, tone: "text-[#9B2C2C]" },
  ];
  // Morning before afternoon, in the clinic's order; any other slot after them.
  const slots = [...new Set(todayRows?.map((a) => a.time_slot))].sort(
    (a, b) => (timeSlots.indexOf(a) >>> 0) - (timeSlots.indexOf(b) >>> 0),
  );

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Dashboard</h1>
        <p className="text-[15px] text-baan-muted">{todayLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-baan-muted">You handle:</span>
          {hasServices ? (
            staff.services.map((s) => (
              <span key={s} className="rounded-full bg-[#E3EEEF] px-3 py-1 text-sm font-semibold text-baan-navy">
                {s}
              </span>
            ))
          ) : (
            <span className="text-sm font-semibold text-baan-orange">No services yet. Ask an administrator to assign them.</span>
          )}
        </div>
      </div>

      {hasServices && (!counts || !todayRows || !notices) && (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Some data couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} flex flex-col gap-1 px-6 py-5`}>
            <span className={`font-display text-[40px] leading-none font-extrabold ${s.tone}`}>{s.value ?? "—"}</span>
            <span className="font-semibold text-baan-muted">{s.label}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="today-h" className={`${panel} min-w-0 flex-[999_1_520px] overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-baan-line px-7 py-5">
            <h2 id="today-h" className="font-display text-2xl font-bold text-baan-navy">Today&apos;s schedule</h2>
            <Link href="/staff/schedule" className="font-bold text-baan-teal hover:text-baan-navy">
              Open schedule
            </Link>
          </div>
          {settings?.closedDates.includes(today) && (
            <p className="border-b border-baan-line bg-[#EEF0F1] px-7 py-3 text-sm font-semibold text-[#55666B]">
              The health center is closed today.
            </p>
          )}
          {!todayRows?.length ? (
            <p className="px-7 py-10 text-center text-baan-muted">No appointments today.</p>
          ) : (
            slots.map((slot) => (
              <div key={slot}>
                <h3 className="bg-baan-mist px-7 py-2 text-[13px] font-bold tracking-[0.12em] text-baan-muted uppercase">{slot}</h3>
                <ul>
                  {todayRows
                    .filter((a) => a.time_slot === slot)
                    .map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-baan-line/70 px-7 py-3.5 last:border-b-0">
                        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                          <Link href={`/staff/residents?ref=${a.ref}`} className="font-bold text-baan-navy hover:underline">
                            {a.resident_name}
                          </Link>
                          <span className="text-sm text-baan-muted">{a.service}</span>
                        </div>
                        {overlaps.has(a.id) && <span className="text-xs font-bold text-[#9B2C2C]">Overlap</span>}
                        <span className="text-[13px] font-semibold text-baan-muted">{a.ref}</span>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>{a.status}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <section aria-labelledby="actions-h" className={`${panel} overflow-hidden`}>
            <h2 id="actions-h" className="border-b border-baan-line px-6 py-5 font-display text-2xl font-bold text-baan-navy">
              Quick actions
            </h2>
            <ul className="grid grid-cols-2 gap-3 p-5">
              {quickActions.map((q) => (
                <li key={q.href}>
                  <Link
                    href={q.href}
                    className="flex min-h-14 items-center justify-center rounded-xl border border-baan-line px-3 text-center text-sm font-bold text-baan-navy hover:border-baan-teal hover:bg-baan-mist"
                  >
                    {q.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="notices-h" className={`${panel} overflow-hidden`}>
            <div className="flex items-center justify-between gap-3 border-b border-baan-line px-6 py-5">
              <h2 id="notices-h" className="font-display text-2xl font-bold text-baan-navy">Notifications</h2>
              <Link href="/staff/notifications" className="font-bold text-baan-teal hover:text-baan-navy">
                View all
              </Link>
            </div>
            <ul className="flex flex-col gap-3 p-5">
              {notices?.length === 0 && (
                <li className="rounded-xl bg-[#E8F4F3] px-4 py-3.5">
                  <strong className="text-[#145C5A]">All clear</strong>
                  <p className="text-sm text-[#2F5654]">Nothing new in the last 7 days.</p>
                </li>
              )}
              {notices?.slice(0, 4).map((n, i) => (
                <NoticeItem key={i} n={n} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
