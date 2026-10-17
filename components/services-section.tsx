import Image from "next/image";
import Link from "next/link";
import { activeServices, getServices } from "@/lib/services";
import childImmunization from "@/public/Child Immunization.jpg";

export async function ServicesSection() {
  // Active services as admins describe them (Admin → Health services).
  const services = await getServices().then(activeServices, (error) => {
    console.error(error);
    return [];
  });
  return (
    <section id="services" aria-labelledby="svc-h" className="bg-baan-mist">
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
