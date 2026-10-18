import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { NoticeItem } from "@/components/staff-notice";
import { getStaffAccess } from "@/lib/appointments";
import { getSettings } from "@/lib/settings";
import { getStaffNotices } from "@/lib/staff";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "Notifications — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

const panel = "rounded-[20px] border border-baan-line bg-white";

export default function StaffNotificationsPage() {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <NotificationsContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function NotificationsContent() {
  // proxy.ts already sends non-staff away; this check (and the database's own
  // row-level security) keeps the data safe even if that ever changes.
  const staff = await getStaffAccess();
  if (!staff) notFound();
  await connection(); // live activity

  const settings = await getSettings().catch((error) => {
    console.error(error);
    return null;
  });
  const notices = staff.services.length
    ? await getStaffNotices(staff.services, settings?.closedDates ?? []).catch((error) => {
        console.error(error);
        return null;
      })
    : [];

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Notifications</h1>
        <p className="text-[15px] text-baan-muted">
          The last 7 days in your services: new requests, confirmations, rejections, cancellations, reschedules, failed
          emails and bookings on closed days.
        </p>
      </div>

      <section aria-label="Notifications" className={`${panel} overflow-hidden`}>
        {!notices ? (
          <p role="alert" className="px-6 py-10 text-center font-semibold text-[#9E3E14]">
            Notifications couldn&apos;t be loaded. Please try again in a few minutes.
          </p>
        ) : notices.length === 0 ? (
          <p className="px-6 py-10 text-center text-baan-muted">All clear. Nothing new in the last 7 days.</p>
        ) : (
          <ul className="flex flex-col gap-3 p-5">
            {notices.map((n, i) => (
              <NoticeItem key={i} n={n} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
