import Link from "next/link";
import { bookServiceHref, serviceIcon } from "@/components/services-section";
import { activeServices, getServices } from "@/lib/services";

const tones = [
  { bg: "bg-baan-orange", sub: "text-[#FFE6DA]" },
  { bg: "bg-baan-teal", sub: "text-[#DDF3F2]" },
  { bg: "bg-baan-navy", sub: "text-[#CFE3E5]" },
];

// Full-width strip of booking shortcuts right under the home hero: one per active service,
// named and described as admins set them (Admin → Health services). Nothing shows if none are open.
export async function QuickLinks() {
  const services = await getServices().then(activeServices, (error) => {
    console.error(error);
    return [];
  });
  if (services.length === 0) return null;

  return (
    <nav aria-label="Book a service" className="grid grid-cols-1 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
      {services.map((s, i) => {
        const Icon = serviceIcon(s.name);
        const tone = tones[i % tones.length];
        return (
          <Link
            key={s.name}
            href={bookServiceHref(s.name)}
            className={`${tone.bg} group flex min-h-37.5 items-center gap-4.5 px-8 py-9 text-white transition-[filter] duration-300 hover:brightness-110`}
          >
            <Icon aria-hidden strokeWidth={1.8} className="size-10 flex-none" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-display text-xl font-bold tracking-[0.02em] uppercase">{s.name}</span>
              <span className={`text-[15px] ${tone.sub}`}>
                {s.description ? <span className="line-clamp-2">{s.description}</span> : "Book this service"}{" "}
                <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
