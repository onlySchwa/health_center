import Image, { type StaticImageData } from "next/image";
import { eyebrow } from "@/lib/styles";

type PageBannerProps = {
  title: string;
  image: StaticImageData;
  alt: string;
};

export function PageBanner({ title, image, alt }: PageBannerProps) {
  return (
    <section className="relative flex min-h-75 items-center overflow-hidden bg-baan-navy">
      <Image
        src={image}
        alt={alt}
        fill
        sizes="100vw"
        fetchPriority="high"
        loading="eager"
        className="object-cover object-[center_45%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,38,50,0.88)_0%,rgba(8,38,50,0.62)_45%,rgba(8,38,50,0.25)_100%)]"
      />
      <div className="relative mx-auto w-full max-w-310 px-6 py-16">
        <div className="flex items-stretch gap-6">
          <span aria-hidden="true" className="w-1.5 flex-none rounded-xs bg-baan-orange" />
          <div className="flex flex-col gap-2">
            <p className={`${eyebrow} text-baan-mint`}>Baan KM 3 Barangay Health Center</p>
            <h1 className="font-display text-[clamp(40px,5.5vw,68px)] leading-[1.04] font-extrabold tracking-[-0.02em] text-white">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
