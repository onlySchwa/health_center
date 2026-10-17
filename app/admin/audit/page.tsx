import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityAction, roleStyle, show } from "@/components/activity-action";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { formatTimestamp, getActivityLog, isAdmin, type ActivityEntry } from "@/lib/admin";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Audit Log — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const th = "px-4 py-3";
const td = "px-4 py-4";

export default function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <AuditContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function AuditContent({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  if (!(await isAdmin())) notFound();

  const params = await searchParams;
  const staffOnly = params.who === "staff";
  const log = await getActivityLog({ staffOnly }).catch((error) => {
    console.error(error);
    return null;
  });

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Audit log</h1>
        <p className="text-[15px] text-baan-muted">Who changed which appointment, and when.</p>
      </div>

      <section aria-label="Activity" className={`${panel} flex flex-col gap-5 p-7`}>
        <nav aria-label="Filter activity" className="flex gap-4 text-[15px] font-bold">
          <Link href="/admin/audit" aria-current={!staffOnly ? "page" : undefined} className={staffOnly ? "text-baan-muted hover:text-baan-navy" : "text-baan-teal underline"}>
            Everyone
          </Link>
          <Link href="/admin/audit?who=staff" aria-current={staffOnly ? "page" : undefined} className={!staffOnly ? "text-baan-muted hover:text-baan-navy" : "text-baan-teal underline"}>
            Staff &amp; admins only
          </Link>
        </nav>

        {log ? (
          <ActivityTable log={log} />
        ) : (
          <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
            The audit log couldn&apos;t be loaded. Please try again in a few minutes.
          </p>
        )}
      </section>
    </div>
  );
}

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
