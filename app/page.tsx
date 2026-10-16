import Image from "next/image";
import Link from "next/link";
import { AdvocaciesSection } from "@/components/advocacies-section";
import { BookingSection } from "@/components/booking-section";
import { ContactSection } from "@/components/contact-section";
import { ServicesSection } from "@/components/services-section";
import { ctaButton, eyebrow } from "@/lib/styles";
import heroBanner from "@/public/hero-banner.jpg";

export default function Home() {
  return (
    <main className="w-full text-baan-ink">
      {/* 1 · Hero */}
      <section id="top" className="relative flex min-h-[calc(100svh-85px)] items-center overflow-hidden bg-baan-navy">
        <Image
          src={heroBanner}
          alt="Baan KM 3 Barangay Health Center buildings under a clear blue sky"
          fill
          sizes="100vw"
          fetchPriority="high"
          loading="eager"
          className="object-cover object-[center_60%]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,38,50,0.88)_0%,rgba(8,38,50,0.66)_42%,rgba(8,38,50,0.08)_78%)]"
        />
        <div className="relative mx-auto w-full max-w-310 px-6 pt-24 pb-30">
          <div className="flex max-w-160 flex-col gap-6">
            <p className={`${eyebrow} text-baan-mint`}>Baan KM 3 Barangay Health Center</p>
            <h1 className="font-display text-[clamp(42px,6vw,76px)] leading-[1.02] font-extrabold tracking-[-0.02em] text-white">
              Book your check-up.
              <br />
              <span className="text-baan-mint">Skip the long wait.</span>
            </h1>
            <p className="max-w-130 text-[19px] leading-relaxed text-[#E4F0F1]">
              Pick a service, choose a day, and your slot at Baan Health Care will be ready when you arrive — for
              you, your kids, and your lolo and lola.
            </p>
            <div className="flex flex-wrap gap-3.5 pt-2">
              <Link href="/appointments" className={`${ctaButton} bg-baan-orange text-white`}>
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                Book an appointment
              </Link>
              <Link href="#services" className={`${ctaButton} border-2 border-white/80 text-white`}>
                See our services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · Services */}
      <ServicesSection />

      {/* 3 · Book an appointment */}
      <BookingSection />

      {/* 4 · About & Advocacies */}
      <AdvocaciesSection />

      {/* 5 · Contact */}
      <ContactSection />
    </main>
  );
}
