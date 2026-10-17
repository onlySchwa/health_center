import Link from "next/link";
import { getSettings, type ClinicSettings } from "@/lib/settings";
import { ctaButton } from "@/lib/styles";

// Clinic details as admins set them (Admin → Settings). Details not filled in yet are left out.
export async function ContactSection() {
  const s: ClinicSettings | null = await getSettings().catch((error) => {
    console.error(error);
    return null;
  });
  const contactDetails = [
    { label: "Visit us", lines: [s?.clinicName, s?.address] },
    { label: "Clinic hours", lines: [s?.clinicDays, s?.clinicHours] },
    { label: "Call or text", lines: [s?.phone] },
  ]
    .map((d) => ({ ...d, lines: d.lines.filter((line): line is string => Boolean(line)) }))
    .filter((d) => d.lines.length > 0);

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
            {s?.phone && (
              <a href={`tel:${s.phone.replace(/\s+/g, "")}`} className={`${ctaButton} border-2 border-white/85 text-white`}>
                Call {s.phone}
              </a>
            )}
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
          {s?.facebookUrl && (
            <div className="flex flex-col gap-1.5">
              <dt className="text-[13px] font-bold tracking-[0.16em] text-baan-mint uppercase">Facebook</dt>
              <dd className="text-[17px] leading-normal">
                <a href={s.facebookUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3 hover:text-baan-mint">
                  Visit our page
                  <span className="sr-only"> (opens Facebook in a new tab)</span>
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
