import { BannerSkeleton, ServicesSkeleton } from "@/components/page-skeletons";

export default function ServicesLoading() {
  return (
    <main className="w-full text-baan-ink" aria-busy="true" aria-label="Loading services">
      <BannerSkeleton />
      <ServicesSkeleton />
    </main>
  );
}
