import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { ServiceForm } from "@/components/service-form";
import { getAppointmentCountsByService, isAdmin } from "@/lib/admin";
import { getServices } from "@/lib/services";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Health Services — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
const label = "text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase";

export default function AdminServicesPage() {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <ServicesContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ServicesContent() {
  // proxy.ts already sends non-admins away; this check (and the admin-only database
  // function behind every save) keeps services safe even if that ever changes.
  if (!(await isAdmin())) notFound();
  await connection(); // appointment counts are live

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [services, counts] = await Promise.all([getServices().catch(fail), getAppointmentCountsByService().catch(fail)]);

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Health services</h1>
          <p className="text-[15px] text-baan-muted">What residents can book, on which days, and what to bring.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <ServiceForm />
      </div>

      {!services ? (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Services couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      ) : (
        <section aria-label="Services" className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] items-start gap-5">
          {services.map((s) => {
            const booked = counts?.get(s.name) ?? 0;
            return (
              <article
                key={s.name}
                className={`flex flex-col gap-4 rounded-[20px] border bg-white p-6 ${s.active ? "border-baan-line" : "border-dashed border-[#B9C9CC]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl font-bold text-baan-navy">{s.name}</h2>
                  <span
                    className={`flex-none rounded-full px-3 py-1 text-xs font-bold ${s.active ? "bg-[#DDF3F2] text-[#145C5A]" : "bg-[#EEF0F1] text-[#55666B]"}`}
                  >
                    {s.active ? "Open for booking" : "Disabled"}
                  </span>
                </div>
                <p className="text-[15px] leading-relaxed text-baan-muted">{s.description || "No description yet."}</p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className={label}>Days</dt>
                    <dd>{s.days.length === 5 ? "Mon–Fri" : s.days.map((d) => dayNames[d]).join(", ")}</dd>
                  </div>
                  <div>
                    <dt className={label}>Times</dt>
                    <dd>{s.timeSlots.map((t) => t.split(" (")[0]).join(", ")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className={label}>What to bring</dt>
                    <dd>{s.requirements || "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className={label}>Appointments on record</dt>
                    <dd>
                      {counts ? booked : "—"}
                      {booked > 0 && (
                        <>
                          {" · "}
                          <Link href={`/admin/reports?service=${encodeURIComponent(s.name)}`} className="font-semibold text-baan-teal underline">
                            See report
                          </Link>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
                <ServiceForm service={s} />
              </article>
            );
          })}
        </section>
      )}

      <p className="text-sm text-baan-muted">
        Disabling a service hides it from the booking form and the public services page. Its appointments, reports and
        staff assignments stay as they are. Every change is recorded in the{" "}
        <Link href="/admin/audit?action=services" className="underline">
          audit log
        </Link>
        .
      </p>
    </div>
  );
}
