import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { ResidentDashboardSkeleton } from "@/components/page-skeletons";
import { ResidentDashboard } from "@/components/resident-dashboard";
import { isAdmin } from "@/lib/admin";
import { formatApptDate, getMyAppointments, getStaffAccess, manilaToday } from "@/lib/appointments";
import DashboardLoading from "./loading";

export const metadata: Metadata = {
  title: "My Dashboard — Baan Health Care",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <MinDelay fallback={<DashboardLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<ResidentDashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function DashboardContent() {
  // proxy.ts already blocks signed-out visitors; this second check keeps the page
  // safe even if the proxy matcher is ever changed.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  // A database problem shouldn't take down the whole page: log it and show a notice instead.
  const [user, rows, staff, admin] = await Promise.all([
    currentUser(),
    getMyAppointments().catch((error) => {
      console.error(error);
      return null;
    }),
    getStaffAccess(),
    isAdmin(),
  ]);
  await connection(); // "today" depends on the current time, so compute it per request
  const today = manilaToday();
  const appointments = (rows ?? []).map((a) => ({
    id: a.id,
    ref: a.ref,
    service: a.service,
    time: a.time_slot,
    status: a.status,
    upcoming: a.appt_date >= today && (a.status === "pending" || a.status === "confirmed"),
    ...formatApptDate(a.appt_date),
  }));

  // Only plain fields go to the browser, never the full Clerk user object.
  return (
    <ResidentDashboard
      appointments={appointments}
      loadFailed={rows === null}
      isStaff={staff !== null}
      isAdmin={admin}
      profile={{
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        fullName: user?.fullName ?? "",
        email: user?.primaryEmailAddress?.emailAddress ?? "",
        phone: user?.primaryPhoneNumber?.phoneNumber ?? "",
      }}
    />
  );
}
