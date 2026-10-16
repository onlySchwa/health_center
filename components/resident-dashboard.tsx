"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useTransition } from "react";
import { BookingForm } from "@/components/booking-form";
import { cancelAppointment } from "@/lib/actions";
import { statusStyle, type Status } from "@/lib/appointment-options";

export type DashboardAppointment = {
  id: number;
  ref: string;
  service: string;
  day: string;
  month: string;
  weekday: string;
  time: string;
  status: Status;
  upcoming: boolean;
};

const panel = "rounded-[20px] border border-baan-line bg-white";

type Profile = { firstName: string; fullName: string; email: string; phone: string };

type ResidentDashboardProps = {
  profile: Profile;
  appointments: DashboardAppointment[];
  loadFailed: boolean;
  isStaff: boolean;
  isAdmin: boolean;
};

export function ResidentDashboard({ profile, appointments, loadFailed, isStaff, isAdmin }: ResidentDashboardProps) {
  const { openUserProfile } = useClerk();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const upcoming = appointments.filter((a) => a.upcoming);
  const past = appointments.filter((a) => !a.upcoming);
  const shown = tab === "upcoming" ? [...upcoming].reverse() : past;

  const stats = [
    { label: "Upcoming", value: upcoming.length, tone: "text-baan-teal" },
    { label: "Awaiting confirmation", value: upcoming.filter((a) => a.status === "pending").length, tone: "text-baan-orange" },
    { label: "Completed visits", value: appointments.filter((a) => a.status === "completed").length, tone: "text-baan-navy" },
  ];

  function cancel(id: number) {
    setError("");
    startTransition(async () => {
      const result = await cancelAppointment(id);
      if (!result.ok) setError(result.error);
      setConfirmingId(null);
    });
  }

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      {/* Greeting */}
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] bg-baan-navy px-8 py-9 text-white">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold tracking-[0.18em] text-baan-mint uppercase">My dashboard</p>
          <h1 className="font-display text-[clamp(30px,4vw,42px)] leading-[1.08] font-extrabold">
            Magandang araw{profile.firstName ? `, ${profile.firstName}` : ""}!
          </h1>
          <p className="text-[17px] text-[#CFE3E5]">Here are your appointments at Baan Health Care.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isStaff && (
            <Link
              href="/staff"
              className="inline-flex min-h-14 items-center rounded-full border-2 border-white/80 px-7 text-[17px] font-bold text-white hover:bg-white/10"
            >
              Staff dashboard
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex min-h-14 items-center rounded-full border-2 border-white/80 px-7 text-[17px] font-bold text-white hover:bg-white/10"
            >
              Admin dashboard
            </Link>
          )}
          <a
            href="#book-new"
            className="inline-flex min-h-14 items-center gap-2.5 rounded-full bg-baan-orange px-7.5 text-[17px] font-bold text-white hover:brightness-90"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Book new appointment
          </a>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} flex flex-col gap-1 px-6 py-5`}>
            <span className={`font-display text-[40px] leading-none font-extrabold ${s.tone}`}>{s.value}</span>
            <span className="font-semibold text-baan-muted">{s.label}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-7">
        {/* Appointments */}
        <section aria-labelledby="appts-h" className={`${panel} min-w-0 flex-[999_1_560px] p-7`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 id="appts-h" className="font-display text-2xl font-bold text-baan-navy">My appointments</h2>
            <div role="tablist" aria-label="Filter appointments" className="flex rounded-full bg-baan-mist p-1">
              {(["upcoming", "past"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`min-h-10 rounded-full px-5 text-[15px] font-bold capitalize ${
                    tab === t ? "bg-white text-baan-navy shadow-sm" : "text-baan-muted hover:text-baan-navy"
                  }`}
                >
                  {t} ({t === "upcoming" ? upcoming.length : past.length})
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-[#FBE9E9] px-4 py-3 font-semibold text-[#9B2C2C]">
              {error}
            </p>
          )}

          {loadFailed ? (
            <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-8 text-center font-semibold text-[#9E3E14]">
              We couldn&apos;t load your appointments right now. Please try again in a few minutes.
            </p>
          ) : shown.length === 0 ? (
            <p className="rounded-xl bg-baan-mist px-5 py-8 text-center text-baan-muted">
              {tab === "upcoming" ? "No upcoming appointments. Book one below." : "No past appointments yet."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-5 rounded-2xl border border-baan-line px-5 py-4">
                  <div className="flex w-16 flex-none flex-col items-center rounded-xl bg-baan-mist py-2">
                    <span className="text-xs font-bold tracking-widest text-baan-teal uppercase">{a.month}</span>
                    <span className="font-display text-[26px] leading-tight font-extrabold text-baan-navy">{a.day}</span>
                  </div>
                  <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                    <span className="font-display text-lg font-semibold text-baan-navy">{a.service}</span>
                    <span className="text-[15px] text-baan-muted">
                      {a.weekday} · {a.time}
                    </span>
                    <span className="text-[13px] font-semibold text-baan-muted">{a.ref}</span>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>
                    {a.status}
                  </span>
                  {a.upcoming &&
                    (confirmingId === a.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Cancel this?</span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => cancel(a.id)}
                          className="min-h-11 rounded-full bg-[#9B2C2C] px-4 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                        >
                          {isPending ? "Cancelling…" : "Yes, cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="min-h-11 rounded-full px-4 text-sm font-bold text-baan-muted hover:text-baan-navy"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(a.id)}
                        className="min-h-11 rounded-full border-[1.5px] border-baan-line px-4 text-sm font-bold text-baan-muted hover:border-[#9B2C2C] hover:text-[#9B2C2C]"
                      >
                        Cancel
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Profile */}
        <section aria-labelledby="profile-h" className={`${panel} flex min-w-0 flex-[1_1_300px] flex-col gap-5 p-7`}>
          <h2 id="profile-h" className="font-display text-2xl font-bold text-baan-navy">My profile</h2>
          <dl className="flex flex-col gap-4">
            {[
              ["Name", profile.fullName],
              ["Email", profile.email],
              ["Mobile number", profile.phone],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase">{label}</dt>
                <dd className={`break-words ${value ? "text-[17px]" : "text-[15px] text-baan-muted italic"}`}>
                  {value || "Not added yet"}
                </dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => openUserProfile()}
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-baan-navy px-5 text-[15px] font-bold text-baan-navy hover:bg-baan-mist"
          >
            Edit profile &amp; security
          </button>
          <p className="text-sm text-baan-muted">
            Only you can see this page. Your details are used to fill in your booking form.
          </p>
        </section>
      </div>

      {/* Book from dashboard */}
      <section id="book-new" aria-label="Book a new appointment" className="scroll-mt-6 flex flex-wrap rounded-[20px] bg-baan-navy p-6 sm:p-10">
        <BookingForm defaults={{ name: profile.fullName, phone: profile.phone }} />
      </section>
    </div>
  );
}
