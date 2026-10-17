import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageBanner } from "@/components/page-banner";
import clinicInterior from "@/public/ABOUT/image1.jpg";
import frontDeskCheck from "@/public/ABOUT/image 2.jpg";
import { MinDelay } from "@/components/min-delay";
import AboutLoading from "./loading";

export const metadata: Metadata = {
  title: "About — Baan Health Care",
  description: "Who we are, our mission and vision, and our commitment to every family in Baan KM 3.",
};

const subNav = [
  { href: "#story", label: "Our Story" },
  { href: "#mission", label: "Mission & Vision" },
  { href: "#commitment", label: "Our Commitment" },
];

// Draft copy — replace with the center's official mission and vision.
const visionGoals = [
  "Make quality primary care available to every family, close to home;",
  "Protect children and mothers through immunization and safe-motherhood programs;",
  "Empower residents to live heart-healthy lives and prevent disease before it starts.",
];

export default function AboutPage() {
  return (
    <MinDelay fallback={<AboutLoading />}>
      <main className="w-full text-baan-ink">
        <PageBanner
          title="About Baan Health Care"
          image={clinicInterior}
          alt="Health workers attending to residents inside the Baan KM 3 health center"
        />

        <nav aria-label="About sections" className="border-b border-baan-line bg-white">
          <div className="mx-auto flex max-w-310 flex-wrap gap-x-8 px-6 font-medium">
            {subNav.map((link) => (
              <Link key={link.href} href={link.href} className="inline-flex min-h-12 items-center hover:text-baan-teal">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Our story */}
        <section id="story" className="mx-auto flex max-w-310 scroll-mt-4 flex-wrap items-start gap-12 px-6 pt-14 pb-18">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5 text-justify text-[19px] leading-[1.7] text-baan-muted">
            <p>
              Baan Health Care is the barangay health center of Baan KM 3, Butuan City — a team of barangay health
              workers, nurses and midwives committed to giving every family accessible, equitable and quality care. We
              are your neighbors, and we treat every resident who walks through our doors the way we would want our own
              lolo, lola and kids to be treated.
            </p>
            <p>
              Beyond everyday check-ups, we bring health programs straight to the community: routine immunization for
              children, prenatal care for moms-to-be, and family planning. With online booking, residents can now reserve
              a slot ahead and skip the long wait — so the center works around your day, not the other way around.
            </p>
          </div>
          <figure className="flex min-w-0 flex-[1_1_400px] flex-col gap-3">
            <Image
              src={frontDeskCheck}
              alt="A health worker takes a resident's blood pressure at the front desk"
              sizes="(max-width: 900px) 100vw, 35vw"
              className="h-80 w-full border border-baan-line object-cover"
            />
            <figcaption className="text-center text-[15px] text-baan-muted italic">
              Blood pressure check at the front desk
            </figcaption>
          </figure>
        </section>

        {/* Mission & vision */}
        <section id="mission" className="relative scroll-mt-4 overflow-hidden bg-baan-navy text-white">
          <svg
            aria-hidden="true"
            width="260"
            height="260"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute -bottom-17.5 left-[26%] text-baan-mint opacity-20"
          >
            <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
            <path d="M12 9v6M9 12h6" />
          </svg>
          <div className="relative mx-auto grid max-w-310 grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-x-18 gap-y-12 px-6 pt-18 pb-30">
            <div className="flex flex-col gap-6">
              <h2 className="font-display text-[38px] font-extrabold">Mission</h2>
              <p className="text-[19px] leading-[1.7] text-[#E4F0F1]">
                Baan Health Care commits the highest standards of health service to every resident of Baan KM 3 —
                providing accessible, equitable and quality care that promotes health, prevents illness and protects
                the well-being of the whole community.
              </p>
            </div>
            <div className="flex flex-col gap-6">
              <h2 className="font-display text-[38px] font-extrabold">Vision</h2>
              <p className="text-[19px] leading-[1.7] text-[#E4F0F1]">
                A healthier barangay and a stronger community. Baan Health Care commits itself to:
              </p>
              <ol className="flex list-decimal flex-col gap-3.5 pl-6 text-[19px] leading-[1.7] text-[#E4F0F1]">
                {visionGoals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Our commitment */}
        <section id="commitment" className="mx-auto flex max-w-310 scroll-mt-4 flex-wrap items-center gap-12 px-6 pt-18 pb-24">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            <h2 className="font-display text-[38px] font-extrabold text-baan-navy italic">Our Commitment</h2>
            <p className="text-[19px] leading-[1.7] text-baan-muted">
              Our pledge hangs on the wall of the health center for everyone to see: to serve with dedication,
              integrity and compassion, to lend a hand to every family in need, and to bring our community closer to
              the care it deserves. Watch how a day at Baan Health Care looks.
            </p>
          </div>
          <figure className="flex min-w-0 flex-[1_1_400px] flex-col gap-3">
            <video
              controls
              preload="none"
              poster="/ABOUT/image1.jpg"
              className="aspect-video w-full rounded-3xl bg-baan-navy object-cover shadow-[0_18px_40px_rgba(14,59,74,0.22)]"
            >
              <source src="/ABOUT/ABOUT-PAGE.mp4" type="video/mp4" />
            </video>
            <figcaption className="text-center text-[15px] text-baan-muted italic">
              A day at Baan KM 3 Health Center
            </figcaption>
          </figure>
        </section>
      </main>
    </MinDelay>
  );
}
