import { BannerSkeleton } from "@/components/page-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the Contact page: banner, the map card, then "Reach Out to Us".
export default function ContactLoading() {
  return (
    <main className="w-full bg-baan-mist text-baan-ink" aria-busy="true" aria-label="Loading contact page">
      <BannerSkeleton />
      <div className="mx-auto flex max-w-310 flex-col gap-16 px-6 pt-14 pb-24">
        <section className="overflow-hidden rounded-[20px] border border-baan-line bg-white">
          <div className="bg-baan-navy px-8 py-5">
            <Skeleton className="h-8 w-44 bg-white/15" />
          </div>
          <div className="p-5 sm:p-8">
            <div className="overflow-hidden rounded-xl border border-baan-line">
              <Skeleton className="h-[clamp(320px,50vw,480px)] w-full rounded-none bg-baan-line" />
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-72 max-w-full bg-baan-line" />
                  <Skeleton className="h-4 w-44 bg-baan-line" />
                </div>
                <Skeleton className="h-11 w-36 rounded-lg bg-baan-line" />
              </div>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <Skeleton className="h-[clamp(30px,3.6vw,40px)] w-72 bg-baan-line" />
          <Skeleton className="h-5 w-full max-w-160 bg-baan-line" />
        </section>
      </div>
    </main>
  );
}
