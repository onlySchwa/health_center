import { Suspense } from "react";
import { DashboardNav, DashboardNavList } from "@/components/dashboard-nav";

// Side menu beside every admin page. proxy.ts and each page still check the admin role;
// this layout only arranges them.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex w-full flex-1 flex-col bg-baan-mist text-baan-ink md:flex-row">
      <aside className="border-b border-baan-line bg-white md:w-64 md:flex-none md:border-r md:border-b-0 print:hidden">
        <Suspense fallback={<DashboardNavList kind="admin" />}>
          <DashboardNav kind="admin" />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
