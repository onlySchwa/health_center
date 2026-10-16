"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/nav";

// Plain list, also used as the Suspense fallback while the current path streams in.
export function NavLinkList({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-1">
      {navLinks.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`py-3 text-[15px] font-semibold hover:text-baan-teal ${
              active ? "border-b-2 border-baan-teal text-baan-teal" : "text-baan-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function NavLinks() {
  return <NavLinkList pathname={usePathname()} />;
}
