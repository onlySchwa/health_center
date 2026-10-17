import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders that mirror the real sections (PageBanner, ServicesSection, …).
// bg-muted is too close to bg-baan-mist to see, so light surfaces use baan-line and dark ones white/15.
const light = "bg-baan-line";
const dark = "bg-white/15";
const panel = "rounded-[20px] border border-baan-line bg-white";

function Bar({ className }: { className: string }) {
  return <Skeleton className={`${light} ${className}`} />;
}

function DarkBar({ className }: { className: string }) {
  return <Skeleton className={`${dark} ${className}`} />;
}

export function BannerSkeleton() {
  return (
    <section className="flex min-h-75 items-center bg-baan-navy">
      <div className="mx-auto w-full max-w-310 px-6 py-16">
        <div className="flex items-stretch gap-6">
          <span aria-hidden="true" className="w-1.5 flex-none rounded-xs bg-baan-orange" />
          <div className="flex flex-col gap-3">
            <DarkBar className="h-4 w-64" />
            <DarkBar className="h-[clamp(40px,5.5vw,68px)] w-[min(70vw,420px)]" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <section className="flex min-h-[calc(100svh-85px)] items-center bg-baan-navy">
      <div className="mx-auto w-full max-w-310 px-6 pt-24 pb-30">
        <div className="flex max-w-160 flex-col gap-6">
          <DarkBar className="h-4 w-64" />
          <DarkBar className="h-[clamp(84px,12vw,152px)] w-full" />
          <div className="flex flex-col gap-2">
            <DarkBar className="h-5 w-full max-w-130" />
            <DarkBar className="h-5 w-3/4 max-w-100" />
          </div>
          <div className="flex flex-wrap gap-3.5 pt-2">
            <DarkBar className="h-14 w-60 rounded-full" />
            <DarkBar className="h-14 w-48 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ServicesSkeleton() {
  return (
    <section className="bg-baan-mist">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {["bg-baan-orange", "bg-baan-teal", "bg-baan-navy"].map((bg) => (
          <div key={bg} className={`${bg} flex min-h-37.5 items-center gap-4.5 px-10 py-9`}>
            <DarkBar className="size-10 shrink-0" />
            <div className="flex flex-col gap-2">
              <DarkBar className="h-6 w-44" />
              <DarkBar className="h-4 w-52" />
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-310 px-6 py-24">
        <div className="mb-14 flex flex-col items-center gap-3">
          <Bar className="h-[clamp(32px,4vw,46px)] w-72" />
          <Bar className="h-5 w-full max-w-140" />
          <Bar className="h-5 w-3/4 max-w-100" />
        </div>

        <div className="flex flex-wrap items-stretch gap-7">
          <Bar className="min-h-105 min-w-0 flex-[1_1_380px] rounded-[18px]" />
          <div className="grid min-w-0 flex-[999_1_520px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl border border-baan-line bg-white p-6">
                <Bar className="h-7 w-3/4" />
                <Bar className="h-4 w-full" />
                <Bar className="h-4 w-2/3" />
                <Bar className="mt-auto h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// The white booking card on its own, also used on the resident dashboard.
export function BookingFormSkeleton() {
  return (
    <div className="min-w-0 flex-[1_1_520px] overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
      <div className="flex flex-col gap-2 border-b border-baan-line bg-baan-mist px-7 py-6 sm:px-9">
        <Bar className="h-3 w-24" />
        <Bar className="h-7 w-64" />
        <Bar className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4.5 px-7 py-7 sm:grid-cols-2 sm:px-9">
        {["col-span-full", "", "", "col-span-full", "col-span-full", "col-span-full", "col-span-full"].map((span, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${span}`}>
            <Bar className="h-4 w-28" />
            <Bar className="h-12 w-full" />
          </div>
        ))}
        <Bar className="col-span-full mt-1 h-14 rounded-full" />
      </div>
    </div>
  );
}

export function BookingSkeleton() {
  return (
    <section className="bg-baan-navy">
      <div className="mx-auto flex max-w-310 flex-wrap items-start gap-12 px-6 py-24">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-7">
          <DarkBar className="h-4 w-32" />
          <DarkBar className="h-[clamp(34px,4.4vw,52px)] w-full max-w-110" />
          <div className="flex flex-col gap-5.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-start gap-4.5">
                <DarkBar className="size-12 flex-none rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <DarkBar className="h-5 w-48" />
                  <DarkBar className="h-4 w-64 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <BookingFormSkeleton />
      </div>
    </section>
  );
}

export function AdvocaciesSkeleton() {
  return (
    <section className="bg-white">
      <div className="mx-auto flex max-w-310 flex-col gap-14 px-6 py-24">
        <div className="flex flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-5">
            <Bar className="h-4 w-48" />
            <Bar className="h-[clamp(70px,8vw,100px)] w-full" />
            <Bar className="h-5 w-full" />
            <Bar className="h-5 w-4/5" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              {Array.from({ length: 4 }, (_, i) => (
                <Bar key={i} className="h-6 w-48" />
              ))}
            </div>
          </div>
          <Bar className="h-105 min-w-0 flex-[1_1_460px] rounded-[18px]" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <Bar className="h-65 w-full rounded-[14px]" />
              <Bar className="h-5 w-52" />
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <Bar className="h-14 w-60 rounded-full" />
        </div>
      </div>
    </section>
  );
}

export function ContactSectionSkeleton() {
  return (
    <section className="bg-baan-teal">
      <div className="mx-auto flex max-w-310 flex-wrap items-center gap-12 px-6 py-22">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5.5">
          <DarkBar className="h-[clamp(70px,9vw,112px)] w-full" />
          <div className="flex flex-wrap gap-3.5">
            <DarkBar className="h-14 w-60 rounded-full" />
            <DarkBar className="h-14 w-56 rounded-full" />
          </div>
        </div>
        <div className="grid min-w-0 flex-[1_1_420px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-8 gap-y-7 rounded-[18px] bg-baan-navy p-8">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <DarkBar className="h-3 w-24" />
              <DarkBar className="h-5 w-44" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Navy greeting card + stat tiles shared by the resident, staff and admin dashboards.
function DashboardHeaderSkeleton({ stats }: { stats: number }) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded-[20px] bg-baan-navy px-8 py-9">
        <DarkBar className="h-4 w-40" />
        <DarkBar className="h-[clamp(30px,4vw,42px)] w-full max-w-110" />
        <DarkBar className="h-5 w-full max-w-120" />
      </section>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {Array.from({ length: stats }, (_, i) => (
          <div key={i} className={`${panel} flex flex-col gap-2 px-6 py-5`}>
            <Bar className="h-10 w-16" />
            <Bar className="h-5 w-36" />
          </div>
        ))}
      </section>
    </>
  );
}

export function ResidentDashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <DashboardHeaderSkeleton stats={3} />
      <div className="flex flex-wrap items-start gap-7">
        <section className={`${panel} flex min-w-0 flex-[999_1_560px] flex-col gap-3 p-7`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
            <Bar className="h-8 w-52" />
            <Bar className="h-12 w-60 rounded-full" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-5 rounded-2xl border border-baan-line px-5 py-4">
              <Bar className="h-17 w-16 flex-none" />
              <div className="flex flex-1 flex-col gap-2">
                <Bar className="h-5 w-48" />
                <Bar className="h-4 w-40" />
              </div>
              <Bar className="h-7 w-24 rounded-full" />
            </div>
          ))}
        </section>
        <section className={`${panel} flex min-w-0 flex-[1_1_300px] flex-col gap-5 p-7`}>
          <Bar className="h-8 w-36" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Bar className="h-3 w-24" />
              <Bar className="h-5 w-48" />
            </div>
          ))}
          <Bar className="h-11 w-full rounded-full" />
        </section>
      </div>
      <section className="flex flex-wrap rounded-[20px] bg-baan-navy p-6 sm:p-10">
        <BookingFormSkeleton />
      </section>
    </div>
  );
}

// Staff and admin: header, stats, then a panel with tabs, a search bar and a table.
export function AppointmentsTableSkeleton({ stats }: { stats: number }) {
  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <DashboardHeaderSkeleton stats={stats} />
      <section className={`${panel} flex flex-col gap-5 p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Bar className="h-8 w-48" />
          <Bar className="h-12 w-72 max-w-full rounded-full" />
        </div>
        <div className="flex flex-wrap gap-3">
          <Bar className="h-12 min-w-0 flex-[1_1_280px] rounded-full" />
          <Bar className="h-12 w-28 rounded-full" />
        </div>
        <div className="overflow-hidden rounded-xl border border-baan-line">
          <div className="h-11 bg-baan-mist" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-6 border-t border-baan-line px-4 py-4">
              <Bar className="h-5 w-24 flex-none" />
              <div className="flex flex-1 flex-col gap-2">
                <Bar className="h-5 w-40" />
                <Bar className="h-4 w-52 max-w-full" />
              </div>
              <Bar className="hidden h-5 flex-1 sm:block" />
              <Bar className="h-7 w-24 flex-none rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
