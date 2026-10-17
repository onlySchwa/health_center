import { AppointmentsTableSkeleton } from "@/components/page-skeletons";

export default function AdminLoading() {
  return (
    <main className="w-full flex-1 bg-baan-mist text-baan-ink" aria-busy="true" aria-label="Loading admin dashboard">
      <AppointmentsTableSkeleton stats={3} />
    </main>
  );
}
