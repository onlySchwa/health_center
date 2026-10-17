import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
import { ServicesSection } from "@/components/services-section";
import facilities from "@/public/facilities.jpg";
import { MinDelay } from "@/components/min-delay";
import ServicesLoading from "./loading";

export const metadata: Metadata = {
  title: "Services — Baan Health Care",
  description: "Check-ups, child immunization, prenatal care and more at the Baan KM 3 Barangay Health Center.",
};

export default function ServicesPage() {
  return (
    <MinDelay fallback={<ServicesLoading />}>
      <main className="w-full text-baan-ink">
        <PageBanner title="Our Services" image={facilities} alt="The waiting area and consultation rooms of the health center" />
        <ServicesSection />
      </main>
    </MinDelay>
  );
}
