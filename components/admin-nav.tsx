"use client";

import { CalendarDays, ChartColumn, FileText, House, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Sections are added here as each admin page is built.
const adminLinks: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: House },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/residents", label: "Residents", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: ChartColumn },
  { href: "/admin/audit", label: "Audit log", icon: FileText },
];

// Plain list, also used as the Suspense fallback while the current path streams in.
// A scrolling row on phones, a column beside the page from md up.
export function AdminNavList({ pathname }: { pathname?: string }) {
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-4 px-4 py-5 md:px-3.5 md:py-6">
      <div className="hidden flex-col gap-0.5 px-3 md:flex">
        <span className="text-xs font-bold tracking-[0.18em] text-baan-teal uppercase">Admin dashboard</span>
        <span className="font-display text-xl font-bold text-baan-navy">Baan KM 3 Health Center</span>
      </div>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {adminLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] whitespace-nowrap ${
                  active ? "bg-[#E3EEEF] font-bold text-baan-navy" : "font-medium text-baan-muted hover:text-baan-navy"
                }`}
              >
                <Icon aria-hidden className="size-5 flex-none" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminNav() {
  return <AdminNavList pathname={usePathname()} />;
}
