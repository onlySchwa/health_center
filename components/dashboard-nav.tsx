"use client";

import { SignOutButton } from "@clerk/nextjs";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  FileText,
  HeartPulse,
  House,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Sections are added here as each dashboard page is built.
const adminLinks: NavLink[] = [
  { href: "/admin", label: "Overview", icon: House },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/admin/residents", label: "Residents", icon: Users },
  { href: "/admin/services", label: "Health services", icon: HeartPulse },
  { href: "/admin/accounts", label: "Staff & accounts", icon: ShieldCheck },
  { href: "/admin/reports", label: "Reports", icon: ChartColumn },
  { href: "/admin/audit", label: "Audit log", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const staffLinks: NavLink[] = [
  { href: "/staff", label: "Dashboard", icon: House },
  { href: "/staff/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/staff/residents", label: "Residents", icon: Users },
  { href: "/staff/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/staff/services", label: "Health services", icon: HeartPulse },
  { href: "/staff/notifications", label: "Notifications", icon: Bell },
  { href: "/staff/reports", label: "Reports", icon: ChartColumn },
  { href: "/staff/profile", label: "My profile", icon: UserRound },
];

const navs = {
  admin: { title: "Admin dashboard", label: "Admin sections", links: adminLinks },
  staff: { title: "Staff dashboard", label: "Staff sections", links: staffLinks },
};

const item = "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] whitespace-nowrap";

// Plain list, also used as the Suspense fallback while the current path streams in.
// A scrolling row on phones, a column beside the page from md up.
export function DashboardNavList({ kind, pathname }: { kind: keyof typeof navs; pathname?: string }) {
  const nav = navs[kind];
  return (
    <nav aria-label={nav.label} className="flex flex-col gap-4 px-4 py-5 md:px-3.5 md:py-6">
      <div className="hidden flex-col gap-0.5 px-3 md:flex">
        <span className="text-xs font-bold tracking-[0.18em] text-baan-teal uppercase">{nav.title}</span>
        <span className="font-display text-xl font-bold text-baan-navy">Baan KM 3 Health Center</span>
      </div>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {nav.links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-none">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${item} ${active ? "bg-[#E3EEEF] font-bold text-baan-navy" : "font-medium text-baan-muted hover:text-baan-navy"}`}
              >
                <Icon aria-hidden className="size-5 flex-none" />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-none md:mt-2 md:border-t md:border-baan-line md:pt-2">
          <SignOutButton redirectUrl="/">
            <button type="button" className={`${item} w-full font-medium text-baan-muted hover:text-[#9B2C2C]`}>
              <LogOut aria-hidden className="size-5 flex-none" />
              Log out
            </button>
          </SignOutButton>
        </li>
      </ul>
    </nav>
  );
}

export function DashboardNav({ kind }: { kind: keyof typeof navs }) {
  return <DashboardNavList kind={kind} pathname={usePathname()} />;
}
