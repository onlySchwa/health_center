import { AppointmentsTableSkeleton } from "@/components/page-skeletons";

export default function StaffLoading() {
  return (
    <main className="w-full flex-1 bg-baan-mist text-baan-ink" aria-busy="true" aria-label="Loading appointments">
      <AppointmentsTableSkeleton stats={4} />
    </main>
  );
}
