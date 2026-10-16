import Image from "next/image";
import Link from "next/link";
import { ctaButton, eyebrow } from "@/lib/styles";
import launchEvent from "@/public/landing-1.jpg";
import frontDesk from "@/public/landing-2.jpg";
import bloodSugarCheck from "@/public/landing-3.jpg";
import healthTeam from "@/public/landing-4.jpg";

const advocacies = [
  "Bakuna for every child",
  "Safe motherhood",
  "Heart-healthy living",
  "Deworming & disease prevention",
];

const gallery = [
  { src: bloodSugarCheck, alt: "A health worker checks a patient's blood sugar at the clinic table", caption: "Blood sugar and BP monitoring" },
  { src: frontDesk, alt: "Residents at the front desk of the health center pharmacy corner", caption: "Medicine and front-desk assistance" },
  { src: healthTeam, alt: "The Baan KM 3 health team posing in front of the health center", caption: "Your Baan KM 3 health team" },
];

export function AdvocaciesSection() {
  return (
    <section id="advocacies" aria-labelledby="adv-h" className="bg-white">
      <div id="about" className="mx-auto flex max-w-310 flex-col gap-14 px-6 py-24">
        <div className="flex flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-5">
            <p className={`${eyebrow} text-baan-teal`}>About Baan Health Care</p>
            <h2 id="adv-h" className="font-display text-[clamp(32px,4vw,46px)] leading-[1.08] font-extrabold text-baan-navy">
              Healthier barangay, stronger community
            </h2>
            <p className="text-lg leading-relaxed text-baan-muted">
              We&apos;re your neighbors — barangay health workers, nurses and midwives serving every family in Baan
              KM 3. Beyond check-ups, we bring health programs straight to the community.
            </p>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              {advocacies.map((a) => (
                <li key={a} className="flex items-center gap-2.5 font-semibold">
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-baan-teal">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <figure className="relative h-105 min-w-0 flex-[1_1_460px] overflow-hidden rounded-[18px]">
            <Image
              src={launchEvent}
              alt="Residents gathered under a covered court for the launch of the Baan KM3 health center"
              fill
              sizes="(max-width: 900px) 100vw, 50vw"
              className="object-cover"
            />
          </figure>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {gallery.map((g) => (
            <figure key={g.caption} className="flex flex-col gap-2.5">
              <Image
                src={g.src}
                alt={g.alt}
                sizes="(max-width: 900px) 100vw, 33vw"
                className="h-65 w-full rounded-[14px] object-cover"
              />
              <figcaption className="font-semibold text-baan-muted">{g.caption}</figcaption>
            </figure>
          ))}
        </div>

        <div className="flex justify-center">
          <Link href="/appointments" className={`${ctaButton} bg-baan-orange text-white`}>
            Book an appointment
          </Link>
        </div>
      </div>
    </section>
  );
}
