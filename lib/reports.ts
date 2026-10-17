import "server-only";
import { services, type Status } from "@/lib/appointment-options";
import { createSupabase } from "@/lib/supabase";

export type Grouping = "daily" | "weekly" | "monthly";
export type ReportFilters = { from: string; to: string; group: Grouping; service: string };

export const groupings: { id: Grouping; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export const reportStatuses: Status[] = ["pending", "confirmed", "completed", "missed", "rejected", "cancelled"];

const DAY = 86_400_000;
const MAX_DAYS = 731; // two years, so a report stays a sensible size
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isIsoDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toMs(v));

// Reads the report filters from the URL. Anything missing or invalid falls back to the last 30 days, daily.
export function parseReportFilters(params: Record<string, string | string[] | undefined>, today: string): ReportFilters {
  let to = isIsoDate(params.to) ? params.to : today;
  let from = isIsoDate(params.from) ? params.from : toIso(toMs(to) - 29 * DAY);
  if (from > to) [from, to] = [to, from];
  if (toMs(to) - toMs(from) > MAX_DAYS * DAY) from = toIso(toMs(to) - MAX_DAYS * DAY);
  const group = groupings.find((g) => g.id === params.group)?.id ?? "daily";
  const service = services.find((s) => s === params.service) ?? "";
  return { from, to, group, service };
}

export const filtersQuery = (f: ReportFilters) => {
  const params = new URLSearchParams({ from: f.from, to: f.to, group: f.group });
  if (f.service) params.set("service", f.service);
  return params.toString();
};

export type ReportRow = { ref: string; appt_date: string; time_slot: string; service: string; status: Status };

// Non-archived appointments whose visit date falls in the range.
export async function getReportRows({ from, to, service }: ReportFilters) {
  let query = createSupabase()
    .from("appointments")
    .select("ref, appt_date, time_slot, service, status")
    .is("archived_at", null)
    .gte("appt_date", from)
    .lte("appt_date", to);
  if (service) query = query.eq("service", service);
  const { data, error } = await query.order("appt_date").order("time_slot").limit(10000);
  if (error) throw new Error(`Could not load report: ${error.message}`);
  return data as ReportRow[];
}

// Start of the period a date belongs to: the day itself, the Monday of its week, or the 1st of its month.
function periodStart(iso: string, group: Grouping) {
  if (group === "daily") return iso;
  if (group === "monthly") return `${iso.slice(0, 7)}-01`;
  const ms = toMs(iso);
  return toIso(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY);
}

function nextPeriod(iso: string, group: Grouping) {
  if (group === "daily") return toIso(toMs(iso) + DAY);
  if (group === "weekly") return toIso(toMs(iso) + 7 * DAY);
  const d = new Date(toMs(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return toIso(d.getTime());
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", ...opts }).format(new Date(toMs(iso)));

export function periodLabel(iso: string, group: Grouping) {
  if (group === "monthly") return fmt(iso, { month: "short", year: "numeric" });
  const day = fmt(iso, { month: "short", day: "numeric" });
  return group === "weekly" ? `Week of ${day}` : day;
}

export const longDate = (iso: string) => fmt(iso, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function summarize(rows: ReportRow[], { from, to, group }: ReportFilters) {
  // Every period in the range, including empty ones, so gaps show as zero.
  const series = new Map<string, number>();
  for (let p = periodStart(from, group); p <= to; p = nextPeriod(p, group)) series.set(p, 0);
  const byStatus = Object.fromEntries(reportStatuses.map((s) => [s, 0])) as Record<Status, number>;
  const byService = new Map<string, number>(services.map((s) => [s, 0]));
  const byDay = new Map<string, number>();

  for (const r of rows) {
    const p = periodStart(r.appt_date, group);
    series.set(p, (series.get(p) ?? 0) + 1);
    byStatus[r.status] += 1;
    byService.set(r.service, (byService.get(r.service) ?? 0) + 1);
    byDay.set(r.appt_date, (byDay.get(r.appt_date) ?? 0) + 1);
  }

  const busiest = [...byDay].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    total: rows.length,
    series: [...series].map(([start, count]) => ({ start, label: periodLabel(start, group), count })),
    byStatus,
    byService: [...byService].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    busiest: busiest ? { date: busiest[0], count: busiest[1] } : null,
  };
}
