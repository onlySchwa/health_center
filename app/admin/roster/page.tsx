import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DayNav } from "@/components/day-nav";
import { DutyToggle } from "@/components/duty-toggle";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { getAccounts, isAdmin } from "@/lib/admin";
import { manilaToday } from "@/lib/appointments";
import { longDate } from "@/lib/reports";
import { getOnDuty } from "@/lib/roster";
import { addDaysIso, isIsoDate } from "@/lib/staff";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Duty Roster — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";

export default function AdminRosterPage({ searchParams }: PageProps<"/admin/roster">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <RosterContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function RosterContent({ searchParams }: { searchParams: PageProps<"/admin/roster">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the checks inside setDuty) keeps
  // the roster safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  const params = await searchParams;
  await connection(); // "today" depends on the current time, and the team list on live Clerk accounts
  const today = manilaToday();
  const date = isIsoDate(params.date) ? params.date : today;
  const past = date < today;

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [accounts, onDuty] = await Promise.all([getAccounts().catch(fail), getOnDuty(date).catch(fail)]);
  const onDutyIds = new Set(onDuty?.map((p) => p.userId));
  // Nurses first, then staff; deactivated accounts only if they were on duty that day.
  const team = (accounts ?? [])
    .filter((a) => (a.role === "nurse" || a.role === "staff") && (!a.banned || onDutyIds.has(a.id)))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "nurse" ? -1 : 1));
  // Someone on duty that day whose role has since changed still shows, so they can be taken off.
  const others = (onDuty ?? []).filter((p) => !team.some((a) => a.id === p.userId));

  const groups = [
    { title: "Nurses", people: team.filter((a) => a.role === "nurse") },
    { title: "Staff", people: team.filter((a) => a.role === "staff") },
  ];

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Duty roster</h1>
          <p className="text-[15px] text-baan-muted">
            {longDate(date)}
            {date === today ? " · Today" : ""}
          </p>
        </div>
        <DayNav path="/admin/roster" date={date} today={today} prev={addDaysIso(date, -1)} next={addDaysIso(date, 1)} />
      </div>

      {(!accounts || !onDuty) && (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          The roster couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      <section aria-label="On duty" className={`${panel} flex flex-col gap-2 px-7 py-5`}>
        <h2 className="font-bold text-baan-navy">
          {onDuty?.length ? `${onDuty.length} on duty` : "No one on duty yet"}
          {past ? "" : date === today ? " today" : " this day"}
        </h2>
        {onDuty && onDuty.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {onDuty.map((p) => (
              <li key={p.userId} className="rounded-full bg-baan-mist px-3 py-1 text-sm font-semibold text-baan-navy">
                {p.name} <span className="font-normal text-baan-muted capitalize">· {p.role}</span>
              </li>
            ))}
          </ul>
        )}
        {past && <p className="text-sm text-baan-muted">Past days are kept as a record and can&apos;t be changed.</p>}
      </section>

      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`${g.title}-h`} className={`${panel} overflow-hidden`}>
          <h2 id={`${g.title}-h`} className="border-b border-baan-line px-7 py-5 font-display text-2xl font-bold text-baan-navy">
            {g.title}
          </h2>
          {g.people.length === 0 ? (
            <p className="px-7 py-8 text-center text-baan-muted">
              {accounts ? (
                <>
                  No {g.title.toLowerCase()} yet. Give someone the role on{" "}
                  <Link href={`/admin/accounts?role=${g.title === "Nurses" ? "nurse" : "staff"}`} className="font-bold text-baan-teal underline">
                    Staff &amp; accounts
                  </Link>
                  .
                </>
              ) : (
                "—"
              )}
            </p>
          ) : (
            <ul>
              {g.people.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-baan-line/70 px-7 py-4 last:border-b-0">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-bold text-baan-navy">
                      {a.name}
                      {a.banned && <span className="ml-2 text-sm font-semibold text-[#55666B]">(deactivated)</span>}
                    </span>
                    <span className="text-sm text-baan-muted">
                      {a.role === "staff" && a.services.length ? a.services.join(", ") : (a.email ?? "")}
                    </span>
                  </div>
                  <DutyToggle date={date} userId={a.id} name={a.name} onDuty={onDutyIds.has(a.id)} locked={past} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {others.length > 0 && (
        <section aria-labelledby="others-h" className={`${panel} overflow-hidden`}>
          <h2 id="others-h" className="border-b border-baan-line px-7 py-5 font-bold text-baan-navy">
            On duty, but no longer a nurse or staff member
          </h2>
          <ul>
            {others.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 border-b border-baan-line/70 px-7 py-4 last:border-b-0">
                <span className="font-bold text-baan-navy">
                  {p.name} <span className="font-normal text-baan-muted capitalize">· was {p.role}</span>
                </span>
                <DutyToggle date={date} userId={p.userId} name={p.name} onDuty locked={past} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-baan-muted">
        Nurses and staff see their own duty days on their dashboards. Every change is saved to the{" "}
        <Link href="/admin/audit" className="underline">
          audit log
        </Link>
        .
      </p>
    </div>
  );
}
