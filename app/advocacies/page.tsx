import type { Metadata } from "next";
import { AdvocaciesSection } from "@/components/advocacies-section";
import { PageBanner } from "@/components/page-banner";
import commitmentSigning from "@/public/background-for-page4.jpg";

export const metadata: Metadata = {
  title: "Advocacies — Baan Health Care",
  description: "Bakuna for every child, safe motherhood, heart-healthy living and disease prevention in Baan KM 3.",
};

export default function AdvocaciesPage() {
  return (
    <main className="w-full text-baan-ink">
      <PageBanner
        title="Our Advocacies"
        image={commitmentSigning}
        alt="Barangay officials signing the health center commitment at its launch"
      />
      <AdvocaciesSection />
    </main>
  );
}
