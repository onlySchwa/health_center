import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { FollowUpButton, StaffActions, UndoButton, WalkInForm } from "@/components/staff-actions";
import { statusStyle } from "@/lib/appointment-options";
import { formatApptDate, getStaffAccess, getStaffAppointments, manilaToday, refOf, type StaffView } from "@/lib/appointments";
import { getServices } from "@/lib/services";
import { getStaffRowState } from "@/lib/staff";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "Appointments — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

const views: { id: StaffView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "requests", label: "Requests" },
  { id: "all", label: "All" },
];

const panel = "rounded-[20px] border border-baan-line bg-white";

export default function StaffAppointmentsPage({ searchParams }: PageProps<"/staff/appointments">) {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <AppointmentsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function AppointmentsContent({ searchParams }: { searchParams: PageProps<"/staff/appointments">["searchParams"] }) {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();

  const params = await searchParams;
  const view: StaffView = views.some((v) => v.id === params.view) ? (params.view as StaffView) : "today";
  const q = typeof params.q === "string" ? params.q : "";
  await connection(); // "today" depends on the current time, so compute it per request
  const today = manilaToday();

  // A database problem shouldn't take down the whole page: log it and show a notice instead.
  let loadFailed = false;
  const rows =
    staff.services.length === 0
      ? []
      : await getStaffAppointments(staff.services, view, q).catch((error) => {
          console.error(error);
          loadFailed = true;
          return [];
        });

  // Which rows get "Book next visit" and "Undo mark", and each service's time slots for the follow-up form.
  const [rowState, services] = await Promise.all([
    getStaffRowState(rows).catch((error) => {
      console.error(error);
      return { withFollowUp: new Set<number>(), undoUntil: new Map<number, string>() };
    }),
    getServices().catch((error) => {
      console.error(error);
      return [];
    }),
  ]);
  const slotsFor = (service: string) => services.find((s) => s.name === service)?.timeSlots ?? [];

  const viewHref = (id: StaffView) => `/staff/appointments?view=${id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Appointments</h1>
        <p className="text-[15px] text-baan-muted">Requests, visits and status changes for your services.</p>
      </div>

      <section aria-labelledby="list-h" className={`${panel} flex flex-col gap-5 p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="list-h" className="font-display text-2xl font-bold text-baan-navy">
            {views.find((v) => v.id === view)!.label}
          </h2>
          <nav aria-label="Filter appointments" className="flex flex-wrap rounded-full bg-baan-mist p-1">
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

        {view === "requests" && (
          <p className="rounded-xl bg-[#FFF1E8] px-4 py-3 text-sm text-[#5E3A28]">
            New requests waiting for review. Confirm or reject them so residents know whether to come in; they&apos;re emailed
            the decision. Administrators can decide them too.
          </p>
        )}

        {staff.services.length > 0 && (
          <WalkInForm
            services={services.filter((s) => s.active && staff.services.includes(s.name) && s.timeSlots.length > 0)}
          />
        )}

        <form action="/staff/appointments" role="search" className="flex flex-wrap gap-3">
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
          <button type="submit" className="min-h-12 rounded-full bg-baan-orange px-6 text-base font-bold text-white hover:brightness-90">
            Search
          </button>
          {q && (
            <Link href={`/staff/appointments?view=${view}`} className="inline-flex min-h-12 items-center px-2 font-bold text-baan-muted hover:text-baan-navy">
              Clear
            </Link>
          )}
        </form>

        {staff.services.length === 0 ? (
          <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">
            No services assigned yet. Ask an administrator to add them to your account.
          </p>
        ) : loadFailed ? (
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
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const d = formatApptDate(a.appt_date);
                  // Same rules the database enforces (0014_staff_review.sql).
                  const choices = [
                    ...(a.status === "pending" && a.appt_date >= today ? (["confirmed", "rejected"] as const) : []),
                    ...((a.status === "pending" || a.status === "confirmed") && a.appt_date <= today
                      ? (["completed", "missed"] as const)
                      : []),
                  ];
                  return (
                    <tr key={a.id} className="border-t border-baan-line align-top">
                      <td className="px-4 py-4 font-semibold whitespace-nowrap text-baan-muted">{a.ref}</td>
                      <td className="px-4 py-4">
                        <Link href={`/staff/residents?ref=${a.ref}`} className="font-semibold text-baan-navy hover:underline">
                          {a.resident_name}
                        </Link>
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
                      <td className="px-4 py-4">
                        {a.service}
                        {a.walk_in && <span className="mt-1 block text-xs font-semibold text-baan-orange">Walk-in</span>}
                        {a.follow_up_of && (
                          <span className="mt-1 block text-xs font-semibold text-baan-teal">Follow-up of {refOf(a.follow_up_of)}</span>
                        )}
                      </td>
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
                        <div className="flex flex-col gap-3">
                          {choices.length > 0 && <StaffActions id={a.id} resident={a.resident_name} choices={choices} />}
                          {rowState.undoUntil.has(a.id) && <UndoButton id={a.id} until={rowState.undoUntil.get(a.id)!} />}
                          {a.status === "completed" && !rowState.withFollowUp.has(a.id) && slotsFor(a.service).length > 0 && (
                            <FollowUpButton id={a.id} slots={slotsFor(a.service)} today={today} />
                          )}
                          {a.status === "completed" && rowState.withFollowUp.has(a.id) && (
                            <span className="text-sm font-semibold text-baan-teal">Next visit booked</span>
                          )}
                          {choices.length === 0 && a.status === "confirmed" && (
                            <span className="text-sm text-baan-muted">
                              You can mark this completed or missed on {d.month} {d.day}.
                            </span>
                          )}
                          {choices.length === 0 &&
                            (a.status === "pending" || a.status === "cancelled" || a.status === "rejected" ||
                              (a.status === "missed" && !rowState.undoUntil.has(a.id))) && (
                              <span className="text-sm text-baan-muted">—</span>
                            )}
                        </div>
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
