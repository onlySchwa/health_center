import { UserProfile } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { getStaffAccess } from "@/lib/appointments";
import StaffLoading from "../loading";

export const metadata: Metadata = {
  title: "My Profile — Staff — Baan Health Care",
  robots: { index: false, follow: false },
};

const label = "text-[13px] font-bold tracking-[0.12em] text-baan-teal uppercase";

export default function StaffProfilePage() {
  return (
    <MinDelay fallback={<StaffLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={0} />}>
          <ProfileContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function ProfileContent() {
  // proxy.ts already sends non-staff away; this check keeps the page safe even if that ever changes.
  const [staff, user] = await Promise.all([getStaffAccess(), currentUser()]);
  if (!staff || !user) notFound();

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">My profile</h1>
        <p className="text-[15px] text-baan-muted">Your staff account and personal details.</p>
      </div>

      <section aria-label="Staff role" className="flex flex-wrap gap-x-10 gap-y-4 rounded-[20px] border border-baan-line bg-white px-6 py-5">
        <div className="flex flex-col gap-0.5">
          <span className={label}>Role</span>
          <span className="font-semibold text-baan-navy">Staff</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={label}>Services you handle</span>
          <span className="flex flex-wrap gap-2">
            {staff.services.length ? (
              staff.services.map((s) => (
                <span key={s} className="rounded-full bg-[#E3EEEF] px-3 py-1 text-sm font-semibold text-baan-navy">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-baan-muted">None yet. Ask an administrator to assign them.</span>
            )}
          </span>
        </div>
        <p className="basis-full text-sm text-baan-muted">Only an administrator can change your role or services.</p>
      </section>

      {/* Name, email, password and sign-in security, managed by Clerk. */}
      <UserProfile routing="hash" />
    </div>
  );
}
