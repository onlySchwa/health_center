import Link from "next/link";
import { ctaButton } from "@/lib/styles";

// Fill these in with the center's real details.
const contactDetails = [
  { label: "Visit us", lines: ["Baan KM 3 Health Center", "Baan KM 3, Butuan City"] },
  { label: "Clinic hours", lines: ["[DAYS]", "[OPENING – CLOSING TIME]"] },
  { label: "Call or text", lines: ["[PHONE NUMBER]"] },
  { label: "Facebook", lines: ["[FACEBOOK PAGE]"] },
];

export function ContactSection() {
  return (
    <section id="contact" aria-labelledby="contact-h" className="bg-baan-teal text-white">
      <div className="mx-auto flex max-w-310 flex-wrap items-center gap-12 px-6 py-22">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5.5">
          <h2 id="contact-h" className="font-display text-[clamp(34px,4.4vw,54px)] leading-[1.04] font-extrabold">
            Your slot is waiting.
            <br />
            See you at the center.
          </h2>
          <div className="flex flex-wrap gap-3.5">
            <Link href="/appointments" className={`${ctaButton} bg-white text-baan-navy`}>
              Book an appointment
            </Link>
            {/* Replace with the real number, e.g. href="tel:09XXXXXXXXX" */}
            <a href="#contact" className={`${ctaButton} border-2 border-white/85 text-white`}>
              Call [PHONE NUMBER]
            </a>
          </div>
        </div>
        <dl className="grid min-w-0 flex-[1_1_420px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-8 gap-y-7 rounded-[18px] bg-baan-navy p-8">
          {contactDetails.map((d) => (
            <div key={d.label} className="flex flex-col gap-1.5">
              <dt className="text-[13px] font-bold tracking-[0.16em] text-baan-mint uppercase">{d.label}</dt>
              {d.lines.map((line) => (
                <dd key={line} className="text-[17px] leading-normal">
                  {line}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
