import { BannerSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the About page: banner, section links, story, mission & vision, commitment.
export default function AboutLoading() {
  return (
    <main className="w-full text-baan-ink" aria-busy="true" aria-label="Loading about page">
      <BannerSkeleton />
      <div className="border-b border-baan-line bg-white">
        <div className="mx-auto flex max-w-310 flex-wrap items-center gap-x-8 px-6">
          {["w-24", "w-36", "w-32"].map((w) => (
            <div key={w} className="flex min-h-12 items-center">
              <Skeleton className={`h-4 bg-baan-line ${w}`} />
            </div>
          ))}
        </div>
      </div>
      <section className="mx-auto flex max-w-310 flex-wrap items-start gap-12 px-6 pt-14 pb-18">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={`h-5 bg-baan-line ${i === 3 ? "mb-4 w-2/3" : "w-full"}`} />
          ))}
        </div>
        <Skeleton className="h-80 min-w-0 flex-[1_1_400px] rounded-none bg-baan-line" />
      </section>
      <section className="bg-baan-navy">
        <div className="mx-auto grid max-w-310 grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-x-18 gap-y-12 px-6 pt-18 pb-30">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-4">
              <Skeleton className="mb-2 h-10 w-40 bg-white/15" />
              <Skeleton className="h-5 w-full bg-white/15" />
              <Skeleton className="h-5 w-full bg-white/15" />
              <Skeleton className="h-5 w-3/4 bg-white/15" />
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto flex max-w-310 flex-wrap items-center gap-12 px-6 pt-18 pb-24">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <Skeleton className="mb-2 h-10 w-64 bg-baan-line" />
          <Skeleton className="h-5 w-full bg-baan-line" />
          <Skeleton className="h-5 w-full bg-baan-line" />
          <Skeleton className="h-5 w-1/2 bg-baan-line" />
        </div>
        <Skeleton className="aspect-video min-w-0 flex-[1_1_400px] rounded-3xl bg-baan-line" />
      </section>
    </main>
  );
}
