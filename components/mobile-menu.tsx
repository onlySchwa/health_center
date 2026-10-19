"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";

// Closes the menu whenever the route changes (links, and Clerk's sign-in redirect).
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(onNavigate, [pathname, onNavigate]);
  return null;
}

// Phone/tablet header menu: a ☰ button that drops the nav links and sign-in buttons below the header.
export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="lg:hidden">
      <Suspense>
        <CloseOnNavigate onNavigate={close} />
      </Suspense>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-11 items-center justify-center rounded-full text-baan-navy hover:bg-baan-mist"
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full flex flex-col gap-4 border-b border-baan-line bg-white px-6 pt-2 pb-6 shadow-[0_12px_24px_-12px_rgba(14,59,74,0.25)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
