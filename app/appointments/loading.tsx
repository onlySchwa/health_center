import { BannerSkeleton, BookingSkeleton } from "@/components/page-skeletons";

export default function AppointmentsLoading() {
  return (
    <main className="w-full text-baan-ink" aria-busy="true" aria-label="Loading appointments">
      <BannerSkeleton />
      <BookingSkeleton />
    </main>
  );
}
