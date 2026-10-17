import type { ActivityEntry } from "@/lib/admin";
import { statusStyle } from "@/lib/appointment-options";

// How one audit-log entry reads, shared by the audit log and an appointment's status history.
const fieldLabels: Record<string, string> = {
  resident_name: "Name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  service: "Service",
  appt_date: "Date",
  time_slot: "Time",
  note: "Note",
};

export const show = (value: unknown) => (value === null || value === "" ? "(empty)" : String(value));

// "role_changed" details: { from: { role, services }, to: { role, services } }.
const describeRole = (side: unknown) => {
  const { role, services } = (side ?? {}) as { role?: unknown; services?: unknown };
  const list = Array.isArray(services) && services.length ? ` (${services.join(", ")})` : "";
  return `${typeof role === "string" ? role : "resident"}${list}`;
};

export function ActivityAction({ e }: { e: ActivityEntry }) {
  const badge = (status: ActivityEntry["new_status"]) =>
    status && <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${statusStyle[status]}`}>{status}</span>;
  switch (e.action) {
    case "created":
      return <span className="font-semibold">Booked appointment</span>;
    case "status":
      return (
        <span className="flex flex-wrap items-center gap-2">
          {e.old_status && badge(e.old_status)}
          <span aria-label="changed to">→</span>
          {badge(e.new_status)}
        </span>
      );
    case "edited":
      return (
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Edited details</span>
          <ul className="text-sm text-baan-muted">
            {Object.entries((e.details ?? {}) as Record<string, { from: unknown; to: unknown }>).map(([key, c]) => (
              <li key={key}>
                {fieldLabels[key] ?? key}: {show(c.from)} → <span className="text-baan-ink">{show(c.to)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "archived":
      return <span className="font-semibold">Archived</span>;
    case "restored":
      return <span className="font-semibold">Restored from archive</span>;
    case "deleted":
      return <span className="font-semibold text-[#9B2C2C]">Permanently deleted</span>;
    case "role_changed":
      return (
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Changed role</span>
          <span className="text-sm text-baan-muted capitalize">
            {describeRole(e.details?.from)} → <span className="text-baan-ink">{describeRole(e.details?.to)}</span>
          </span>
        </div>
      );
    case "deactivated":
      return <span className="font-semibold text-[#9B2C2C]">Deactivated account</span>;
    case "reactivated":
      return <span className="font-semibold">Reactivated account</span>;
  }
}

export const roleStyle: Record<ActivityEntry["actor_role"], string> = {
  resident: "bg-baan-mist text-baan-muted",
  staff: "bg-[#DDF3F2] text-[#145C5A]",
  admin: "bg-[#FFF1E8] text-[#9E3E14]",
  system: "bg-[#EEF0F1] text-[#55666B]",
};
