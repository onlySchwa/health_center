import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StaffActions } from "@/components/staff-actions";
import { statusStyle } from "@/lib/appointment-options";
import {
  formatApptDate,
  getStaffAccess,
  getStaffAppointments,
  getStaffCounts,
  manilaToday,
  type StaffView,
} from "@/lib/appointments";

export const metadata: Metadata = {
  title: "Staff Dashboard — Baan Health Care",
  robots: { index: false, follow: false },
};

const views: { id: StaffView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
];

const panel = "rounded-[20px] border border-baan-line bg-white";

export default function StaffPage({ searchParams }: PageProps<"/staff">) {
  return (
    <main className="w-full flex-1 bg-baan-mist text-baan-ink">
      <Suspense fallback={<p className="mx-auto max-w-310 px-6 py-24 text-baan-muted">Loading appointments…</p>}>
        <StaffContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StaffContent({ searchParams }: { searchParams: PageProps<"/staff">["searchParams"] }) {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();

  const params = await searchParams;
  const view: StaffView = views.some((v) => v.id === params.view) ? (params.view as StaffView) : "today";
  const q = typeof params.q === "string" ? params.q : "";
  await connection(); // "today" depends on the current time, so compute it per request
  const today = manilaToday();

  const hasServices = staff.services.length > 0;
  const noCounts = { todayTotal: 0, completedToday: 0, missedToday: 0, upcomingOpen: 0 };
  // A database problem shouldn't take down the whole page: log it and show a notice instead.
  let loadFailed = false;
  const [rows, counts] = hasServices
    ? await Promise.all([getStaffAppointments(staff.services, view, q), getStaffCounts(staff.services)]).catch(
        (error) => {
          console.error(error);
          loadFailed = true;
          return [[], noCounts] as const;
        },
      )
    : [[], noCounts];

  const stats = [
    { label: "Scheduled today", value: counts.todayTotal, tone: "text-baan-navy" },
    { label: "Completed today", value: counts.completedToday, tone: "text-baan-teal" },
    { label: "Missed today", value: counts.missedToday, tone: "text-[#9B2C2C]" },
    { label: "Upcoming (open)", value: counts.upcomingOpen, tone: "text-baan-orange" },
  ];

  const viewHref = (id: StaffView) => `/staff?view=${id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <section className="flex flex-col gap-4 rounded-[20px] bg-baan-navy px-8 py-9 text-white">
        <p className="text-sm font-bold tracking-[0.18em] text-baan-mint uppercase">Staff dashboard</p>
        <h1 className="font-display text-[clamp(30px,4vw,42px)] leading-[1.08] font-extrabold">Resident appointments</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] text-[#CFE3E5]">You handle:</span>
          {hasServices ? (
            staff.services.map((s) => (
              <span key={s} className="rounded-full bg-white/12 px-3 py-1 text-sm font-semibold">
                {s}
              </span>
            ))
          ) : (
            <span className="text-[15px] font-semibold text-baan-mint">
              No services assigned yet — ask an administrator to add them to your account.
            </span>
          )}
        </div>
      </section>

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} flex flex-col gap-1 px-6 py-5`}>
            <span className={`font-display text-[40px] leading-none font-extrabold ${s.tone}`}>{s.value}</span>
            <span className="font-semibold text-baan-muted">{s.label}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="list-h" className={`${panel} flex flex-col gap-5 p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="list-h" className="font-display text-2xl font-bold text-baan-navy">Appointments</h2>
          <nav aria-label="Filter by date" className="flex rounded-full bg-baan-mist p-1">
            {views.map((v) => (
              <Link
                key={v.id}
                href={viewHref(v.id)}
                aria-current={view === v.id ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-5 text-[15px] font-bold ${
                  view === v.id ? "bg-white text-baan-navy shadow-sm" : "text-baan-muted hover:text-baan-navy"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </nav>
        </div>

        <form action="/staff" role="search" className="flex flex-wrap gap-3">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="staff-q" className="sr-only">
            Search by resident name or appointment ID
          </label>
          <input
            id="staff-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search resident name or ID (e.g. BHC-000012)"
            className="min-h-12 min-w-0 flex-[1_1_280px] rounded-full border-[1.5px] border-[#B9C9CC] bg-white px-5 text-base focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]"
          />
          <button
            type="submit"
            className="min-h-12 rounded-full bg-baan-orange px-6 text-base font-bold text-white hover:brightness-90"
          >
            Search
          </button>
          {q && (
            <Link href={`/staff?view=${view}`} className="inline-flex min-h-12 items-center px-2 font-bold text-baan-muted hover:text-baan-navy">
              Clear
            </Link>
          )}
        </form>

        {loadFailed ? (
          <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-10 text-center font-semibold text-[#9E3E14]">
            Appointments couldn&apos;t be loaded. Please try again in a few minutes.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">
            {q ? `No appointments match “${q}”.` : "No appointments here."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-baan-line">
            <table className="w-full min-w-215 border-collapse text-left text-[15px]">
              <thead className="bg-baan-mist text-[13px] tracking-[0.08em] text-baan-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">ID</th>
                  <th scope="col" className="px-4 py-3">Resident</th>
                  <th scope="col" className="px-4 py-3">Service</th>
                  <th scope="col" className="px-4 py-3">Date &amp; time</th>
                  <th scope="col" className="px-4 py-3">Visit note</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Mark as</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const d = formatApptDate(a.appt_date);
                  const isOpen = a.status === "pending" || a.status === "confirmed";
                  return (
                    <tr key={a.id} className="border-t border-baan-line align-top">
                      <td className="px-4 py-4 font-semibold whitespace-nowrap text-baan-muted">{a.ref}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-baan-navy">{a.resident_name}</div>
                        {a.email && (
                          <a href={`mailto:${a.email}`} className="block break-all text-baan-teal hover:underline">
                            {a.email}
                          </a>
                        )}
                        {a.phone && (
                          <a href={`tel:${a.phone}`} className="block text-baan-teal hover:underline">
                            {a.phone}
                          </a>
                        )}
                        {a.address && <div className="max-w-60 text-sm break-words text-baan-muted">{a.address}</div>}
                      </td>
                      <td className="px-4 py-4">{a.service}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold whitespace-nowrap">
                          {a.appt_date === today ? "Today" : `${d.weekday.slice(0, 3)}, ${d.month} ${d.day}`}
                        </div>
                        <div className="text-baan-muted">{a.time_slot}</div>
                      </td>
                      <td className="max-w-60 px-4 py-4 break-words text-baan-muted">{a.note || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {isOpen && a.appt_date <= today ? (
                          <StaffActions id={a.id} resident={a.resident_name} />
                        ) : (
                          <span className="text-sm text-baan-muted">{isOpen ? "Not due yet" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-sm text-baan-muted">
          Showing up to 200 appointments for your assigned services. Records can&apos;t be deleted.
        </p>
      </section>
    </div>
  );
}
