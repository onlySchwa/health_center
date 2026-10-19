import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DatePicker } from "@/components/date-picker";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { statusStyle } from "@/lib/appointment-options";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { longDate } from "@/lib/reports";
import { getServices, type Service } from "@/lib/services";
import { getSettings } from "@/lib/settings";
import {
  addDaysIso,
  findOverlaps,
  getStaffSchedule,
  holdsSlot,
  isIsoDate,
  isoWeekday,
  weekStart,
  type ScheduleRow,
} from "@/lib/staff";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "Schedule — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const slotLabel = (slot: string) => slot.split(" (")[0];
const slotHours = (slot: string) => slot.split(" (")[1]?.replace(")", "") ?? "";

type Mode = "day" | "week";

export default function StaffSchedulePage({ searchParams }: PageProps<"/staff/schedule">) {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <ScheduleContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ScheduleContent({ searchParams }: { searchParams: PageProps<"/staff/schedule">["searchParams"] }) {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();

  const params = await searchParams;
  await connection(); // "today" depends on the current time
  const today = manilaToday();
  const date = isIsoDate(params.date) ? params.date : today;
  const mode: Mode = params.view === "week" ? "week" : "day";
  const from = mode === "week" ? weekStart(date) : date;
  const to = mode === "week" ? addDaysIso(from, 6) : date;

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [services, settings, rows] = await Promise.all([
    getServices().catch(fail),
    getSettings().catch(fail),
    staff.services.length ? getStaffSchedule(staff.services, from, to).catch(fail) : Promise.resolve([]),
  ]);
  const mine = (services ?? []).filter((s) => s.active && staff.services.includes(s.name));
  const closedDates = settings?.closedDates ?? [];
  const cap = settings?.maxPerSlot ?? null;
  const overlaps = rows ? findOverlaps(rows) : new Set<number>();

  const href = (d: string, m: Mode = mode) => `/staff/schedule?date=${d}${m === "week" ? "&view=week" : ""}`;
  const step = mode === "week" ? 7 : 1;

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Schedule</h1>
          <p className="text-[15px] text-baan-muted">
            {mode === "week" ? `Week of ${longDate(from)}` : longDate(date)}
            {date === today && mode === "day" ? " · Today" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Day or week" className="flex rounded-full bg-white p-1 ring-1 ring-baan-line">
            {(["day", "week"] as const).map((m) => (
              <Link
                key={m}
                href={href(date, m)}
                aria-current={mode === m ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-5 text-[15px] font-bold capitalize ${
                  mode === m ? "bg-baan-navy text-white" : "text-baan-muted hover:text-baan-navy"
                }`}
              >
                {m}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link href={href(addDaysIso(date, -step))} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-baan-navy hover:bg-white">
              ← Prev
            </Link>
            <Link href={href(today)} className="inline-flex min-h-11 items-center rounded-full bg-white px-4 font-bold text-baan-navy ring-1 ring-baan-line hover:bg-baan-mist">
              Today
            </Link>
            <Link href={href(addDaysIso(date, step))} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-baan-navy hover:bg-white">
              Next →
            </Link>
          </div>
          <form action="/staff/schedule" className="flex items-center gap-2">
            {mode === "week" && <input type="hidden" name="view" value="week" />}
            <label htmlFor="sched-date" className="sr-only">Go to date</label>
            <DatePicker
              id="sched-date"
              name="date"
              required
              defaultValue={date}
              className="min-h-11 rounded-xl border border-baan-line bg-white px-3 text-[15px] focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]"
            />
            <button type="submit" className="min-h-11 rounded-full bg-baan-orange px-5 font-bold text-white hover:brightness-90">
              Go
            </button>
          </form>
        </div>
      </div>

      {(!services || !settings || !rows) && (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Some schedule data couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      {staff.services.length === 0 && (
        <p className={`${panel} px-5 py-10 text-center text-baan-muted`}>
          No services assigned yet. Ask an administrator to add them to your account.
        </p>
      )}

      {overlaps.size > 0 && rows && (
        <section aria-labelledby="overlap-h" className="flex flex-col gap-2 rounded-[20px] border border-[#F2C9C9] bg-[#FBE9E9] px-6 py-5 text-[#5E2A2A]">
          <h2 id="overlap-h" className="font-bold text-[#7F2222]">
            {overlaps.size} overlapping {overlaps.size === 1 ? "booking" : "bookings"}
          </h2>
          <p className="text-sm">The same resident holds more than one open booking in the same day and time slot:</p>
          <ul className="flex flex-wrap gap-2">
            {rows
              .filter((r) => overlaps.has(r.id))
              .map((r) => (
                <li key={r.id} className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                  {r.ref} · {r.resident_name} · {r.service} · {r.appt_date} {slotLabel(r.time_slot)}
                </li>
              ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && rows && (
        <>
          <OperatingHours services={mine} cap={cap} />
          {mode === "day" ? (
            <DayView date={date} services={mine} rows={rows} overlaps={overlaps} closed={closedDates.includes(date)} cap={cap} />
          ) : (
            <WeekView from={from} today={today} services={mine} rows={rows} closedDates={closedDates} cap={cap} />
          )}
        </>
      )}
    </div>
  );
}

function OperatingHours({ services, cap }: { services: Service[]; cap: number | null }) {
  return (
    <section aria-label="Operating hours" className={`${panel} flex flex-wrap gap-x-8 gap-y-3 px-6 py-4 text-sm`}>
      {services.map((s) => (
        <div key={s.name} className="flex flex-col">
          <span className="font-bold text-baan-navy">{s.name}</span>
          <span className="text-baan-muted">
            {s.days.map((d) => dayNames[d]).join(", ")} · {s.timeSlots.map(slotHours).join(", ")}
          </span>
        </div>
      ))}
      <div className="flex flex-col">
        <span className="font-bold text-baan-navy">Slot limit</span>
        <span className="text-baan-muted">{cap ? `${cap} per service per time slot` : "No limit set"}</span>
      </div>
    </section>
  );
}

// Booked = requests and confirmed visits. Available while under the slot limit (or always, with no limit).
function Availability({ booked, cap }: { booked: number; cap: number | null }) {
  const full = cap !== null && booked >= cap;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${full ? "bg-[#FBE9E9] text-[#9B2C2C]" : "bg-[#DDF3F2] text-[#145C5A]"}`}>
      {full ? "Full" : cap ? `${cap - booked} open` : "Available"}
    </span>
  );
}

function DayView({
  date,
  services,
  rows,
  overlaps,
  closed,
  cap,
}: {
  date: string;
  services: Service[];
  rows: ScheduleRow[];
  overlaps: Set<number>;
  closed: boolean;
  cap: number | null;
}) {
  if (closed) {
    const open = rows.filter((r) => holdsSlot(r.status)).length;
    return (
      <p className="rounded-[20px] bg-[#EEF0F1] px-5 py-10 text-center font-semibold text-[#55666B]">
        The health center is closed on this day.
        {open > 0 && ` ${open} open ${open === 1 ? "booking still falls" : "bookings still fall"} on it. Contact those residents to reschedule.`}
      </p>
    );
  }
  const weekday = isoWeekday(date);
  return (
    <div className="flex flex-col gap-6">
      {services.map((s) => (
        <section key={s.name} aria-label={s.name} className={`${panel} overflow-hidden`}>
          <h2 className="border-b border-baan-line px-6 py-4 font-display text-xl font-bold text-baan-navy">{s.name}</h2>
          {!s.days.includes(weekday) ? (
            <p className="px-6 py-6 text-baan-muted">Not offered on {longDate(date).split(",")[0]}.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
              {s.timeSlots.map((slot) => {
                const inSlot = rows.filter((r) => r.service === s.name && r.time_slot === slot);
                const booked = inSlot.filter((r) => holdsSlot(r.status)).length;
                return (
                  <div key={slot} className="flex flex-col gap-3 border-baan-line px-6 py-5 not-last:border-b md:not-last:border-r md:not-last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-col">
                        <span className="font-bold text-baan-navy">{slotLabel(slot)}</span>
                        <span className="text-sm text-baan-muted">{slotHours(slot)}</span>
                      </span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-baan-muted">
                        {booked}
                        {cap ? ` / ${cap}` : ""} booked
                        <Availability booked={booked} cap={cap} />
                      </span>
                    </div>
                    {inSlot.length === 0 ? (
                      <p className="text-sm text-baan-muted">No bookings.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {inSlot.map((a) => (
                          <li
                            key={a.id}
                            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5 ${overlaps.has(a.id) ? "border-[#F2C9C9] bg-[#FBE9E9]" : "border-baan-line"}`}
                          >
                            <Link href={`/staff/residents?ref=${a.ref}`} className="min-w-0 flex-1 font-semibold text-baan-navy hover:underline">
                              {a.resident_name}
                            </Link>
                            <span className="text-xs font-semibold text-baan-muted">{a.ref}</span>
                            {overlaps.has(a.id) && <span className="text-xs font-bold text-[#9B2C2C]">Overlap</span>}
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusStyle[a.status]}`}>{a.status}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function WeekView({
  from,
  today,
  services,
  rows,
  closedDates,
  cap,
}: {
  from: string;
  today: string;
  services: Service[];
  rows: ScheduleRow[];
  closedDates: string[];
  cap: number | null;
}) {
  // Weekends only appear when a service runs on them or something is booked then.
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(from, i)).filter(
    (d, i) => i < 5 || services.some((s) => s.days.includes(i + 1)) || rows.some((r) => r.appt_date === d),
  );
  return (
    <section aria-label="Week" className={`${panel} overflow-x-auto`}>
      <table className="w-full min-w-200 border-collapse text-left text-[15px]">
        <thead className="bg-baan-mist text-[13px] tracking-[0.08em] text-baan-muted uppercase">
          <tr>
            <th scope="col" className="px-4 py-3">Service · time</th>
            {days.map((d) => (
              <th key={d} scope="col" className={`px-3 py-3 text-center ${d === today ? "text-baan-teal" : ""}`}>
                <Link href={`/staff/schedule?date=${d}`} className="hover:underline">
                  {dayNames[isoWeekday(d)]} {Number(d.slice(8))}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {services.flatMap((s) =>
            s.timeSlots.map((slot) => (
              <tr key={`${s.name}|${slot}`} className="border-t border-baan-line">
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block font-semibold text-baan-navy">{s.name}</span>
                  <span className="text-sm text-baan-muted">{slotLabel(slot)}</span>
                </th>
                {days.map((d) => {
                  if (closedDates.includes(d)) {
                    return <td key={d} className="bg-[#EEF0F1] px-3 py-3 text-center text-sm font-semibold text-[#55666B]">Closed</td>;
                  }
                  if (!s.days.includes(isoWeekday(d))) {
                    return <td key={d} className="px-3 py-3 text-center text-baan-muted">—</td>;
                  }
                  const booked = rows.filter((r) => r.service === s.name && r.time_slot === slot && r.appt_date === d && holdsSlot(r.status)).length;
                  return (
                    <td key={d} className="px-3 py-3 text-center">
                      <Link href={`/staff/schedule?date=${d}`} className="flex flex-col items-center gap-1 rounded-lg py-1 hover:bg-baan-mist">
                        <span className="font-display text-xl font-extrabold text-baan-navy">{booked}</span>
                        <Availability booked={booked} cap={cap} />
                      </Link>
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
  );
}
