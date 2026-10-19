import { DatePicker } from "@/components/date-picker";
import { statusStyle } from "@/lib/appointment-options";
import { filtersQuery, groupings, longDate, reportStatuses, type ReportFilters, type summarize } from "@/lib/reports";

const panel = "rounded-[20px] border border-baan-line bg-white";
const field =
  "min-h-11 rounded-xl border border-baan-line bg-white px-3 text-[15px] focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]";
const fieldLabel = "flex flex-col gap-1 text-sm font-semibold text-baan-muted";

type ReportViewProps = {
  // "/admin/reports" or "/staff/reports"; the CSV and PDF routes live under it.
  basePath: string;
  filters: ReportFilters;
  // Services the viewer may filter by. "All services" means all of these.
  services: { name: string; active: boolean }[];
  allLabel: string;
  report: ReturnType<typeof summarize> | null;
};

// The reports page shared by admins and staff: filters, summary, trend and breakdowns.
export function ReportView({ basePath, filters, services, allLabel, report }: ReportViewProps) {
  const groupLabel = groupings.find((g) => g.id === filters.group)!.label;
  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Reports</h1>
          <p className="text-[15px] text-baan-muted">
            {longDate(filters.from)} – {longDate(filters.to)}
            {filters.service ? ` · ${filters.service}` : ` · ${allLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 print:hidden">
          <a
            href={`${basePath}/export?${filtersQuery(filters)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-baan-navy bg-white px-5 font-bold text-baan-navy hover:bg-baan-mist"
          >
            Download CSV
          </a>
          <a
            href={`${basePath}/pdf?${filtersQuery(filters)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-baan-navy px-5 font-bold text-white hover:brightness-110"
          >
            Download PDF
          </a>
        </div>
      </div>

      <form action={basePath} className={`${panel} flex flex-wrap items-end gap-4 p-5 print:hidden`}>
        <label className={fieldLabel}>
          Group by
          <select name="group" defaultValue={filters.group} className={field}>
            {groupings.map((g) => (
              <option key={g.id} value={g.id}>
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
        <label className={fieldLabel}>
          Service
          <select name="service" defaultValue={filters.service} className={field}>
            <option value="">{allLabel}</option>
            {services.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
                {s.active ? "" : " (disabled)"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-full bg-baan-orange px-6 font-bold text-white hover:brightness-90">
          Apply
        </button>
      </form>

      {!report ? (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          The report couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <div className={`${panel} flex flex-col gap-1 px-6 py-5`}>
              <span className="font-display text-[40px] leading-none font-extrabold text-baan-navy">{report.total}</span>
              <span className="font-semibold text-baan-muted">Appointments</span>
            </div>
            <div className={`${panel} flex flex-col gap-1 px-6 py-5`}>
              <span className="font-display text-[26px] leading-tight font-extrabold text-baan-teal">
                {report.byService[0]?.[1] ? report.byService[0][0] : "—"}
              </span>
              <span className="font-semibold text-baan-muted">Most requested service</span>
            </div>
            <div className={`${panel} flex flex-col gap-1 px-6 py-5`}>
              <span className="font-display text-[26px] leading-tight font-extrabold text-baan-orange">
                {report.busiest ? `${longDate(report.busiest.date).split(",").slice(0, 2).join(",")} (${report.busiest.count})` : "—"}
              </span>
              <span className="font-semibold text-baan-muted">Busiest day</span>
            </div>
          </section>

          <section aria-labelledby="trend-h" className={`${panel} flex flex-col gap-5 p-7 print:break-inside-avoid`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="trend-h" className="font-display text-2xl font-bold text-baan-navy">
                {groupLabel} appointments
              </h2>
              <span className="text-sm text-baan-muted">By appointment date</span>
            </div>
            <TrendChart series={report.series} />
          </section>

          <div className="flex flex-wrap items-start gap-6">
            <section aria-labelledby="status-h" className={`${panel} min-w-0 flex-[1_1_380px] p-7 print:break-inside-avoid`}>
              <h2 id="status-h" className="mb-5 font-display text-2xl font-bold text-baan-navy">
                By status
              </h2>
              <BarList
                items={reportStatuses.map((s) => ({
                  key: s,
                  label: <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[s]}`}>{s}</span>,
                  count: report.byStatus[s],
                }))}
                total={report.total}
                bar="bg-baan-teal"
              />
            </section>
            <section aria-labelledby="svc-h" className={`${panel} min-w-0 flex-[1_1_380px] p-7 print:break-inside-avoid`}>
              <h2 id="svc-h" className="mb-5 font-display text-2xl font-bold text-baan-navy">
                Most requested services
              </h2>
              <BarList
                items={report.byService.map(([s, count]) => ({ key: s, label: <span className="font-semibold">{s}</span>, count }))}
                total={Math.max(...report.byService.map(([, n]) => n), 1)}
                bar="bg-baan-orange"
              />
            </section>
          </div>

          <p className="text-sm text-baan-muted">
            Counts every non-archived appointment whose visit date falls in the range. &quot;Missed&quot; is a no-show.
            The CSV and PDF list the same appointments, without contact details.
          </p>
        </>
      )}
    </div>
  );
}

function TrendChart({ series }: { series: { start: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((p) => p.count));
  // Label every bar when they fit, otherwise about 12 evenly spaced ones.
  const every = Math.ceil(series.length / 12);
  return (
    <>
      <div aria-hidden className="flex h-56 items-end gap-1 border-b border-baan-line sm:gap-2">
        {series.map((p) => (
          <div key={p.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {p.count > 0 && <span className="text-xs font-bold text-baan-navy">{p.count}</span>}
            <div
              className={`w-full max-w-16 rounded-t-md ${p.count ? "bg-baan-teal" : "bg-baan-line"}`}
              style={{ height: p.count ? `${(p.count / max) * 85}%` : "3px" }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-1 sm:gap-2">
        {series.map((p, i) => (
          <span key={p.start} className="min-w-0 flex-1 truncate text-center text-xs text-baan-muted">
            {i % every === 0 ? p.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Appointments per period</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Appointments</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.start}>
              <td>{p.label}</td>
              <td>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function BarList({
  items,
  total,
  bar,
}: {
  items: { key: string; label: React.ReactNode; count: number }[];
  total: number;
  bar: string;
}) {
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            {item.label}
            <span className="font-bold text-baan-navy">{item.count}</span>
          </div>
          <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-baan-mist">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${total ? (item.count / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
