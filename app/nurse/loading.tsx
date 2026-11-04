import { AppointmentsTableSkeleton } from "@/components/page-skeletons";

export default function NurseLoading() {
  return (
    <main className="w-full flex-1 bg-baan-mist text-baan-ink" aria-busy="true" aria-label="Loading patients">
      <AppointmentsTableSkeleton stats={3} />
    </main>
  );
}
