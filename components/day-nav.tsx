import Link from "next/link";
import { DatePicker } from "@/components/date-picker";

// Previous / Today / Next links and a date picker for pages that show one day at a time (?date=YYYY-MM-DD).
// prev and next are the neighbouring days, worked out by the page.
export function DayNav({ path, date, today, prev, next }: { path: string; date: string; today: string; prev: string; next: string }) {
  const href = (d: string) => (d === today ? path : `${path}?date=${d}`);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Link href={href(prev)} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-baan-navy hover:bg-white">
          ← Prev
        </Link>
        <Link
          href={href(today)}
          aria-current={date === today ? "date" : undefined}
          className="inline-flex min-h-11 items-center rounded-full bg-white px-4 font-bold text-baan-navy ring-1 ring-baan-line hover:bg-baan-mist"
        >
          Today
        </Link>
        <Link href={href(next)} className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-baan-navy hover:bg-white">
          Next →
        </Link>
      </div>
      <form action={path} className="flex items-center gap-2">
        <label htmlFor="day-nav-date" className="sr-only">Go to date</label>
        <DatePicker
          id="day-nav-date"
          name="date"
          required
          defaultValue={date}
          className="min-h-11 rounded-xl border border-baan-line bg-white px-3 text-[15px] focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]"
        />
        <button type="submit" className="min-h-11 rounded-full bg-baan-orange px-5 font-bold text-white hover:brightness-90">
          Go
        </button>
      </form>
    </div>
  );
}
