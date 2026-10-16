import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminActions, RetryEmailButton } from "@/components/admin-actions";
import { AdminRowActions } from "@/components/admin-row-actions";
import {
  getActivityLog,
  getAdminAppointments,
  getAdminCounts,
  isAdmin,
  type ActivityEntry,
  type AdminAppointment,
} from "@/lib/admin";
import { statusStyle } from "@/lib/appointment-options";
import { formatApptDate, manilaToday } from "@/lib/appointments";

export const metadata: Metadata = {
  title: "Admin Dashboard — Baan Health Care",
  robots: { index: false, follow: false },
};

type Tab = "pending" | "history" | "archived" | "activity";

const tabs: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending requests" },
  { id: "history", label: "All appointments" },
  { id: "archived", label: "Archived" },
  { id: "activity", label: "Activity log" },
];

const panel = "rounded-[20px] border border-baan-line bg-white";
const th = "px-4 py-3";
const td = "px-4 py-4";

const formatTimestamp = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="w-full flex-1 bg-baan-mist text-baan-ink">
      <Suspense fallback={<p className="mx-auto max-w-310 px-6 py-24 text-baan-muted">Loading admin dashboard…</p>}>
        <AdminContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  const params = await searchParams;
  const tab: Tab = tabs.some((t) => t.id === params.tab) ? (params.tab as Tab) : "pending";
  const q = typeof params.q === "string" ? params.q : "";
  const staffOnly = params.who === "staff";
  await connection(); // "today" depends on the current time, so compute it per request
  const today = manilaToday();

  // A database problem shouldn't take down the whole page: log it and show a notice instead.
  const errors: unknown[] = [];
  const fail = (error: unknown) => {
    console.error(error);
    errors.push(error);
    return null;
  };
  const [counts, rows, log] = await Promise.all([
    getAdminCounts().catch(fail),
    tab === "activity" ? null : getAdminAppointments(tab, q).catch(fail),
    tab === "activity" ? getActivityLog(staffOnly).catch(fail) : null,
  ]);

  const stats = [
    { label: "Registered residents", value: counts?.residents, tone: "text-baan-navy" },
    { label: "Today's appointments", value: counts?.today, tone: "text-baan-teal" },
    { label: "Pending requests", value: counts?.pending, tone: "text-baan-orange" },
  ];

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <section className="flex flex-col gap-2 rounded-[20px] bg-baan-navy px-8 py-9 text-white">
        <p className="text-sm font-bold tracking-[0.18em] text-baan-mint uppercase">Admin dashboard</p>
        <h1 className="font-display text-[clamp(30px,4vw,42px)] leading-[1.08] font-extrabold">Health center overview</h1>
        <p className="text-[17px] text-[#CFE3E5]">All services, all residents, and every change made to appointments.</p>
      </section>

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} flex flex-col gap-1 px-6 py-5`}>
            <span className={`font-display text-[40px] leading-none font-extrabold ${s.tone}`}>{s.value ?? "—"}</span>
            <span className="font-semibold text-baan-muted">{s.label}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="tab-h" className={`${panel} flex flex-col gap-5 p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="tab-h" className="font-display text-2xl font-bold text-baan-navy">
            {tabs.find((t) => t.id === tab)?.label}
          </h2>
          <nav aria-label="Admin sections" className="flex flex-wrap rounded-full bg-baan-mist p-1">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={`/admin?tab=${t.id}`}
                aria-current={tab === t.id ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-5 text-[15px] font-bold ${
                  tab === t.id ? "bg-white text-baan-navy shadow-sm" : "text-baan-muted hover:text-baan-navy"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        {tab === "activity" ? (
          <nav aria-label="Filter activity" className="flex gap-4 text-[15px] font-bold">
            <Link href="/admin?tab=activity" aria-current={!staffOnly ? "page" : undefined} className={staffOnly ? "text-baan-muted hover:text-baan-navy" : "text-baan-teal underline"}>
              Everyone
            </Link>
            <Link href="/admin?tab=activity&who=staff" aria-current={staffOnly ? "page" : undefined} className={!staffOnly ? "text-baan-muted hover:text-baan-navy" : "text-baan-teal underline"}>
              Staff &amp; admins only
            </Link>
          </nav>
        ) : (
          <form action="/admin" role="search" className="flex flex-wrap gap-3">
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="admin-q" className="sr-only">
              Search by resident name or appointment ID
            </label>
            <input
              id="admin-q"
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
              <Link href={`/admin?tab=${tab}`} className="inline-flex min-h-12 items-center px-2 font-bold text-baan-muted hover:text-baan-navy">
                Clear
              </Link>
            )}
          </form>
        )}

        {(counts?.unsentEmails ?? 0) > 0 && (
          <p role="status" className="rounded-xl bg-[#FFF1E8] px-5 py-4 font-semibold text-[#9E3E14]">
            {counts!.unsentEmails} upcoming confirmed or rejected{" "}
            {counts!.unsentEmails === 1 ? "request hasn't" : "requests haven't"} been emailed to the resident.
            They&apos;re marked &ldquo;Email not sent&rdquo; under{" "}
            <Link href="/admin?tab=history" className="underline">
              All appointments
            </Link>
            .
          </p>
        )}

        {errors.length > 0 && (
          <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
            Some data couldn&apos;t be loaded. Please try again in a few minutes.
          </p>
        )}

        {rows && <AppointmentTable rows={rows} tab={tab} today={today} q={q} />}
        {log && <ActivityTable log={log} />}
      </section>
    </div>
  );
}

