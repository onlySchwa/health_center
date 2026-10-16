"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { requestAppointment } from "@/lib/actions";
import { services, timeSlots } from "@/lib/appointment-options";

// Holds what a signed-out visitor typed while they sign in. sessionStorage is
// per-tab and cleared when the tab closes; we also delete it as soon as it's restored.
const DRAFT_KEY = "baan-booking-draft";
const draftFields = ["name", "phone", "service", "date", "time", "note"];

const fieldClass =
  "min-h-12 rounded-[10px] border-[1.5px] border-[#B9C9CC] bg-white px-3.5 py-2.5 text-base text-baan-ink focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]";
const labelClass = "text-sm font-semibold text-baan-ink";

type BookingFormProps = {
  defaults?: { name?: string; phone?: string };
};

// Signed-in residents' requests are saved; signed-out visitors are sent to sign in
// first, then brought back with their draft.
export function BookingForm({ defaults }: BookingFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      sessionStorage.removeItem(DRAFT_KEY);
      const draft: Record<string, string> = JSON.parse(saved);
      for (const field of draftFields) {
        const el = form.elements.namedItem(field);
        if (draft[field] && el && "value" in el) el.value = draft[field];
      }
    } catch {
      // Storage blocked or draft unreadable: start with an empty form.
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || saving) return;
    const data = new FormData(e.currentTarget);
    const fields = Object.fromEntries(draftFields.map((f) => [f, String(data.get(f) ?? "")]));

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

  if (submitted) {
    return (
      <div
        role="status"
        className="flex min-w-0 flex-[1_1_520px] flex-col items-start gap-4 rounded-[20px] bg-white p-9 text-baan-ink shadow-[0_30px_60px_rgba(0,0,0,0.25)]"
      >
        <h3 className="font-display text-[26px] font-bold text-baan-navy">Request received</h3>
        <p className="text-lg leading-relaxed text-baan-muted">
          Salamat! We&apos;ll text you to confirm your schedule.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="min-h-11 font-bold text-baan-orange hover:underline"
        >
          Book another appointment
        </button>
        {pathname !== "/dashboard" && (
          <Link href="/dashboard" className="inline-flex min-h-11 items-center font-bold text-baan-teal hover:underline">
            Go to my dashboard →
          </Link>
        )}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      aria-labelledby="form-h"
      onSubmit={handleSubmit}
      className="grid min-w-0 flex-[1_1_520px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-5 gap-y-4.5 rounded-[20px] bg-white p-9 text-baan-ink shadow-[0_30px_60px_rgba(0,0,0,0.25)]"
    >
      <h3 id="form-h" className="col-span-full font-display text-[26px] font-bold text-baan-navy">
        Request your appointment
      </h3>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-name" className={labelClass}>Full name</label>
        <input id="f-name" name="name" type="text" autoComplete="name" placeholder="Juan Dela Cruz" defaultValue={defaults?.name} maxLength={100} required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-phone" className={labelClass}>Mobile number</label>
        <input id="f-phone" name="phone" type="tel" autoComplete="tel" placeholder="09XX XXX XXXX" defaultValue={defaults?.phone} maxLength={20} required className={fieldClass} />
      </div>
      <div className="col-span-full flex flex-col gap-1.5">
        <label htmlFor="f-svc" className={labelClass}>Service</label>
        <select id="f-svc" name="service" className={fieldClass}>
          {services.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-date" className={labelClass}>Preferred date</label>
        <input id="f-date" name="date" type="date" required className={fieldClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-time" className={labelClass}>Preferred time</label>
        <select id="f-time" name="time" className={fieldClass}>
          {timeSlots.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="col-span-full flex flex-col gap-1.5">
        <label htmlFor="f-note" className={labelClass}>
          Anything we should know? <span className="font-normal text-[#4F6970]">(optional)</span>
        </label>
        <textarea id="f-note" name="note" rows={3} placeholder="e.g. second dose, follow-up visit" maxLength={500} className={fieldClass} />
      </div>
      {error && (
        <p role="alert" className="col-span-full rounded-[10px] bg-[#FBE9E9] px-4 py-3 font-semibold text-[#9B2C2C]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="col-span-full inline-flex min-h-14 items-center justify-center rounded-full bg-baan-orange text-[17px] font-bold text-white hover:brightness-90 disabled:opacity-60"
      >
        {saving ? "Sending…" : "Request appointment"}
      </button>
      <p className="col-span-full text-center text-sm text-[#4F6970]">
        {isLoaded && !isSignedIn
          ? "You'll sign in first — your details stay filled in."
          : "We only use your number to confirm your schedule."}
      </p>
    </form>
  );
}
