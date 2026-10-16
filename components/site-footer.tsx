import Image from "next/image";
import Link from "next/link";
import { navLinks } from "@/lib/nav";
import logo from "@/public/logo.jpg";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden text-white">
      <Image
        src="/end-page-background.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        aria-hidden="true"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(10,44,56,0.85)]"
      />
      <div className="relative mx-auto flex max-w-310 flex-wrap items-center justify-between gap-x-12 gap-y-6 px-6 py-12">
        <div className="rounded-xl bg-white px-3.5 py-1.5">
          <Image src={logo} alt="Baan Health Care" className="h-16 w-auto brightness-110 contrast-125 mix-blend-multiply" />
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-2">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-[15px] text-white/80 hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="w-full border-t border-white/15 pt-5 text-sm text-white/70">
          © 2026 Baan Health Care · Baan KM 3 Barangay Health Center
        </p>
      </div>
    </footer>
  );
}
