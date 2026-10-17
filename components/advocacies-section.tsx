import { StorySlider, type Story } from "@/components/story-slider";
import clinicInterior from "@/public/ABOUT/image1.jpg";
import commitmentSigning from "@/public/background-for-page4.jpg";
import childImmunization from "@/public/Child Immunization.jpg";
import launchEvent from "@/public/landing-1.jpg";
import bloodSugarCheck from "@/public/landing-3.jpg";
import healthTeam from "@/public/landing-4.jpg";

const stories: Story[] = [
  {
    image: launchEvent,
    alt: "Residents gathered under a covered court for the launch of the Baan KM 3 health center",
    tag: "About Baan Health Care",
    title: "Healthier barangay, stronger community",
    text: "We're your neighbors — barangay health workers, nurses and midwives serving every family in Baan KM 3.",
    links: [
      { label: "Book a check-up", href: "/appointments" },
      { label: "Our services", href: "/services" },
      { label: "About us", href: "/about" },
    ],
  },
  {
    image: childImmunization,
    alt: "A health worker gives a smiling baby a vaccine while the mother holds him",
    tag: "Advocacy",
    title: "Bakuna for every child",
    text: "Routine vaccines for infants and children, on schedule — so every child in the barangay is protected.",
    links: [
      { label: "Book child immunization", href: "/appointments" },
      { label: "Our services", href: "/services" },
    ],
  },
  {
    image: clinicInterior,
    alt: "Health workers attending to residents inside the Baan KM 3 health center",
    tag: "Advocacy",
    title: "Safe motherhood",
    text: "Regular check-ups for a safe pregnancy and healthy delivery, from the first visit to after the baby arrives.",
    links: [
      { label: "Book prenatal care", href: "/appointments" },
      { label: "Our services", href: "/services" },
    ],
  },
  {
    image: bloodSugarCheck,
    alt: "A health worker checks a patient's blood sugar at the clinic table",
    tag: "Advocacy",
    title: "Heart-healthy living",
    text: "Blood sugar and BP monitoring that helps residents live heart-healthy lives and prevent disease before it starts.",
    links: [
      { label: "Book a check-up", href: "/appointments" },
      { label: "Our services", href: "/services" },
    ],
  },
  {
    image: commitmentSigning,
    alt: "Barangay officials signing the health center commitment at its launch",
    tag: "Advocacy",
    title: "Deworming & disease prevention",
    text: "Health programs brought straight to the community, from deworming to stopping illness before it spreads.",
    links: [
      { label: "Our advocacies", href: "/advocacies" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    image: healthTeam,
    alt: "The Baan KM 3 health team posing in front of the health center",
    tag: "Our team",
    title: "Your Baan KM 3 health team",
    text: "The faces you'll see at the front desk — ready when you arrive for your slot.",
    links: [
      { label: "Book an appointment", href: "/appointments" },
      { label: "Contact us", href: "/contact" },
    ],
  },
];

// About & advocacies on the home and Advocacies pages, told as auto-playing photo stories.
export function AdvocaciesSection() {
  return (
    <section id="advocacies" aria-labelledby="adv-h" className="bg-white">
      <div id="about" className="mx-auto max-w-310 scroll-mt-4 px-4 py-16 sm:px-6 sm:py-20">
        <h2 id="adv-h" className="sr-only">
          About Baan Health Care and our advocacies
        </h2>
        <StorySlider stories={stories} label="About Baan Health Care" />
      </div>
    </section>
  );
}
