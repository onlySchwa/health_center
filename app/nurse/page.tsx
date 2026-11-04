import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DayNav } from "@/components/day-nav";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { statusStyle, timeSlots } from "@/lib/appointment-options";
import { manilaToday } from "@/lib/appointments";
import { ageOn, civilStatusOptions, sexOptions } from "@/lib/health-intake";
import { getNurseId, getPatients, type Patient } from "@/lib/nurse";
import { longDate } from "@/lib/reports";
import { formatDutyDay, getDutyDays, getOnDuty } from "@/lib/roster";
import { addDaysIso, isIsoDate } from "@/lib/staff";
import NurseLoading from "./loading";

export const metadata: Metadata = {
  title: "Nurse Dashboard — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const chip = "rounded-full px-2.5 py-0.5 text-[13px] font-bold";

export default function NursePage({ searchParams }: PageProps<"/nurse">) {
  return (
    <MinDelay fallback={<NurseLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <NurseContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function NurseContent({ searchParams }: { searchParams: PageProps<"/nurse">["searchParams"] }) {
  // proxy.ts already sends non-nurses away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const nurseId = await getNurseId();
  if (!nurseId) notFound();

  const params = await searchParams;
  await connection(); // "today" depends on the current time
  const today = manilaToday();
  const date = isIsoDate(params.date) ? params.date : today;

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [patients, onDuty, myDays] = await Promise.all([
    getPatients(date).catch(fail),
    getOnDuty(today).catch(fail),
    getDutyDays(nurseId, today).catch(fail),
  ]);

  const withForm = patients?.filter((p) => p.intake).length;
  const stats = [
    { label: date === today ? "Patients today" : "Patients this day", value: patients?.length, tone: "text-baan-navy" },
    { label: "Sent a health form", value: withForm, tone: "text-baan-teal" },
    { label: "Seen", value: patients?.filter((p) => p.status === "completed").length, tone: "text-baan-orange" },
  ];
  // Morning before afternoon, in the clinic's order; any other slot after them.
  const slots = [...new Set(patients?.map((p) => p.time_slot))].sort(
    (a, b) => (timeSlots.indexOf(a) >>> 0) - (timeSlots.indexOf(b) >>> 0),
  );

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Patients</h1>
          <p className="text-[15px] text-baan-muted">
            {longDate(date)}
            {date === today ? " · Today" : ""}
          </p>
        </div>
        <DayNav path="/nurse" date={date} today={today} prev={addDaysIso(date, -1)} next={addDaysIso(date, 1)} />
      </div>

      {(!patients || !onDuty || !myDays) && (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Some data couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      <section aria-labelledby="duty-h" className={`${panel} flex flex-wrap gap-x-10 gap-y-4 px-7 py-5`}>
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <h2 id="duty-h" className="font-bold text-baan-navy">
            {myDays?.[0] === today ? "You’re on duty today" : "You’re not on the roster today"}
          </h2>
          <p className="text-sm text-baan-muted">
            {myDays === null
              ? "—"
              : myDays.filter((d) => d !== today).length
                ? `Next: ${myDays.filter((d) => d !== today).map(formatDutyDay).join(", ")}`
                : "No upcoming duty days set. The administrator manages the roster."}
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <h2 className="font-bold text-baan-navy">On duty today</h2>
          {onDuty?.length ? (
            <ul className="flex flex-wrap gap-2">
              {onDuty.map((p) => (
                <li key={p.userId} className="rounded-full bg-baan-mist px-3 py-1 text-sm font-semibold text-baan-navy">
                  {p.name} <span className="font-normal text-baan-muted capitalize">· {p.role}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-baan-muted">{onDuty ? "No one is on the roster today." : "—"}</p>
          )}
        </div>
      </section>

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} flex flex-col gap-1 px-6 py-5`}>
            <span className={`font-display text-[40px] leading-none font-extrabold ${s.tone}`}>{s.value ?? "—"}</span>
            <span className="font-semibold text-baan-muted">{s.label}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="patients-h" className={`${panel} overflow-hidden`}>
        <h2 id="patients-h" className="border-b border-baan-line px-7 py-5 font-display text-2xl font-bold text-baan-navy">
          Health forms
        </h2>
        {patients && patients.length === 0 ? (
          <p className="px-7 py-10 text-center text-baan-muted">No patients booked for this day.</p>
        ) : (
          slots.map((slot) => (
            <div key={slot}>
              <h3 className="bg-baan-mist px-7 py-2 text-[13px] font-bold tracking-[0.12em] text-baan-muted uppercase">{slot}</h3>
              <ul>
                {patients!
                  .filter((p) => p.time_slot === slot)
                  .map((p) => (
                    <PatientCard key={p.id} p={p} today={today} />
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

// One patient: name and warnings at a glance, the whole health form when opened.
function PatientCard({ p, today }: { p: Patient; today: string }) {
  const f = p.intake;
  const conditions = f ? [...f.conditions, ...(f.other_conditions ? [f.other_conditions] : [])] : [];
  const bmi = f?.weight_kg && f.height_cm ? (f.weight_kg / (f.height_cm / 100) ** 2).toFixed(1) : null;
  const rows: [string, string | null | undefined][] = f
    ? [
        ["Reason", f.reason],
        ["Symptoms", f.symptoms && `${f.symptoms}${f.symptom_duration ? ` (since ${f.symptom_duration})` : ""}`],
        ["Allergies", f.allergies],
        ["Medicines", f.medications],
        ["Conditions", conditions.join(", ")],
        ["Birthdate", f.birthdate && `${longDate(f.birthdate)} (${ageOn(f.birthdate, today)} years old)`],
        ["Sex", f.sex && sexOptions[f.sex]],
        ["Civil status", f.civil_status && civilStatusOptions[f.civil_status]],
        ["PhilHealth", f.philhealth_no],
        ["Emergency contact", [f.emergency_name, f.emergency_phone].filter(Boolean).join(" · ")],
        ["Weight / height", f.weight_kg || f.height_cm ? `${f.weight_kg ?? "—"} kg / ${f.height_cm ?? "—"} cm${bmi ? ` (BMI ${bmi})` : ""}` : null],
        ["Last period", f.last_period && longDate(f.last_period)],
      ]
    : [];

  return (
    <li className="border-b border-baan-line/70 last:border-b-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 px-7 py-4 hover:bg-baan-mist/50">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
            <span className="font-bold text-baan-navy">
              {p.resident_name}
              {f?.birthdate && <span className="font-normal text-baan-muted"> · {ageOn(f.birthdate, today)} y/o</span>}
              {f?.sex && <span className="font-normal text-baan-muted"> · {sexOptions[f.sex]}</span>}
            </span>
            <span className="text-sm text-baan-muted">
              {p.service}
              {f ? ` · ${f.reason}` : ""}
            </span>
            <span className="flex flex-wrap gap-1.5">
              {f?.allergies && !/^(none|wala|n\/?a)$/i.test(f.allergies) && (
                <span className={`${chip} bg-[#FBE9E9] text-[#9B2C2C]`}>Allergies: {f.allergies}</span>
              )}
              {conditions.map((c) => (
                <span key={c} className={`${chip} bg-[#FFF1E8] text-[#9E3E14]`}>{c}</span>
              ))}
              {!f && <span className={`${chip} bg-[#EEF0F1] text-[#55666B]`}>{p.walk_in ? "Walk-in · no health form" : "No health form"}</span>}
            </span>
          </div>
          <span className="text-[13px] font-semibold text-baan-muted">{p.ref}</span>
          <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[p.status]}`}>{p.status}</span>
          <span aria-hidden className="text-baan-muted transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="flex flex-col gap-4 bg-baan-mist/40 px-7 pt-2 pb-5">
          {f ? (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 text-[15px] sm:grid-cols-[minmax(140px,auto)_1fr]">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-semibold text-baan-muted">{label}</dt>
                  <dd className={value ? "text-baan-ink" : "text-baan-muted"}>{value || "Not given"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-baan-muted">
              {p.walk_in
                ? "Recorded as a walk-in at the front desk, so there's no health form. Ask the patient directly."
                : "No health form came with this booking (made before the form existed, or a follow-up booked by staff). Ask the patient directly."}
            </p>
          )}
          <p className="text-sm text-baan-muted">
            Contact: {[p.phone, p.address].filter(Boolean).join(" · ") || "—"}
            {p.note ? ` · Note: ${p.note}` : ""}
          </p>
          {f && <p className="text-xs text-baan-muted">Measurements are as reported by the patient. Please check them at the visit.</p>}
        </div>
      </details>
    </li>
  );
}
