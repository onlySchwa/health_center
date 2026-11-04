import { Suspense } from "react";
import { DashboardNav, DashboardNavList } from "@/components/dashboard-nav";

// Side menu beside every nurse page, matching the staff and admin dashboards. proxy.ts and each page
// still check the nurse role; this layout only arranges them.
export default function NurseLayout({ children }: LayoutProps<"/nurse">) {
  return (
    <div className="flex w-full flex-1 flex-col bg-baan-mist text-baan-ink md:flex-row">
      <aside className="border-b border-baan-line bg-white md:w-64 md:flex-none md:border-r md:border-b-0 print:hidden">
        <Suspense fallback={<DashboardNavList kind="nurse" />}>
          <DashboardNav kind="nurse" />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
