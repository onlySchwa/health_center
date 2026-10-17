"use client";

import { useAuth } from "@clerk/nextjs";
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  Lock,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  Sun,
  Sunset,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { requestAppointment } from "@/lib/actions";
import { timeSlots } from "@/lib/appointment-options";
import type { Service } from "@/lib/services";
import type { BookingRules } from "@/lib/settings";

export type BookingService = Pick<Service, "name" | "requirements" | "days" | "timeSlots">;

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Holds what a signed-out visitor typed while they sign in. sessionStorage is
// per-tab and cleared when the tab closes; we also delete it as soon as it's restored.
const DRAFT_KEY = "baan-booking-draft";
const draftFields = ["email", "firstName", "lastName", "phone", "address", "service", "time", "date", "note"];

const fieldClass =
  "peer min-h-12 w-full rounded-xl border border-baan-line bg-baan-mist/60 px-3.5 py-2.5 text-base text-baan-ink transition-colors placeholder:text-[#7A9095] hover:border-[#B9C9CC] focus:border-baan-teal focus:bg-white focus:outline-none focus:ring-4 focus:ring-baan-teal/15";
const withIcon = "pl-11";
const labelClass = "text-sm font-semibold text-baan-ink";
const optional = <span className="ml-1 text-[13px] font-normal text-baan-muted">(optional)</span>;
const slotIcons = [Sun, Sunset];

const datePresets = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "In a week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

// Today in the Philippines (YYYY-MM-DD), so the calendar greys out the same past days the server rejects.
const manilaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const subscribeNever = () => () => {};

