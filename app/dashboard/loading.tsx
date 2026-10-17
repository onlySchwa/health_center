import { ResidentDashboardSkeleton } from "@/components/page-skeletons";

export default function DashboardLoading() {
  return (
    <main className="w-full flex-1 bg-baan-mist text-baan-ink" aria-busy="true" aria-label="Loading your dashboard">
      <ResidentDashboardSkeleton />
    </main>
  );
}
