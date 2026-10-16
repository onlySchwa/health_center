import type { Metadata } from "next";
import { BookingSection } from "@/components/booking-section";
import { PageBanner } from "@/components/page-banner";
import frontDesk from "@/public/landing-2.jpg";

export const metadata: Metadata = {
  title: "Appointments — Baan Health Care",
  description: "Book your slot at the Baan KM 3 Barangay Health Center in three easy steps.",
};

export default function AppointmentsPage() {
  return (
    <main className="w-full text-baan-ink">
      <PageBanner title="Book an Appointment" image={frontDesk} alt="Residents at the front desk of the health center" />
      <BookingSection />
    </main>
  );
}
