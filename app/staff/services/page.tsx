import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { getStaffAccess, manilaToday } from "@/lib/appointments";
import { getServices } from "@/lib/services";
import { addDaysIso, getStaffSchedule, holdsSlot } from "@/lib/staff";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "Health Services — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const label = "text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase";

export default function StaffServicesPage() {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <ServicesContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

// Read-only: administrators edit services (Admin → Health services).
async function ServicesContent() {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();
  await connection(); // booking counts are live

  const today = manilaToday();
  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [services, upcoming] = await Promise.all([
    getServices().catch(fail),
    staff.services.length ? getStaffSchedule(staff.services, today, addDaysIso(today, 6)).catch(fail) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Health services</h1>
        <p className="text-[15px] text-baan-muted">What residents can book, when, and what to bring. Administrators edit these.</p>
      </div>

      {!services ? (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Services couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      ) : (
        <section aria-label="Services" className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] items-start gap-5">
          {services.map((s) => {
            const mine = staff.services.includes(s.name);
            const booked = upcoming?.filter((a) => a.service === s.name && holdsSlot(a.status)).length ?? 0;
            return (
              <article
                key={s.name}
                className={`flex flex-col gap-4 rounded-[20px] border bg-white p-6 ${s.active ? "border-baan-line" : "border-dashed border-[#B9C9CC]"} ${mine ? "ring-2 ring-baan-teal/30" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-baan-navy">{s.name}</h2>
                  <span className="flex flex-none flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${s.active ? "bg-[#DDF3F2] text-[#145C5A]" : "bg-[#EEF0F1] text-[#55666B]"}`}
                    >
                      {s.active ? "Open for booking" : "Disabled"}
                    </span>
                    {mine && <span className="rounded-full bg-baan-navy px-3 py-1 text-xs font-bold text-white">You handle this</span>}
                  </span>
                </div>
                <p className="text-[15px] leading-relaxed text-baan-muted">{s.description || "No description yet."}</p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <dt className={label}>Days</dt>
                    <dd>{s.days.map((d) => dayNames[d]).join(", ") || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className={label}>Hours</dt>
                    <dd>{s.timeSlots.map((t) => t.split(" (")[1]?.replace(")", "") ?? t).join(", ") || "—"}</dd>
                  </div>
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <dt className={label}>What to bring</dt>
                    <dd>{s.requirements || "Nothing listed."}</dd>
                  </div>
                  {mine && (
                    <div className="col-span-2 flex flex-col gap-0.5">
                      <dt className={label}>Next 7 days</dt>
                      <dd>
                        {booked} open {booked === 1 ? "booking" : "bookings"} ·{" "}
                        <Link href="/staff/schedule?view=week" className="font-bold text-baan-teal hover:text-baan-navy">
                          See schedule
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
