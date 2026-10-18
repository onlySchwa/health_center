import { Baby, HeartHandshake, HeartPulse, Stethoscope, Syringe, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { activeServices, getServices } from "@/lib/services";

// Icon per service name; services admins add later fall back to HeartPulse.
const serviceIcons: Record<string, LucideIcon> = {
  "General consultation": Stethoscope,
  "Child immunization": Syringe,
  "Prenatal & maternal care": Baby,
  "Family planning": HeartHandshake,
};

export async function ServicesSection() {
  // Active services as admins describe them (Admin → Health services).
  const services = await getServices().then(activeServices, (error) => {
    console.error(error);
    return [];
  });
  return (
    <section id="services" aria-labelledby="svc-h" className="bg-baan-mist">
      <div className="mx-auto max-w-310 px-6 py-24">
        <div className="mb-14 flex flex-col items-center gap-4 text-center">
          <h2 id="svc-h" className="font-display text-[clamp(32px,4vw,46px)] font-extrabold text-baan-navy">
            Our Services
          </h2>
          <span aria-hidden className="h-1 w-18 rounded-full bg-baan-navy" />
          <p className="max-w-140 text-lg text-baan-muted">Choose a service to book your slot.</p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
          {services.map((s) => {
            const Icon = serviceIcons[s.name] ?? HeartPulse;
            return (
              // ?service= preselects this service in the booking form (components/booking-form.tsx).
              <Link
                key={s.name}
                href={`/appointments?service=${encodeURIComponent(s.name)}#book`}
                className="group overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-baan-teal/30"
              >
                <span className="flex h-45 items-center justify-center bg-[#EEF3F4]">
                  <span className="flex size-28 items-center justify-center rounded-md bg-baan-teal transition group-hover:brightness-110">
                    <Icon aria-hidden className="size-16 text-white" strokeWidth={1.5} />
                  </span>
                </span>
                <span className="block px-4 py-5 text-center font-display text-xl font-bold text-baan-navy">{s.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
