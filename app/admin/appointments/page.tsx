import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminActions, RetryEmailButton } from "@/components/admin-actions";
import { AdminRowActions } from "@/components/admin-row-actions";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { ActivityAction } from "@/components/activity-action";
import {
  formatTimestamp,
  getActivityLog,
  getAdminAppointment,
  getAdminAppointments,
  getUnsentEmailCount,
  isAdmin,
  type ActivityEntry,
  type AdminAppointment,
  type AppointmentDetail,
  type EmailFilter,
} from "@/lib/admin";
import { statusStyle } from "@/lib/appointment-options";
import { formatApptDate, manilaToday } from "@/lib/appointments";
import { getServices } from "@/lib/services";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Appointments — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

type Tab = "pending" | "history" | "archived";

const tabs: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending requests" },
  { id: "history", label: "All appointments" },
  { id: "archived", label: "Archived" },
];

const emailFilters: { id: EmailFilter; label: string }[] = [
  { id: "failed", label: "Email not sent" },
  { id: "sent", label: "Email sent" },
  { id: "none", label: "Not emailed yet" },
];

type ListState = { tab: Tab; q: string; email?: EmailFilter };

// Link to the list with the current filters kept, optionally opening one appointment's details.
const listHref = ({ tab, q, email }: ListState, id?: number) => {
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  if (email) params.set("email", email);
  if (id !== undefined) params.set("id", String(id));
  return `/admin/appointments?${params}`;
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const th = "px-4 py-3";
const td = "px-4 py-4";

export default function AdminAppointmentsPage({ searchParams }: PageProps<"/admin/appointments">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <AdminContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function AdminContent({ searchParams }: { searchParams: PageProps<"/admin/appointments">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  const params = await searchParams;
  const tab: Tab = tabs.some((t) => t.id === params.tab) ? (params.tab as Tab) : "pending";
  const q = typeof params.q === "string" ? params.q : "";
  const email = emailFilters.find((f) => f.id === params.email)?.id;
  const list: ListState = { tab, q, email };
  const detailId = Number(params.id);
  const hasDetail = Number.isInteger(detailId) && detailId > 0;
  await connection(); // "today" depends on the current time, so compute it per request
  const today = manilaToday();

  // A database problem shouldn't take down the whole page: log it and show a notice instead.
  const errors: unknown[] = [];
  const fail = (error: unknown) => {
    console.error(error);
    errors.push(error);
    return null;
  };
  const [unsentEmails, rows, detail, history, services] = await Promise.all([
    getUnsentEmailCount().catch(fail),
    getAdminAppointments(tab, q, email).catch(fail),
    hasDetail ? getAdminAppointment(detailId).catch(fail) : null,
    hasDetail ? getActivityLog({ appointmentId: detailId }).catch(fail) : null,
    getServices().catch(fail),
  ]);

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Appointments</h1>
        <p className="text-[15px] text-baan-muted">Review requests, update visits and keep residents informed.</p>
      </div>

      <section aria-labelledby="tab-h" className={`${panel} flex flex-col gap-5 p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="tab-h" className="font-display text-2xl font-bold text-baan-navy">
            {tabs.find((t) => t.id === tab)?.label}
          </h2>
          <nav aria-label="Appointment lists" className="flex flex-wrap rounded-full bg-baan-mist p-1">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={`/admin/appointments?tab=${t.id}`}
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

        <form action="/admin/appointments" role="search" className="flex flex-wrap gap-3">
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
          <label htmlFor="admin-email" className="sr-only">
            Email status
          </label>
          <select
            id="admin-email"
            name="email"
            defaultValue={email ?? ""}
            className="min-h-12 rounded-full border-[1.5px] border-[#B9C9CC] bg-white px-4 text-base focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]"
          >
            <option value="">Any email status</option>
            {emailFilters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <button type="submit" className="min-h-12 rounded-full bg-baan-orange px-6 text-base font-bold text-white hover:brightness-90">
            Search
          </button>
          {(q || email) && (
            <Link href={`/admin/appointments?tab=${tab}`} className="inline-flex min-h-12 items-center px-2 font-bold text-baan-muted hover:text-baan-navy">
              Clear
            </Link>
          )}
        </form>

        {(unsentEmails ?? 0) > 0 && (
          <p role="status" className="rounded-xl bg-[#FFF1E8] px-5 py-4 font-semibold text-[#9E3E14]">
            {unsentEmails} upcoming confirmed or rejected{" "}
            {unsentEmails === 1 ? "request hasn't" : "requests haven't"} been emailed to the resident.
            They&apos;re marked &ldquo;Email not sent&rdquo; under{" "}
            <Link href="/admin/appointments?tab=history" className="underline">
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

        {hasDetail &&
          (detail ? (
            <AppointmentDetails a={detail} history={history} today={today} closeHref={listHref(list)} />
          ) : (
            detail === null &&
            errors.length === 0 && (
              <p role="alert" className="rounded-xl bg-baan-mist px-5 py-4 text-center text-baan-muted">
                That appointment no longer exists.{" "}
                <Link href={listHref(list)} className="font-bold underline">
                  Close
                </Link>
              </p>
            )
          ))}

        {rows && (
          <AppointmentTable
            rows={rows}
            list={list}
            selectedId={detail?.id}
            today={today}
            services={(services ?? []).map((s) => s.name)}
          />
        )}
      </section>
    </div>
  );
}

function AppointmentTable({
  rows,
  list,
  selectedId,
  today,
  services,
}: {
  rows: AdminAppointment[];
  list: ListState;
  selectedId?: number;
  today: string;
  services: string[];
}) {
  const { tab, q, email } = list;
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">
        {q
          ? `No appointments match “${q}”.`
          : email
            ? "No appointments with this email status."
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
                <tr key={a.id} className={`border-t border-baan-line align-top ${a.id === selectedId ? "bg-[#F1F8F8]" : ""}`}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link
                      href={listHref(list, a.id)}
                      aria-current={a.id === selectedId ? "true" : undefined}
                      className="font-semibold text-baan-teal underline-offset-2 hover:underline"
                    >
                      {a.ref}
                      <span className="sr-only">, view details</span>
                    </Link>
                  </td>
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
                      <AdminRowActions appointment={a} services={services} />
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
        {tab === "archived" ? " Archived appointments are hidden from residents and staff." : ""} Every change is kept in the{" "}
        <Link href="/admin/audit" className="underline">
          audit log
        </Link>
        .
      </p>
    </>
  );
}

const label = "text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase";

// Everything about one appointment: contact details, the resident's email, and its status history.
function AppointmentDetails({
  a,
  history,
  today,
  closeHref,
}: {
  a: AppointmentDetail;
  history: ActivityEntry[] | null;
  today: string;
  closeHref: string;
}) {
  const d = formatApptDate(a.appt_date);
  const fields: [string, string][] = [
    ["Service", a.service],
    ["Date & time", `${d.weekday}, ${d.month} ${d.day} · ${a.time_slot}`],
    ["Email", a.email ?? "—"],
    ["Mobile number", a.phone ?? "—"],
    ["Address", a.address ?? "—"],
    ["Visit note", a.note || "—"],
    ["Booked", formatTimestamp(a.created_at)],
    ["Last updated", formatTimestamp(a.updated_at)],
  ];
  // Same rule as the Retry button in the table: only for the current decision, before the visit.
  const canRetry =
    a.email_for === a.status && (a.email_status === "failed" || a.email_status === "no_email") && a.appt_date >= today;

  return (
    <section aria-labelledby="detail-h" className="overflow-hidden rounded-2xl border border-baan-line">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-baan-navy px-6 py-5 text-white">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold tracking-[0.18em] text-baan-mint uppercase">
            {a.ref}
            {a.archived_at ? " · Archived" : ""}
          </p>
          <h3 id="detail-h" className="font-display text-2xl font-bold">
            {a.resident_name}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>{a.status}</span>
          <Link
            href={closeHref}
            className="inline-flex min-h-11 items-center rounded-full border-2 border-white/80 px-4 text-sm font-bold text-white hover:bg-white/10"
          >
            Close
          </Link>
        </div>
      </div>

      <div className="grid gap-8 p-6 md:grid-cols-2">
        <dl className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">
          {fields.map(([name, value]) => (
            <div key={name} className="flex min-w-0 flex-col gap-0.5">
              <dt className={label}>{name}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h4 className={label}>Email to resident</h4>
            {!a.email_status && (
              <p className="rounded-xl bg-baan-mist px-4 py-3 text-baan-muted">
                Not emailed yet. Residents are emailed when a request is confirmed or rejected.
              </p>
            )}
            {a.email_status === "sent" && (
              <p className="rounded-xl bg-[#E8F4F3] px-4 py-3 text-[#145C5A]">
                <span className="font-semibold capitalize">{a.email_for}</span> email sent
                {a.email_sent_at ? ` ${formatTimestamp(a.email_sent_at)}` : ""}.
              </p>
            )}
            {(a.email_status === "failed" || a.email_status === "no_email") && (
              <div className="flex flex-col items-start gap-2 rounded-xl bg-[#FBE9E9] px-4 py-3 text-[#5E2A2A]">
                <p>
                  <span className="font-semibold capitalize text-[#7F2222]">{a.email_for}</span> email not sent
                  {a.email_status === "no_email"
                    ? ": there's no email address on file. Add one with Edit, then retry."
                    : ` after ${a.email_attempts} ${a.email_attempts === 1 ? "attempt" : "attempts"}.`}
                </p>
                {a.email_error && a.email_status === "failed" && (
                  <p className="text-sm break-words">Error: {a.email_error}</p>
                )}
                {canRetry && <RetryEmailButton id={a.id} />}
              </div>
            )}
            {a.email_status && a.email_for !== a.status && (
              <p className="text-sm text-baan-muted">
                That email was for the earlier &ldquo;{a.email_for}&rdquo; decision.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h4 className={label}>Status history</h4>
            {!history ? (
              <p className="text-baan-muted">The history couldn&apos;t be loaded.</p>
            ) : history.length === 0 ? (
              <p className="text-baan-muted">No changes recorded.</p>
            ) : (
              <ol className="flex flex-col gap-4 border-l-2 border-baan-line pl-5">
                {history.map((e) => (
                  <li key={e.id} className="relative flex flex-col gap-1">
                    <span aria-hidden className="absolute top-1.5 -left-[27px] size-3 rounded-full bg-baan-teal" />
                    <ActivityAction e={e} />
                    <span className="text-sm text-baan-muted">
                      {e.actor_name} ({e.actor_role}) · {formatTimestamp(e.created_at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