function AppointmentTable({ rows, tab, today, q }: { rows: AdminAppointment[]; tab: Tab; today: string; q: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">
        {q
          ? `No appointments match “${q}”.`
          : { pending: "No requests waiting for review.", archived: "No archived appointments.", history: "No appointments yet." }[
              tab as "pending" | "history" | "archived"
            ]}
      </p>
    );
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-baan-line">
        <table className="w-full min-w-215 border-collapse text-left text-[15px]">
          <thead className="bg-baan-mist text-[13px] tracking-[0.08em] text-baan-muted uppercase">
            <tr>
              <th scope="col" className={th}>ID</th>
              <th scope="col" className={th}>Resident</th>
              <th scope="col" className={th}>Service</th>
              <th scope="col" className={th}>Date &amp; time</th>
              <th scope="col" className={th}>Visit note</th>
              <th scope="col" className={th}>{tab === "pending" ? "Review" : "Status"}</th>
              {tab !== "pending" && <th scope="col" className={th}>Manage</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const d = formatApptDate(a.appt_date);
              return (
                <tr key={a.id} className="border-t border-baan-line align-top">
                  <td className={`${td} font-semibold whitespace-nowrap text-baan-muted`}>{a.ref}</td>
                  <td className={td}>
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
                  <td className={td}>{a.service}</td>
                  <td className={td}>
                    <div className="font-semibold whitespace-nowrap">
                      {a.appt_date === today ? "Today" : `${d.weekday.slice(0, 3)}, ${d.month} ${d.day}`}
                    </div>
                    <div className="text-baan-muted">{a.time_slot}</div>
                  </td>
                  <td className={`${td} max-w-60 break-words text-baan-muted`}>{a.note || "—"}</td>
                  <td className={td}>
                    {tab === "pending" ? (
                      <AdminActions id={a.id} resident={a.resident_name} canConfirm={a.appt_date >= today} />
                    ) : (
                      <>
                        <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>
                          {a.status}
                        </span>
                        {a.email_for === a.status && (a.email_status === "failed" || a.email_status === "no_email") && (
                            <div className="mt-2 flex flex-col items-start gap-1">
                              <span
                                title={a.email_error ?? undefined}
                                className="rounded-full bg-[#FBE9E9] px-2.5 py-0.5 text-xs font-bold text-[#9B2C2C]"
                              >
                                Email not sent{a.email_status === "no_email" ? " (no address)" : ""}
                              </span>
                              {a.appt_date >= today && <RetryEmailButton id={a.id} />}
                            </div>
                          )}
                        {a.email_for === a.status && a.email_status === "sent" && (
                          <div className="mt-2 text-sm text-baan-teal">Resident emailed</div>
                        )}
                        <div className="mt-2 text-sm text-baan-muted">Updated {formatTimestamp(a.updated_at)}</div>
                        {a.archived_at && (
                          <div className="text-sm text-baan-muted">Archived {formatTimestamp(a.archived_at)}</div>
                        )}
                      </>
                    )}
                  </td>
                  {tab !== "pending" && (
                    <td className={td}>
                      <AdminRowActions appointment={a} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-baan-muted">
        Showing up to 200 appointments across all services.
        {tab === "archived" ? " Archived appointments are hidden from residents and staff." : ""} Every change is kept in the activity log.
      </p>
    </>
  );
}

const fieldLabels: Record<string, string> = {
  resident_name: "Name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  service: "Service",
  appt_date: "Date",
  time_slot: "Time",
  note: "Note",
};

const show = (value: unknown) => (value === null || value === "" ? "(empty)" : String(value));

function ActivityAction({ e }: { e: ActivityEntry }) {
  const badge = (status: ActivityEntry["new_status"]) => (
    <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[status]}`}>{status}</span>
  );
  switch (e.action) {
    case "created":
      return <span className="font-semibold">Booked appointment</span>;
    case "status":
      return (
        <span className="flex flex-wrap items-center gap-2">
          {e.old_status && badge(e.old_status)}
          <span aria-label="changed to">→</span>
          {badge(e.new_status)}
        </span>
      );
    case "edited":
      return (
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Edited details</span>
          <ul className="text-sm text-baan-muted">
            {Object.entries((e.details ?? {}) as Record<string, { from: unknown; to: unknown }>).map(([key, c]) => (
              <li key={key}>
                {fieldLabels[key] ?? key}: {show(c.from)} → <span className="text-baan-ink">{show(c.to)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "archived":
      return <span className="font-semibold">Archived</span>;
    case "restored":
      return <span className="font-semibold">Restored from archive</span>;
    case "deleted":
      return <span className="font-semibold text-[#9B2C2C]">Permanently deleted</span>;
  }
}

const roleStyle: Record<ActivityEntry["actor_role"], string> = {
  resident: "bg-baan-mist text-baan-muted",
  staff: "bg-[#DDF3F2] text-[#145C5A]",
  admin: "bg-[#FFF1E8] text-[#9E3E14]",
  system: "bg-[#EEF0F1] text-[#55666B]",
};

function ActivityTable({ log }: { log: ActivityEntry[] }) {
  if (log.length === 0) {
    return <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">No activity recorded yet.</p>;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-baan-line">
        <table className="w-full min-w-215 border-collapse text-left text-[15px]">
          <thead className="bg-baan-mist text-[13px] tracking-[0.08em] text-baan-muted uppercase">
            <tr>
              <th scope="col" className={th}>When</th>
              <th scope="col" className={th}>Who</th>
              <th scope="col" className={th}>Action</th>
              <th scope="col" className={th}>Appointment</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} className="border-t border-baan-line align-top">
                <td className={`${td} whitespace-nowrap text-baan-muted`}>{formatTimestamp(e.created_at)}</td>
                <td className={td}>
                  <div className="font-semibold text-baan-navy">{e.actor_name}</div>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${roleStyle[e.actor_role]}`}>
                    {e.actor_role}
                  </span>
                </td>
                <td className={td}>
                  <ActivityAction e={e} />
                </td>
                <td className={td}>
                  <div className="font-semibold text-baan-muted">{e.appointment_ref}</div>
                  {e.appointment ? (
                    <div>
                      {e.appointment.resident_name} · {e.appointment.service}
                    </div>
                  ) : e.action === "deleted" && e.details ? (
                    <div>
                      {show(e.details.resident_name)} · {show(e.details.service)}
                    </div>
                  ) : (
                    <div className="text-baan-muted">Deleted</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-baan-muted">
        Showing the latest 100 changes. Entries are written by the database and can&apos;t be edited or deleted.
      </p>
    </>
  );
}
