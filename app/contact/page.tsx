import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
import heroBanner from "@/public/hero-banner.jpg";
import { MinDelay } from "@/components/min-delay";
import { getSettings } from "@/lib/settings";
import ContactLoading from "./loading";

export const metadata: Metadata = {
  title: "Contact Us — Baan Health Care",
  description: "Visit, call or message the Baan KM 3 Barangay Health Center.",
};

const mapEmbed =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2673.6090993736134!2d125.56252219286804!3d8.95962574205863!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3301c10001dfaa55%3A0x2f7c2d5e719627d8!2sBARANGAY%20BAAN%20KM.3%20HEALTH%20CENTER!5e1!3m2!1sen!2sph!4v1792037623301!5m2!1sen!2sph";
const directions =
  "https://www.google.com/maps/dir/?api=1&destination=BARANGAY%20BAAN%20KM.3%20HEALTH%20CENTER%2C%20Butuan%20City";

export default async function ContactPage() {
  // Clinic details as admins set them (Admin → Settings).
  const s = await getSettings().catch((error) => {
    console.error(error);
    return null;
  });
  return (
    <MinDelay fallback={<ContactLoading />}>
      <main className="w-full bg-baan-mist text-baan-ink">
        <PageBanner title="Contact Us" image={heroBanner} alt="Baan KM 3 Barangay Health Center buildings under a clear blue sky" />

        <div className="mx-auto flex max-w-310 flex-col gap-16 px-6 pt-14 pb-24">
          <section aria-labelledby="location-h" className="overflow-hidden rounded-[20px] border border-baan-line bg-white">
            <h2 id="location-h" className="bg-baan-navy px-8 py-5 font-display text-2xl font-bold text-white">
              Our Location
            </h2>
            <div className="p-5 sm:p-8">
              <figure className="overflow-hidden rounded-xl border border-baan-line">
                <iframe
                  src={mapEmbed}
                  title="Map showing Barangay Baan KM 3 Health Center"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="block h-[clamp(320px,50vw,480px)] w-full border-0"
                />
                <figcaption className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-bold tracking-[0.04em] text-baan-navy uppercase">
                      {s?.clinicName ?? "Baan KM 3 Barangay Health Center"}
                    </p>
                    <p className="text-baan-muted">{s?.address ?? "Baan KM 3, Butuan City"}</p>
                    {(s?.clinicDays || s?.clinicHours) && (
                      <p className="text-baan-muted">{[s.clinicDays, s.clinicHours].filter(Boolean).join(" · ")}</p>
                    )}
                    {s?.phone && (
                      <a href={`tel:${s.phone.replace(/\s+/g, "")}`} className="font-semibold text-baan-teal hover:underline">
                        {s.phone}
                      </a>
                    )}
                  </div>
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border-[1.5px] border-baan-navy px-4 font-semibold text-baan-navy hover:bg-baan-mist"
                  >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m16 8-6 2-2 6 6-2z" />
                    </svg>
                    Directions
                    <span className="sr-only">(opens Google Maps in a new tab)</span>
                  </a>
                </figcaption>
              </figure>
            </div>
          </section>

          <section aria-labelledby="reach-h" className="flex flex-col gap-2">
            <h2 id="reach-h" className="font-display text-[clamp(30px,3.6vw,40px)] leading-tight font-extrabold text-baan-navy">
              Reach Out to Us
            </h2>
            <p className="text-lg text-baan-muted">
              Have questions about our services or your appointment? We&apos;re here to help.{" "}
              {s?.messengerUrl && (
                <a
                  href={s.messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-baan-teal underline underline-offset-3 hover:text-baan-navy"
                >
                  Send us a message
                  <span className="sr-only"> (opens Messenger in a new tab)</span>
                </a>
              )}
            </p>
          </section>
        </div>
      </main>
    </MinDelay>
  );
}
