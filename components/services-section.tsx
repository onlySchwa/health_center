import Image from "next/image";
import Link from "next/link";
import { activeServices, getServices } from "@/lib/services";
import childImmunization from "@/public/Child Immunization.jpg";

const featuredServices = [
  {
    title: "Book a check-up",
    sub: "Consultation with our health team →",
    bg: "bg-baan-orange",
    subColor: "text-[#FFE6DA]",
    icon: (
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4M22 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
    ),
  },
  {
    title: "Child immunization",
    sub: "Bakuna schedule for babies →",
    bg: "bg-baan-teal",
    subColor: "text-[#DDF3F2]",
    icon: <path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />,
  },
  {
    title: "Prenatal care",
    sub: "Check-ups for moms-to-be →",
    bg: "bg-baan-navy",
    subColor: "text-[#CFE3E5]",
    icon: (
      <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
    ),
  },
];

export async function ServicesSection() {
  // Active services as admins describe them (Admin → Health services).
  const services = await getServices().then(activeServices, (error) => {
    console.error(error);
    return [];
  });
  return (
    <section id="services" aria-labelledby="svc-h" className="bg-baan-mist">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {featuredServices.map((s) => (
          <Link key={s.title} href="/appointments" className={`${s.bg} flex min-h-37.5 items-center gap-4.5 px-10 py-9 text-white`}>
            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              {s.icon}
            </svg>
            <span className="flex flex-col gap-1">
              <span className="font-display text-[22px] font-bold tracking-[0.02em] uppercase">{s.title}</span>
              <span className={`text-[15px] ${s.subColor}`}>{s.sub}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mx-auto max-w-310 px-6 py-24">
        <div className="mb-14 flex flex-col items-center gap-3 text-center">
          <h2 id="svc-h" className="font-display text-[clamp(32px,4vw,46px)] font-extrabold tracking-[0.01em] text-baan-navy uppercase">
            Our services
          </h2>
          <p className="max-w-140 text-lg text-baan-muted">
            Every service below can be booked ahead. Choose one and reserve your slot in under a minute.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch gap-7">
          <figure className="relative min-h-105 min-w-0 flex-[1_1_380px] overflow-hidden rounded-[18px] bg-baan-navy">
            <Image
              src={childImmunization}
              alt="A health worker gives a smiling baby a vaccine while the mother holds him"
              fill
              sizes="(max-width: 900px) 100vw, 40vw"
              className="object-cover"
            />
            <figcaption className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4.5 py-4">
              <span className="font-bold text-baan-navy">Bakuna day for your little one</span>
              <Link href="/appointments" className="inline-flex min-h-11 items-center font-bold text-baan-orange hover:text-[#9E3E14]">
                Reserve a slot →
              </Link>
            </figcaption>
          </figure>

          <div className="grid min-w-0 flex-[999_1_520px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {services.map((s) => (
              <article key={s.name} className="flex flex-col gap-2 rounded-2xl border border-baan-line bg-white p-6">
                <h3 className="font-display text-xl font-semibold text-baan-navy">{s.name}</h3>
                <p className="leading-normal text-baan-muted">{s.description}</p>
                <Link href="/appointments" className="mt-auto inline-flex min-h-11 items-center font-bold text-baan-orange hover:text-[#9E3E14]">
                  Book this →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
