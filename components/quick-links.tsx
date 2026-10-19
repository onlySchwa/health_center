import Link from "next/link";
import { bookServiceHref, serviceIcon } from "@/components/services-section";
import { activeServices, getServices } from "@/lib/services";

// Full-width strip of booking shortcuts right under the home hero: one per active service,
// named as admins set them (Admin → Health services). Nothing shows if none are open.
export async function QuickLinks() {
  const services = await getServices().then(activeServices, (error) => {
    console.error(error);
    return [];
  });
  if (services.length === 0) return null;

  return (
    // Teal band, full-bleed; navy cards sit in the page's max-w-310 column. Below lg they're compact left-aligned rows.
    <div className="bg-baan-teal px-6 py-8 lg:py-16">
      <nav aria-label="Book a service" className="mx-auto grid max-w-310 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:gap-10">
        {services.map((s) => {
          const Icon = serviceIcon(s.name);
          return (
            <Link
              key={s.name}
              href={bookServiceHref(s.name)}
              className="group flex items-center gap-4 rounded-md bg-baan-navy px-5 py-4 text-white lg:min-h-48 lg:justify-center lg:py-7 transition duration-300 hover:-translate-y-0.5 hover:brightness-125"
            >
              <Icon aria-hidden strokeWidth={1.6} className="size-10 flex-none" />
              <span className="flex min-w-0 flex-col gap-2 lg:gap-3">
                <span className="font-display text-xl leading-[1.15] font-bold tracking-[0.01em] uppercase">{s.name}</span>
                <span aria-hidden className="h-0.5 w-12 bg-baan-mint" />
                <span className="text-[13px] font-semibold tracking-[0.06em] uppercase">
                  Book now{" "}
                  <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-0.75">
                    ›
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
