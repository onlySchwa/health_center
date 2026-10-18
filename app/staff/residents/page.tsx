import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { statusStyle } from "@/lib/appointment-options";
import { formatApptDate, getStaffAccess, refOf, type StaffAppointment } from "@/lib/appointments";
import { getStaffResidentHistory, getStaffResidents, type StaffResident } from "@/lib/staff";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "Residents — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const label = "text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase";
const maxShown = 200;

const residentHref = (q: string, ref?: string) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (ref) params.set("ref", ref);
  return `/staff/residents${params.size ? `?${params}` : ""}`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const shortDate = (iso: string) => {
  const d = formatApptDate(iso);
  return `${d.weekday.slice(0, 3)}, ${d.month} ${d.day}`;
};

export default function StaffResidentsPage({ searchParams }: PageProps<"/staff/residents">) {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <ResidentsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ResidentsContent({ searchParams }: { searchParams: PageProps<"/staff/residents">["searchParams"] }) {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  const ref = typeof params.ref === "string" ? params.ref.slice(0, 20) : "";
  await connection(); // live appointment data

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const hasServices = staff.services.length > 0;
  const [residents, history] = await Promise.all([
    hasServices ? getStaffResidents(staff.services).catch(fail) : Promise.resolve([]),
    hasServices && ref ? getStaffResidentHistory(staff.services, ref).catch(fail) : Promise.resolve(null),
  ]);

  const term = q.trim().toLowerCase();
  const matches = (residents ?? []).filter(
    (r) => !term || [r.name, r.email, r.phone].some((v) => v?.toLowerCase().includes(term)),
  );
  // The profile belongs to whoever booked appointment `ref`; history holds only this staff member's services.
  const selectedRef = history?.[0] ? ref : "";
  const selected = history?.[0] && residents?.find((r) => history.some((a) => a.ref === r.ref));

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Residents</h1>
          <p className="text-[15px] text-baan-muted">
            {residents ? `${residents.length} ${residents.length === 1 ? "resident" : "residents"}` : "Residents"} who booked your
            services
          </p>
        </div>
        <form action="/staff/residents" role="search" className="flex min-w-0 flex-[0_1_420px] gap-3">
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
                {q ? `No residents match “${q}”.` : hasServices ? "No resident has booked your services yet." : "No services assigned yet."}
              </p>
            ) : (
              <ul>
                {matches.slice(0, maxShown).map((r) => {
                  const active = r === selected;
                  return (
                    <li key={r.ref} className="border-b border-baan-line/70 last:border-b-0">
                      <Link
                        href={residentHref(q, r.ref)}
                        aria-current={active ? "true" : undefined}
                        className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5 hover:bg-baan-mist/60 ${active ? "bg-[#F1F8F8]" : ""}`}
                      >
                        <span aria-hidden className="flex size-11 flex-none items-center justify-center rounded-full bg-[#E3EEEF] font-display font-bold text-baan-navy">
                          {initials(r.name)}
                        </span>
                        <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                          <span className="font-bold text-baan-navy">{r.name}</span>
                          <span className="text-sm break-all text-baan-muted">{r.email ?? r.phone ?? "—"}</span>
                        </span>
                        <span className="text-sm text-baan-muted">
                          {r.visits} {r.visits === 1 ? "appointment" : "appointments"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="border-t border-baan-line px-6 py-3.5 text-sm text-baan-muted">
              {matches.length > maxShown ? `Showing the first ${maxShown} of ${matches.length}. Search to narrow the list. ` : ""}
              Only residents and visits in your assigned services are shown.
            </p>
          </section>

          <section aria-label="Resident profile" className={`${panel} min-w-0 flex-[1_1_360px] overflow-hidden`}>
            {selected && history ? (
              <ResidentProfile r={selected} history={history} closeHref={residentHref(q)} />
            ) : (
              <p className="px-6 py-10 text-center text-baan-muted">
                {ref && !selectedRef ? "That resident wasn't found in your services." : "Choose a resident to see their visit history."}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ResidentProfile({ r, history, closeHref }: { r: StaffResident; history: StaffAppointment[]; closeHref: string }) {
  // History is newest first, so these are the latest booking that included each detail.
  const phone = history.find((a) => a.phone)?.phone;
  const address = history.find((a) => a.address)?.address;
  const fields: [string, string][] = [
    ["Email", r.email ?? "—"],
    ["Mobile number", phone ?? "—"],
    ["Address (latest booking)", address ?? "—"],
    ["Last completed visit", r.lastVisit ? shortDate(r.lastVisit) : "None yet"],
    ["Next visit", r.nextVisit ? shortDate(r.nextVisit) : "None booked"],
  ];
  const missed = history.filter((a) => a.status === "missed").length;

  return (
    <>
      <div className="flex items-center gap-4 border-b border-baan-line px-6 py-5">
        <span aria-hidden className="flex size-14 flex-none items-center justify-center rounded-full bg-baan-navy font-display text-xl font-bold text-white">
          {initials(r.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-display text-2xl font-bold break-words text-baan-navy">{r.name}</h2>
          <span className="text-sm text-baan-muted">
            {r.completed} completed · {missed} missed
          </span>
        </div>
        <Link href={closeHref} className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-baan-muted hover:text-baan-navy">
          Close
        </Link>
      </div>

      <div className="flex flex-col gap-6 px-6 py-5">
        <dl className="flex flex-col gap-3.5">
          {fields.map(([name, value]) => (
            <div key={name} className="flex flex-col gap-0.5">
              <dt className={label}>{name}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3">
          <h3 className={label}>Visit history (your services)</h3>
          <ul className="flex flex-col gap-2.5">
            {history.map((a) => (
              <li key={a.id} className="flex flex-col gap-1.5 rounded-xl border border-baan-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="flex min-w-0 flex-[1_1_160px] flex-col">
                    <span className="font-semibold text-baan-navy">{a.service}</span>
                    <span className="text-sm text-baan-muted">
                      {a.ref} · {shortDate(a.appt_date)} · {a.time_slot.split(" (")[0]}
                    </span>
                    {a.follow_up_of && <span className="text-xs font-semibold text-baan-teal">Follow-up of {refOf(a.follow_up_of)}</span>}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>{a.status}</span>
                </div>
                {a.note && <p className="text-sm text-baan-muted">Note: {a.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
