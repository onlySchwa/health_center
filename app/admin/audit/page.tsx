import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityAction, roleStyle, show } from "@/components/activity-action";
import { DatePicker } from "@/components/date-picker";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import {
  AUDIT_PAGE_SIZE,
  auditActionGroups,
  formatTimestamp,
  getAuditLog,
  isAccountAction,
  isAdmin,
  type ActivityEntry,
  type AuditFilters,
} from "@/lib/admin";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Audit Log — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const th = "px-4 py-3";
const td = "px-4 py-4";
const field =
  "min-h-11 rounded-xl border border-baan-line bg-white px-3 text-[15px] focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]";
const fieldLabel = "flex flex-col gap-1 text-sm font-semibold text-baan-muted";

const whoOptions = { team: "Staff & admins", residents: "Residents" } as const;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Reads the filters from the URL; anything unrecognised is ignored.
function readFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const page = Number(params.page);
  return {
    who: params.who === "team" || params.who === "residents" ? params.who : undefined,
    group: typeof params.action === "string" && Object.hasOwn(auditActionGroups, params.action)
      ? (params.action as AuditFilters["group"])
      : undefined,
    from: isDate(params.from) ? params.from : undefined,
    to: isDate(params.to) ? params.to : undefined,
    search: typeof params.q === "string" ? params.q.slice(0, 60) : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

const auditHref = (f: AuditFilters, page: number) => {
  const params = new URLSearchParams();
  if (f.who) params.set("who", f.who);
  if (f.group) params.set("action", f.group);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.search) params.set("q", f.search);
  if (page > 1) params.set("page", String(page));
  return `/admin/audit${params.size ? `?${params}` : ""}`;
};

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

  const filters = readFilters(await searchParams);
  const result = await getAuditLog(filters).catch((error) => {
    console.error(error);
    return null;
  });
  const filtered = Boolean(filters.who || filters.group || filters.from || filters.to || filters.search);

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Audit log</h1>
        <p className="text-[15px] text-baan-muted">Who changed which appointment or account, and when.</p>
      </div>

      <section aria-label="Activity" className={`${panel} flex flex-col gap-5 p-7`}>
        <form action="/admin/audit" role="search" className="flex flex-wrap items-end gap-4">
          <label className={`${fieldLabel} min-w-0 flex-[1_1_240px]`}>
            Search
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Appointment ID, name or email"
              className={field}
            />
          </label>
          <label className={fieldLabel}>
            Who
            <select name="who" defaultValue={filters.who ?? ""} className={field}>
              <option value="">Everyone</option>
              {Object.entries(whoOptions).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Action
            <select name="action" defaultValue={filters.group ?? ""} className={field}>
              <option value="">All actions</option>
              {Object.entries(auditActionGroups).map(([id, g]) => (
                <option key={id} value={id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            From
            <DatePicker name="from" defaultValue={filters.from} className={field} />
          </label>
          <label className={fieldLabel}>
            To
            <DatePicker name="to" defaultValue={filters.to} className={field} />
          </label>
          <button type="submit" className="min-h-11 rounded-full bg-baan-orange px-6 font-bold text-white hover:brightness-90">
            Apply
          </button>
          {filtered && (
            <Link href="/admin/audit" className="inline-flex min-h-11 items-center px-2 font-bold text-baan-muted hover:text-baan-navy">
              Clear
            </Link>
          )}
        </form>

        {result ? (
          <ActivityTable log={result.entries} total={result.total} filters={filters} filtered={filtered} />
        ) : (
          <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
            The audit log couldn&apos;t be loaded. Please try again in a few minutes.
          </p>
        )}
      </section>
    </div>
  );
}

function ActivityTable({
  log,
  total,
  filters,
  filtered,
}: {
  log: ActivityEntry[];
  total: number;
  filters: AuditFilters;
  filtered: boolean;
}) {
  if (log.length === 0) {
    return (
      <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">
        {filtered ? "No entries match these filters." : "No activity recorded yet."}
      </p>
    );
  }
  const first = (filters.page - 1) * AUDIT_PAGE_SIZE + 1;
  const last = first + log.length - 1;
  const pager = "inline-flex min-h-11 items-center rounded-full border-[1.5px] border-baan-line px-5 font-bold text-baan-navy hover:bg-baan-mist";
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-baan-line">
        <table className="w-full min-w-215 border-collapse text-left text-[15px]">
          <thead className="bg-baan-mist text-[13px] tracking-[0.08em] text-baan-muted uppercase">
            <tr>
              <th scope="col" className={th}>When</th>
              <th scope="col" className={th}>Who</th>
              <th scope="col" className={th}>Action</th>
              <th scope="col" className={th}>Record</th>
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
                  <div className="font-semibold text-baan-muted">
                    {e.appointment_ref ??
                      (isAccountAction(e.action) ? "Account" : e.action === "settings_updated" ? "Settings" : "Service")}
                  </div>
                  {e.action === "settings_updated" ? null : isAccountAction(e.action) ? (
                    <div>{e.target_name}</div>
                  ) : e.action === "service_added" || e.action === "service_updated" ? (
                    <div>{show(e.details?.service)}</div>
                  ) : e.appointment ? (
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-baan-muted">
          Showing {first}–{last} of {total}, newest first. Entries are written by the database and can&apos;t be edited or
          deleted.
        </p>
        <nav aria-label="Pages" className="flex gap-2">
          {filters.page > 1 && (
            <Link href={auditHref(filters, filters.page - 1)} className={pager}>
              Newer
            </Link>
          )}
          {last < total && (
            <Link href={auditHref(filters, filters.page + 1)} className={pager}>
              Older
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}
