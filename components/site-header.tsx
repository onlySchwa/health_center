import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "@/components/auth-controls";
import { NavLinkList, NavLinks } from "@/components/nav-links";
import logo from "@/public/logo.jpg";

export function SiteHeader() {
  return (
    <header className="relative z-10 border-b border-baan-line bg-white">
      <div className="mx-auto flex max-w-310 flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-2.5">
        <Link href="/" aria-label="Baan Health Care home">
          {/* The logo file has a checkerboard baked in; the filter + multiply fades it on white. */}
          <Image
            src={logo}
            alt="Baan Health Care, Baan KM 3 Barangay"
            className="h-16 w-auto brightness-110 contrast-125 mix-blend-multiply"
            loading="eager"
          />
        </Link>
        <Suspense fallback={<NavLinkList />}>
          <NavLinks />
        </Suspense>
        <div className="flex items-center gap-3">
          <Suspense>
            <AuthControls />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
