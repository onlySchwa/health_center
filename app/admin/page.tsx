import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { getAdminCounts, getUpcomingAppointments, isAdmin } from "@/lib/admin";
import { statusStyle, type Status } from "@/lib/appointment-options";
import { formatApptDate } from "@/lib/appointments";
import AdminLoading from "./loading";

export const metadata: Metadata = {
  title: "Admin Dashboard — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const shownStatuses: Status[] = ["confirmed", "completed", "missed", "rejected", "cancelled"];

const isWeekend = (isoDate: string) => [0, 6].includes(new Date(`${isoDate}T00:00:00Z`).getUTCDay());

export default function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <OverviewContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function OverviewContent({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  // Old bookmarks: the appointment lists and activity log used to be tabs on this page.
  const { tab } = await searchParams;
  if (tab === "activity") redirect("/admin/audit");
  if (typeof tab === "string") redirect(`/admin/appointments?tab=${encodeURIComponent(tab)}`);

  await connection(); // "today" depends on the current time, so compute it per request
  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [counts, upcoming] = await Promise.all([getAdminCounts().catch(fail), getUpcomingAppointments().catch(fail)]);

  const todayLabel = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "full" }).format(new Date());
  const stats = [
    { label: "Registered residents", value: counts?.residents, tone: "text-baan-navy" },
    { label: "Today's appointments", value: counts?.today, tone: "text-baan-teal" },
    { label: "Pending requests", value: counts?.pending, tone: "text-baan-orange" },
  ];
  const weekendCount = upcoming?.filter((a) => isWeekend(a.appt_date)).length ?? 0;

  const notices: { tone: "alert" | "warn"; title: string; text: string; href?: string; link?: string }[] = [];
  if (counts && counts.unsentEmails > 0) {
    notices.push({
      tone: "alert",
      title: `${counts.unsentEmails} status ${counts.unsentEmails === 1 ? "email" : "emails"} not sent`,
      text: "Residents weren't told their upcoming request was confirmed or rejected.",
      href: "/admin/appointments?tab=history",
      link: "Review and resend",
    });
  }
  if (counts && counts.pending > 0) {
    notices.push({
      tone: "warn",
      title: `${counts.pending} ${counts.pending === 1 ? "request is" : "requests are"} waiting for review`,
      text: "Confirm or reject them so residents know whether to come in.",
      href: "/admin/appointments",
      link: "Review requests",
    });
  }
  if (weekendCount > 0) {
    notices.push({
      tone: "warn",
      title: `${weekendCount} upcoming ${weekendCount === 1 ? "visit falls" : "visits fall"} on a weekend`,
      text: "Booked before the weekday-only rule. Contact the residents to reschedule.",
    });
  }

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Overview</h1>
        <p className="text-[15px] text-baan-muted">{todayLabel}</p>
      </div>

      {(!counts || !upcoming) && (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Some data couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`${panel} flex flex-col gap-1 px-6 py-5`}>
            <span className={`font-display text-[40px] leading-none font-extrabold ${s.tone}`}>{s.value ?? "—"}</span>
            <span className="font-semibold text-baan-muted">{s.label}</span>
          </div>
        ))}
      </section>

      <section aria-label="Appointments by status" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {shownStatuses.map((s) => (
          <div key={s} className={`${panel} flex items-center justify-between gap-3 rounded-2xl px-5 py-4`}>
            <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[s]}`}>{s}</span>
            <span className="font-display text-[28px] font-extrabold text-baan-navy">{counts?.byStatus[s] ?? "—"}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="upcoming-h" className={`${panel} min-w-0 flex-[999_1_520px] overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-baan-line px-7 py-5">
            <h2 id="upcoming-h" className="font-display text-2xl font-bold text-baan-navy">Upcoming appointments</h2>
            <Link href="/admin/appointments?tab=history" className="font-bold text-baan-teal hover:text-baan-navy">
              View all
            </Link>
          </div>
          {upcoming && upcoming.length === 0 ? (
            <p className="px-7 py-10 text-center text-baan-muted">No upcoming appointments.</p>
          ) : (
            <ul>
              {upcoming?.slice(0, 8).map((a) => {
                const d = formatApptDate(a.appt_date);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-baan-line/70 px-7 py-4 last:border-b-0">
                    <div className="flex w-14 flex-none flex-col items-center rounded-xl bg-baan-mist py-1.5">
                      <span className="text-xs font-bold tracking-widest text-baan-teal uppercase">{d.month}</span>
                      <span className="font-display text-2xl leading-tight font-extrabold text-baan-navy">{d.day}</span>
                    </div>
                    <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                      <span className="font-bold text-baan-navy">{a.resident_name}</span>
                      <span className="text-sm text-baan-muted">
                        {a.service} · {d.weekday.slice(0, 3)} · {a.time_slot}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold text-baan-muted">{a.ref}</span>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[a.status]}`}>{a.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="notices-h" className={`${panel} min-w-0 flex-[1_1_320px] overflow-hidden`}>
          <h2 id="notices-h" className="border-b border-baan-line px-6 py-5 font-display text-2xl font-bold text-baan-navy">
            Notifications
          </h2>
          <ul className="flex flex-col gap-3 p-5">
            {notices.length === 0 && (
              <li className="rounded-xl bg-[#E8F4F3] px-4 py-3.5">
                <strong className="text-[#145C5A]">All clear</strong>
                <p className="text-sm text-[#2F5654]">No unsent emails, pending requests or weekend visits.</p>
              </li>
            )}
            {notices.map((n) => (
              <li
                key={n.title}
                className={`flex flex-col gap-1 rounded-xl px-4 py-3.5 ${n.tone === "alert" ? "bg-[#FBE9E9] text-[#5E2A2A]" : "bg-[#FFF1E8] text-[#5E3A28]"}`}
              >
                <strong className={n.tone === "alert" ? "text-[#7F2222]" : "text-[#7E3210]"}>{n.title}</strong>
                <p className="text-sm leading-snug">{n.text}</p>
                {n.href && (
                  <Link href={n.href} className="text-sm font-bold underline">
                    {n.link}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