function Field({ id, label, icon: Icon, children, wide }: {
  id: string;
  label: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "col-span-full" : ""}`}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        {children}
        {Icon && (
          <Icon aria-hidden className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-[#7A9095] peer-focus:text-baan-teal" />
        )}
      </div>
    </div>
  );
}

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <div className="col-span-full flex items-center gap-3 pt-2">
      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-baan-teal/10 text-sm font-bold text-baan-teal">
        {step}
      </span>
      <h4 className="text-[13px] font-bold tracking-[0.14em] text-baan-navy uppercase">{title}</h4>
      <span aria-hidden className="h-px flex-1 bg-baan-line" />
    </div>
  );
}

type BookingFormProps = {
  // Active services only; each one's days (1 = Monday) and time slots limit what can be picked.
  services: BookingService[];
  // Same-day booking, how far ahead and closed dates (Admin → Settings). Full slots are checked on submit.
  rules: BookingRules;
  defaults?: { firstName?: string; lastName?: string; email?: string; phone?: string };
};

// Signed-in residents' requests are saved; signed-out visitors are sent to sign in
// first, then brought back with their draft.
export function BookingForm({ services, rules, defaults }: BookingFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  // null while Next.js prerenders the page (it can't bake "today" into static HTML); the real date once in the browser.
  const todayIso = useSyncExternalStore(subscribeNever, manilaToday, () => null);
  const today = todayIso ? parseISO(todayIso) : null;
  const [date, setDate] = useState<Date>();
  const [month, setMonth] = useState<Date>();
  const [serviceName, setServiceName] = useState(services[0]?.name ?? "");
  const [slot, setSlot] = useState("");
  const service = services.find((s) => s.name === serviceName) ?? services[0];
  // The chosen slot if this service offers it, else its first slot.
  const timeSlot = service?.timeSlots.includes(slot) ? slot : (service?.timeSlots[0] ?? "");
  const firstDay = today && (rules.allowSameDay ? today : addDays(today, 1));
  const lastDay = today && rules.maxDaysAhead !== null ? addDays(today, rules.maxDaysAhead) : null;
  const offeredOn = (day: Date) =>
    Boolean(service?.days.includes(day.getDay())) &&
    !rules.closedDates.includes(format(day, "yyyy-MM-dd")) &&
    (!firstDay || day >= firstDay) &&
    (!lastDay || day <= lastDay);

  function pickDate(day: Date) {
    setDate(day);
    setMonth(day);
  }

  function pickService(name: string) {
    setServiceName(name);
    const next = services.find((s) => s.name === name);
    // Clear a date the newly chosen service isn't offered on.
    if (date && next && !next.days.includes(date.getDay())) setDate(undefined);
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      sessionStorage.removeItem(DRAFT_KEY);
      const draft: Record<string, string> = JSON.parse(saved);
      for (const field of draftFields) {
        if (field === "service" || field === "time" || field === "date") continue;
        const el = form.elements.namedItem(field);
        if (draft[field] && el && "value" in el) el.value = draft[field];
      }
      // Service, time and date live in state, so restore them there. sessionStorage only
      // exists in the browser, so this can't move into useState's initializer.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (draft.service) setServiceName(draft.service);
      if (draft.time) setSlot(draft.time);
      if (draft.date) pickDate(parseISO(draft.date));
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // Storage blocked or draft unreadable: start with an empty form.
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || saving) return;
    const data = new FormData(e.currentTarget);
    const fields = Object.fromEntries(draftFields.map((f) => [f, String(data.get(f) ?? "")]));
    // A hidden input can't be marked required, so check the calendar here.
    if (!fields.date) {
      setError("Please choose a date.");
      return;
    }

    if (isSignedIn) {
      setSaving(true);
      setError("");
      const result = await requestAppointment(fields);
      setSaving(false);
      if (result.ok) setSubmitted(true);
      else setError(result.error);
      return;
    }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
    } catch {
      // Storage unavailable: they'll just retype after signing in.
    }
    router.push(`/sign-in?redirect_url=${encodeURIComponent(`${pathname}#book`)}`);
  }

  const card =
    "min-w-0 flex-[1_1_520px] rounded-3xl bg-white text-baan-ink shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5";

  if (submitted) {
    return (
      <div role="status" className={`${card} flex flex-col items-center gap-4 p-10 text-center`}>
        <span className="flex size-16 items-center justify-center rounded-full bg-baan-teal/10">
          <CircleCheck aria-hidden className="size-9 text-baan-teal" />
        </span>
        <h3 className="font-display text-[26px] font-bold text-baan-navy">Request received</h3>
        <p className="max-w-sm text-lg leading-relaxed text-baan-muted">
          Salamat! We&apos;ll email you once your schedule is confirmed.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="inline-flex min-h-11 items-center rounded-full border border-baan-line px-5 font-bold text-baan-navy hover:bg-baan-mist"
          >
            Book another
          </button>
          {pathname !== "/dashboard" && (
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-baan-teal px-5 font-bold text-white hover:brightness-110"
            >
              Go to my dashboard <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div role="status" className={`${card} flex flex-col items-center gap-3 p-10 text-center`}>
        <h3 className="font-display text-[26px] font-bold text-baan-navy">Online booking is paused</h3>
        <p className="max-w-sm text-lg leading-relaxed text-baan-muted">
          No services are open for booking right now. Please call or visit the health center.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} aria-labelledby="form-h" onSubmit={handleSubmit} className={`${card} overflow-hidden`}>
      <div className="border-b border-baan-line bg-linear-to-br from-baan-mist to-white px-7 py-6 sm:px-9">
        <p className="text-xs font-bold tracking-[0.18em] text-baan-teal uppercase">Book a visit</p>
        <h3 id="form-h" className="mt-1 font-display text-[26px] font-bold text-baan-navy">
          Request your appointment
        </h3>
        <p className="mt-1 text-[15px] text-baan-muted">It takes about a minute. We&apos;ll confirm by email.</p>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4.5 px-7 py-7 sm:grid-cols-2 sm:px-9">
        <SectionHeading step={1} title="Your details" />
        <Field id="f-email" label="Email address" icon={Mail} wide>
          <input id="f-email" name="email" type="email" autoComplete="email" placeholder="juan@example.com" defaultValue={defaults?.email} maxLength={254} required className={`${fieldClass} ${withIcon}`} />
        </Field>
        <Field id="f-first" label="First name" icon={User}>
          <input id="f-first" name="firstName" type="text" autoComplete="given-name" placeholder="Juan" defaultValue={defaults?.firstName} maxLength={50} required className={`${fieldClass} ${withIcon}`} />
        </Field>
        <Field id="f-last" label="Last name">
          <input id="f-last" name="lastName" type="text" autoComplete="family-name" placeholder="Dela Cruz" defaultValue={defaults?.lastName} maxLength={50} required className={fieldClass} />
        </Field>
        <Field id="f-phone" label={<>Mobile number{optional}</>} icon={Phone} wide>
          <input id="f-phone" name="phone" type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" defaultValue={defaults?.phone} pattern="[0-9+ \-]{7,20}" maxLength={20} className={`${fieldClass} ${withIcon}`} />
        </Field>
        <Field id="f-address" label="Address" icon={MapPin} wide>
          <input id="f-address" name="address" type="text" autoComplete="street-address" placeholder="House no., street, barangay, city" minLength={5} maxLength={200} required className={`${fieldClass} ${withIcon}`} />
        </Field>

        <SectionHeading step={2} title="Appointment" />
        <Field id="f-svc" label="Service to appoint" icon={Stethoscope} wide>
          <select
            id="f-svc"
            name="service"
            value={service?.name ?? ""}
            onChange={(e) => pickService(e.target.value)}
            aria-describedby={service?.requirements ? "f-svc-req" : undefined}
            className={`${fieldClass} ${withIcon} appearance-none pr-10`}
          >
            {services.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-3.5 right-3.5 size-5 text-[#7A9095]" />
        </Field>
        {service?.requirements && (
          <p id="f-svc-req" className="col-span-full -mt-2 rounded-xl bg-baan-teal/5 px-4 py-3 text-sm text-baan-ink">
            <span className="font-semibold text-baan-teal">What to bring: </span>
            {service.requirements}
          </p>
        )}
        <fieldset className="col-span-full flex flex-col gap-1.5">
          <legend className={`${labelClass} mb-1.5`}>Preferred time</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {timeSlots.filter((t) => service?.timeSlots.includes(t)).map((t) => {
              const Icon = slotIcons[timeSlots.indexOf(t)] ?? Sun;
              const [label, hours] = t.split(" (");
              return (
                <label
                  key={t}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-baan-line bg-baan-mist/60 px-4 py-3 transition-colors hover:border-[#B9C9CC] has-checked:border-baan-teal has-checked:bg-baan-teal/5 has-checked:ring-4 has-checked:ring-baan-teal/15 has-focus-visible:ring-4 has-focus-visible:ring-baan-teal/25"
                >
                  <input type="radio" name="time" value={t} checked={timeSlot === t} onChange={() => setSlot(t)} className="sr-only" />
                  <Icon aria-hidden className="size-5 flex-none text-baan-teal" />
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold text-baan-navy">{label}</span>
                    <span className="text-sm text-baan-muted">{hours?.replace(")", "")}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="col-span-full flex flex-col gap-1.5">
          <legend className={`${labelClass} mb-1.5`}>
            Preferred date
            <span className="ml-1 text-[13px] font-normal text-baan-muted">
              ({service?.days.length === 5 ? "Monday to Friday" : service?.days.map((d) => dayNames[d]).join(", ")})
            </span>
          </legend>
          <input type="hidden" name="date" value={date ? format(date, "yyyy-MM-dd") : ""} />
          {today ? (
            <div className="mx-auto w-fit max-w-75 overflow-hidden rounded-xl border border-baan-line">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                month={month ?? today}
                onMonthChange={setMonth}
                startMonth={today}
                endMonth={lastDay ?? undefined}
                disabled={[{ before: today }, (day) => !offeredOn(day)]}
                fixedWeeks
                className="p-3 [--cell-size:--spacing(9.5)]"
              />
              <div className="flex flex-wrap gap-2 border-t border-baan-line p-3">
                {datePresets.map((preset) => {
                  const day = addDays(today, preset.days);
                  return (
                    <Button
                      key={preset.days}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={!offeredOn(day)}
                      onClick={() => pickDate(day)}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            <Skeleton className="mx-auto h-110 w-75 max-w-full bg-baan-line" />
          )}
        </fieldset>
        <Field id="f-note" label={<>Anything we should know?{optional}</>} wide>
          <textarea id="f-note" name="note" rows={3} placeholder="e.g. second dose, follow-up visit" maxLength={500} className={`${fieldClass} resize-y`} />
        </Field>

        {error && (
          <p role="alert" className="col-span-full rounded-xl border border-[#F2C9C9] bg-[#FBE9E9] px-4 py-3 font-semibold text-[#9B2C2C]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="col-span-full mt-1 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-baan-orange text-[17px] font-bold text-white shadow-[0_8px_20px_-6px_rgba(196,81,31,0.6)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-baan-orange/30 disabled:opacity-60"
        >
          {saving ? "Sending…" : <>Request appointment <ArrowRight aria-hidden className="size-5" /></>}
        </button>
        <p className="col-span-full flex items-center justify-center gap-1.5 text-center text-sm text-baan-muted">
          <Lock aria-hidden className="size-3.5 flex-none" />
          {isLoaded && !isSignedIn
            ? "You'll sign in first — your details stay filled in."
            : "Your details are only used to confirm your visit."}
        </p>
      </div>
    </form>
  );
}
