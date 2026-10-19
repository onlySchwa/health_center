import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AuthControls } from "@/components/auth-controls";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLinkList, NavLinks } from "@/components/nav-links";
import logo from "@/public/logo.jpg";

// Below lg the links and sign-in buttons move into the ☰ menu.
const mobileNav = "flex flex-col items-start";

export function SiteHeader() {
  return (
    <header className="relative z-10 border-b border-baan-line bg-white print:hidden">
      <div className="mx-auto flex max-w-310 items-center justify-between gap-x-8 px-6 py-2.5">
        <Link href="/" aria-label="Baan Health Care home">
          {/* The logo file has a checkerboard baked in; the filter + multiply fades it on white. */}
          <Image
            src={logo}
            alt="Baan Health Care, Baan KM 3 Barangay"
            className="h-16 w-auto brightness-110 contrast-125 mix-blend-multiply"
            loading="eager"
          />
        </Link>
        <div className="hidden lg:block">
          <Suspense fallback={<NavLinkList />}>
            <NavLinks />
          </Suspense>
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <Suspense>
            <AuthControls />
          </Suspense>
        </div>
        <MobileMenu>
          <Suspense fallback={<NavLinkList className={mobileNav} />}>
            <NavLinks className={mobileNav} />
          </Suspense>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense>
              <AuthControls />
            </Suspense>
          </div>
        </MobileMenu>
      </div>
    </header>
  );
}
