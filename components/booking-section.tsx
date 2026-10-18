import Image from "next/image";
import Link from "next/link";
import { BookingForm } from "@/components/booking-form";
import { activeServices, getServices } from "@/lib/services";
import { getBookingRules } from "@/lib/settings";
import { eyebrow } from "@/lib/styles";
import sealBackground from "@/public/FILL-up form background.jpg";

const steps = [
  { title: "Choose a service", desc: "Check-up, bakuna, prenatal, and more." },
  { title: "Pick a day and time", desc: "Morning or afternoon — whatever fits your day." },
  { title: "Get a confirmation email", desc: "Show it at the front desk when you arrive." },
];

export async function BookingSection() {
  const [services, rules] = await Promise.all([
    getServices().then(activeServices, (error) => {
      console.error(error);
      return [];
    }),
    getBookingRules(),
  ]);
  return (
    <section id="book" aria-labelledby="book-h" className="relative scroll-mt-4 overflow-hidden bg-baan-navy text-white">
      {/* Faded barangay seal centered on the section; the circular mask hides the photo's white corners. */}
      <Image
        src={sealBackground}
        alt=""
        sizes="760px"
        className="pointer-events-none absolute top-1/2 left-[25%] w-[min(760px,120%)] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.14] grayscale mask-[radial-gradient(circle_closest-side,black_97%,transparent_98%)]"
      />
      <div className="relative mx-auto flex max-w-310 flex-wrap items-start gap-12 px-6 py-24">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-7">
          <p className={`${eyebrow} text-baan-mint`}>Appointments</p>
          <h2 id="book-h" className="font-display text-[clamp(38px,5vw,60px)] leading-[1.05] font-extrabold">
            Book in three easy steps
          </h2>
          <ol className="flex flex-col gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className="flex items-start gap-5">
                <span className="flex size-14 flex-none items-center justify-center rounded-full bg-baan-teal font-display text-2xl font-extrabold">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-1.5 pt-1">
                  <strong className="font-display text-[22px] leading-tight">{step.title}</strong>
                  <span className="text-lg leading-relaxed text-[#CFE3E5]">{step.desc}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[17px] text-[#CFE3E5]">
            Rather call?{" "}
            <Link href="/contact" className="font-bold text-baan-mint underline">
              See our contact details
            </Link>
          </p>
        </div>
        <BookingForm
          services={services.map(({ name, requirements, days, timeSlots }) => ({ name, requirements, days, timeSlots }))}
          rules={rules}
        />
      </div>
    </section>
  );
}
