import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import {
  formatTimestamp,
  getAppointmentCountsByResident,
  getResidentAppointments,
  getResidents,
  isAdmin,
  type Resident,
  type ResidentAppointmentRow,
} from "@/lib/admin";
import { statusStyle } from "@/lib/appointment-options";
import { formatApptDate, manilaToday, refOf } from "@/lib/appointments";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Residents — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const label = "text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase";
const maxShown = 200;

const residentHref = (q: string, id?: string) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (id) params.set("id", id);
  return `/admin/residents${params.size ? `?${params}` : ""}`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const fromMs = (ms: number) => formatTimestamp(new Date(ms).toISOString());

export default function AdminResidentsPage({ searchParams }: PageProps<"/admin/residents">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <ResidentsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ResidentsContent({ searchParams }: { searchParams: PageProps<"/admin/residents">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const id = typeof params.id === "string" ? params.id : "";
  await connection(); // the list reflects live Clerk accounts

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [residents, counts] = await Promise.all([
    getResidents().catch(fail),
    getAppointmentCountsByResident().catch(fail),
  ]);

  const term = q.trim().toLowerCase();
  const matches = (residents ?? []).filter(
    (r) => !term || [r.name, r.email, r.phone].some((v) => v?.toLowerCase().includes(term)),
  );
  // Only open profiles of residents in the list, so this page can't be used to look up staff or admins.
  const selected = residents?.find((r) => r.id === id);
  const history = selected ? await getResidentAppointments(selected.id).catch(fail) : null;

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Residents</h1>
          <p className="text-[15px] text-baan-muted">
            {residents ? `${residents.length} registered ${residents.length === 1 ? "resident" : "residents"}` : "Registered residents"}{" "}
            · accounts without a staff or admin role
          </p>
        </div>
        <form action="/admin/residents" role="search" className="flex min-w-0 flex-[0_1_420px] gap-3">
          <label htmlFor="resident-q" className="sr-only">
            Search residents by name, email or mobile number
          </label>
          <input
            id="resident-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search name, email or mobile"
            className="min-h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-[#B9C9CC] bg-white px-5 text-base focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]"
          />
          <button type="submit" className="min-h-12 rounded-full bg-baan-orange px-6 text-base font-bold text-white hover:brightness-90">
            Search
          </button>
        </form>
      </div>

      {!residents && (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Residents couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      {residents && (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-label="Resident list" className={`${panel} min-w-0 flex-[999_1_480px] overflow-hidden`}>
            {matches.length === 0 ? (
              <p className="px-6 py-10 text-center text-baan-muted">
                {q ? `No residents match “${q}”.` : "No residents have signed up yet."}
              </p>
            ) : (
              <ul>
                {matches.slice(0, maxShown).map((r) => {
                  const visits = counts?.get(r.id) ?? 0;
                  return (
                    <li key={r.id} className="border-b border-baan-line/70 last:border-b-0">
                      <Link
                        href={residentHref(q, r.id)}
                        aria-current={r.id === selected?.id ? "true" : undefined}
                        className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5 hover:bg-baan-mist/60 ${r.id === selected?.id ? "bg-[#F1F8F8]" : ""}`}
                      >
                        <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-full bg-[#E3EEEF] font-display font-bold text-baan-navy">
                          {initials(r.name)}
                        </span>
                        <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                          <span className="font-bold text-baan-navy">{r.name}</span>
                          <span className="text-sm break-all text-baan-muted">{r.email}</span>
                        </span>
                        {r.possibleDuplicate && (
                          <span className="rounded-full bg-[#FFF1E8] px-2.5 py-0.5 text-xs font-bold text-[#9E3E14]">Possible duplicate</span>
                        )}
                        {r.banned && (
                          <span className="rounded-full bg-[#EEF0F1] px-2.5 py-0.5 text-xs font-bold text-[#55666B]">Deactivated</span>
                        )}
                        <span className="text-sm text-baan-muted">
                          {visits} {visits === 1 ? "appointment" : "appointments"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-baan-line px-6 py-3.5 text-sm text-baan-muted">
              {matches.length > maxShown ? `Showing the first ${maxShown} of ${matches.length}. Search to narrow the list. ` : ""}
              Sign-up already blocks a second account with the same email. Accounts sharing a name or mobile number are
              flagged as possible duplicates.
            </p>
          </section>

          <section aria-label="Resident profile" className={`${panel} min-w-0 flex-[1_1_360px] overflow-hidden`}>
            {selected ? (
              <ResidentProfile r={selected} history={history} closeHref={residentHref(q)} />
            ) : (
              <p className="px-6 py-10 text-center text-baan-muted">
                {id ? "That resident wasn't found." : "Choose a resident to see their profile and appointments."}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ResidentProfile({
  r,
  history,
  closeHref,
}: {
  r: Resident;
  history: ResidentAppointmentRow[] | null;
  closeHref: string;
}) {
  // Clerk rarely has a phone; the latest booking that included each detail is the best contact on file.
  const phone = history?.find((a) => a.phone)?.phone;
  const address = history?.find((a) => a.address)?.address;
  const fields: [string, string][] = [
    ["Email", r.email ?? "—"],
    ["Mobile number", r.phone ?? (phone ? `${phone} (from latest booking)` : "—")],
    ["Address (latest booking)", address ?? "—"],
    ["Joined", fromMs(r.joinedAt)],
    ["Last signed in", r.lastSignInAt ? fromMs(r.lastSignInAt) : "Never"],
  ];

  // Visit summary, same as the staff profile: archived records left out. History is newest first.
  const today = manilaToday();
  const visits = history?.filter((a) => !a.archived_at) ?? [];
  const lastVisit = visits.find((a) => a.status === "completed")?.appt_date;
  const nextVisit = visits.findLast((a) => (a.status === "pending" || a.status === "confirmed") && a.appt_date >= today)?.appt_date;
  const shortDate = (iso: string) => {
    const d = formatApptDate(iso);
    return `${d.weekday.slice(0, 3)}, ${d.month} ${d.day}`;
  };
  const summary = [
    { label: "Completed", value: String(visits.filter((a) => a.status === "completed").length), tone: "text-baan-teal" },
    { label: "Missed", value: String(visits.filter((a) => a.status === "missed").length), tone: "text-[#9B2C2C]" },
    { label: "Last visit", value: lastVisit ? shortDate(lastVisit) : "None yet", tone: "text-baan-navy" },
    { label: "Next visit", value: nextVisit ? shortDate(nextVisit) : "None booked", tone: "text-baan-orange" },
  ];

  return (
    <>
      <div className="flex items-center gap-4 border-b border-baan-line px-6 py-5">
        <span aria-hidden className="flex size-14 flex-none items-center justify-center rounded-full bg-baan-navy font-display text-xl font-bold text-white">
          {initials(r.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-display text-2xl font-bold break-words text-baan-navy">{r.name}</h2>
          <span
            className={`self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${r.banned ? "bg-[#EEF0F1] text-[#55666B]" : "bg-[#DDF3F2] text-[#145C5A]"}`}
          >
            {r.banned ? "Deactivated" : "Active account"}
          </span>
        </div>
        <Link href={closeHref} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-baan-muted hover:text-baan-navy">
          Close
        </Link>
      </div>

      <div className="flex flex-col gap-6 px-6 py-5">
        {r.possibleDuplicate && (
          <p className="rounded-xl bg-[#FFF1E8] px-4 py-3 text-sm text-[#5E3A28]">
            <strong className="block text-[#7E3210]">Possible duplicate</strong>
            Another resident account has the same name or mobile number. Check both before contacting or booking for them.
          </p>
        )}

        {history && (
          <dl aria-label="Visit summary" className="grid grid-cols-2 gap-2.5">
            {summary.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5 rounded-xl bg-baan-mist px-3.5 py-2.5">
                <dt className="text-xs font-semibold text-baan-muted">{s.label}</dt>
                <dd className={`font-display text-lg font-extrabold ${s.tone}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <dl className="flex flex-col gap-3.5">
          {fields.map(([name, value]) => (
            <div key={name} className="flex flex-col gap-0.5">
              <dt className={label}>{name}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3">
          <h3 className={label}>Visit history</h3>
          {!history ? (
            <p className="text-baan-muted">Appointments couldn&apos;t be loaded.</p>
          ) : history.length === 0 ? (
            <p className="text-baan-muted">No appointments yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {history.map((a) => {
                const d = formatApptDate(a.appt_date);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/admin/appointments?tab=${a.archived_at ? "archived" : "history"}&id=${a.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-baan-line px-4 py-3 hover:border-baan-teal"
                    >
                      <span className="flex min-w-0 flex-[1_1_160px] flex-col">
                        <span className="font-semibold text-baan-navy">{a.service}</span>
                        <span className="text-sm text-baan-muted">
                          {a.ref} · {d.weekday.slice(0, 3)}, {d.month} {d.day} · {a.time_slot.split(" (")[0]}
                          {a.archived_at ? " · Archived" : ""}
                        </span>
                        {a.follow_up_of && (
                          <span className="text-xs font-semibold text-baan-teal">Follow-up of {refOf(a.follow_up_of)}</span>
                        )}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>{a.status}</span>
                      {a.note && <span className="basis-full text-sm text-baan-muted">Note: {a.note}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
