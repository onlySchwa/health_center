import { HeartPulse, Stethoscope, Syringe, type LucideIcon } from "lucide-react";
import Link from "next/link";

const links: { title: string; sub: string; bg: string; subColor: string; icon: LucideIcon }[] = [
  { title: "Book a check-up", sub: "Consultation with our health team", bg: "bg-baan-orange", subColor: "text-[#FFE6DA]", icon: Stethoscope },
  { title: "Child immunization", sub: "Bakuna schedule for babies", bg: "bg-baan-teal", subColor: "text-[#DDF3F2]", icon: Syringe },
  { title: "Prenatal care", sub: "Check-ups for moms-to-be", bg: "bg-baan-navy", subColor: "text-[#CFE3E5]", icon: HeartPulse },
];

// Full-width strip of three booking shortcuts right under the home hero.
export function QuickLinks() {
  return (
    <nav aria-label="Book a service" className="grid grid-cols-1 sm:grid-cols-3">
      {links.map(({ title, sub, bg, subColor, icon: Icon }) => (
        <Link
          key={title}
          href="/appointments"
          className={`${bg} group flex min-h-37.5 items-center gap-4.5 px-10 py-9 text-white transition-[filter] duration-300 hover:brightness-110`}
        >
          <Icon aria-hidden strokeWidth={1.8} className="size-10 flex-none" />
          <span className="flex flex-col gap-1">
            <span className="font-display text-[22px] font-bold tracking-[0.02em] uppercase">{title}</span>
            <span className={`text-[15px] ${subColor}`}>
              {sub}{" "}
              <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
