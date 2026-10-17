import { AdvocaciesSkeleton, BannerSkeleton } from "@/components/page-skeletons";

export default function AdvocaciesLoading() {
  return (
    <main className="w-full text-baan-ink" aria-busy="true" aria-label="Loading advocacies">
      <BannerSkeleton />
      <AdvocaciesSkeleton />
    </main>
  );
}
