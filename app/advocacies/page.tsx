import type { Metadata } from "next";
import { AdvocaciesSection } from "@/components/advocacies-section";
import { PageBanner } from "@/components/page-banner";
import commitmentSigning from "@/public/background-for-page4.jpg";
import { MinDelay } from "@/components/min-delay";
import AdvocaciesLoading from "./loading";

export const metadata: Metadata = {
  title: "Advocacies — Baan Health Care",
  description: "Bakuna for every child, safe motherhood, and deworming and disease prevention in Baan KM 3.",
};

export default function AdvocaciesPage() {
  return (
    <MinDelay fallback={<AdvocaciesLoading />}>
      <main className="w-full text-baan-ink">
        <PageBanner
          title="Our Advocacies"
          image={commitmentSigning}
          alt="Barangay officials signing the health center commitment at its launch"
        />
        <AdvocaciesSection />
      </main>
    </MinDelay>
  );
}
