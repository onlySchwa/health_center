"use client";

import { useState, useTransition } from "react";
import { saveSettings, sendAdminTestEmail } from "@/lib/actions";
import type { ClinicSettings } from "@/lib/settings";

const field =
  "w-full rounded-xl border border-baan-line bg-baan-mist/60 px-3.5 py-2.5 text-[15px] focus:border-baan-teal focus:bg-white focus:outline-none focus:ring-4 focus:ring-baan-teal/15";
const label = "flex flex-col gap-1.5 text-sm font-semibold";
const hint = "text-xs font-normal text-baan-muted";
const panel = "flex flex-col gap-5 rounded-[20px] border border-baan-line bg-white p-7";
const heading = "font-display text-2xl font-bold text-baan-navy";

function Toggle({ name, defaultChecked, title, description }: { name: string; defaultChecked: boolean; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-baan-line/70 py-3 last:border-b-0">
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-baan-muted">{description}</span>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-5 flex-none accent-baan-teal" />
    </label>
  );
}

// Clinic details, booking rules and email switches, saved together. The server checks every value again.
export function SettingsForm({ settings: s }: { settings: ClinicSettings }) {
  const [closedDates, setClosedDates] = useState(s.closedDates);
  const [newDate, setNewDate] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(form: FormData) {
    setMessage(null);
    const input = {
      clinicName: form.get("clinicName"),
      address: form.get("address"),
      clinicDays: form.get("clinicDays"),
      clinicHours: form.get("clinicHours"),
      phone: form.get("phone"),
      facebookUrl: form.get("facebookUrl"),
      messengerUrl: form.get("messengerUrl"),
      maxDaysAhead: form.get("maxDaysAhead"),
      maxPerSlot: form.get("maxPerSlot"),
      allowSameDay: form.get("allowSameDay") === "on",
      closedDates,
      emailOnRequest: form.get("emailOnRequest") === "on",
      emailOnDecision: form.get("emailOnDecision") === "on",
      alertNewRequests: form.get("alertNewRequests") === "on",
    };
    startTransition(async () => {
      const result = await saveSettings(input);
      setMessage(result.ok ? { ok: true, text: "Settings saved." } : { ok: false, text: result.error });
    });
  }

  function addDate() {
    if (newDate && !closedDates.includes(newDate)) setClosedDates([...closedDates, newDate].sort());
    setNewDate("");
  }

  return (
    <form action={submit} className="flex flex-col gap-7">
      <div className="flex flex-wrap items-start gap-7">
        <section aria-labelledby="clinic-h" className={`${panel} min-w-0 flex-[1_1_420px]`}>
          <h2 id="clinic-h" className={heading}>Clinic information</h2>
          <p className="-mt-3 text-sm text-baan-muted">Shown on the Contact page and at the bottom of the home page.</p>
          <label className={label}>
            Clinic name
            <input name="clinicName" defaultValue={s.clinicName} required minLength={3} maxLength={100} className={field} />
          </label>
          <label className={label}>
            Address
            <input name="address" defaultValue={s.address} maxLength={200} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Clinic days
              <input name="clinicDays" defaultValue={s.clinicDays} maxLength={100} placeholder="e.g. Monday to Friday" className={field} />
            </label>
            <label className={label}>
              Hours
              <input name="clinicHours" defaultValue={s.clinicHours} maxLength={100} placeholder="e.g. 8 AM – 5 PM" className={field} />
            </label>
          </div>
          <label className={label}>
            Phone number
            <input name="phone" type="tel" defaultValue={s.phone} maxLength={20} placeholder="09XX XXX XXXX" className={field} />
          </label>
          <label className={label}>
            Facebook page link
            <input name="facebookUrl" type="url" defaultValue={s.facebookUrl} maxLength={200} placeholder="https://facebook.com/…" className={field} />
          </label>
          <label className={label}>
            Messenger link
            <input name="messengerUrl" type="url" defaultValue={s.messengerUrl} maxLength={200} placeholder="https://m.me/…" className={field} />
            <span className={hint}>Used for &ldquo;Send us a message&rdquo; on the Contact page. Leave blank to hide it.</span>
          </label>
        </section>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-7">
          <section aria-labelledby="rules-h" className={panel}>
            <h2 id="rules-h" className={heading}>Booking rules</h2>
            <p className="-mt-3 text-sm text-baan-muted">
              On top of each service&apos;s days and times. The booking form and the database both apply them.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Book up to (days ahead)
                <input name="maxDaysAhead" type="number" min={1} max={365} defaultValue={s.maxDaysAhead ?? ""} placeholder="No limit" className={field} />
              </label>
              <label className={label}>
                Most bookings per slot
                <input name="maxPerSlot" type="number" min={1} max={500} defaultValue={s.maxPerSlot ?? ""} placeholder="No limit" className={field} />
                <span className={hint}>Per service, morning or afternoon.</span>
              </label>
            </div>
            <label className="flex items-center gap-2.5 text-[15px] font-semibold">
              <input type="checkbox" name="allowSameDay" defaultChecked={s.allowSameDay} className="size-5 accent-baan-teal" />
              Allow booking for today
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Closed dates (holidays)</legend>
              {closedDates.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {closedDates.map((d) => (
                    <li key={d} className="flex items-center gap-1 rounded-full bg-[#FFF1E8] py-1 pr-1 pl-3 text-sm font-semibold text-[#7E3210]">
                      {d}
                      <button
                        type="button"
                        onClick={() => setClosedDates(closedDates.filter((x) => x !== d))}
                        aria-label={`Remove ${d}`}
                        className="flex size-7 items-center justify-center rounded-full hover:bg-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-baan-muted">None.</p>
              )}
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="closed-add">
                  Add a closed date
                </label>
                <input id="closed-add" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={`${field} max-w-48`} />
                <button
                  type="button"
                  onClick={addDate}
                  disabled={!newDate}
                  className="min-h-11 rounded-full border-[1.5px] border-baan-navy px-4 text-sm font-bold text-baan-navy hover:bg-baan-mist disabled:opacity-50"
                >
                  Add date
                </button>
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="emails-h" className={panel}>
            <h2 id="emails-h" className={heading}>Emails</h2>
            <div className="-my-3">
              <Toggle name="emailOnRequest" defaultChecked={s.emailOnRequest} title="Request received" description="Sends the resident a copy of their booking." />
              <Toggle
                name="emailOnDecision"
                defaultChecked={s.emailOnDecision}
                title="Confirmed or rejected"
                description="Tells the resident when an admin decides. Manual resends still work when this is off."
              />
              <Toggle name="alertNewRequests" defaultChecked={s.alertNewRequests} title="New request alert" description="Emails every admin when a resident books." />
            </div>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-12 rounded-full bg-baan-navy px-7 font-bold text-white hover:brightness-125 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`font-semibold ${message.ok ? "text-[#145C5A]" : "text-[#9B2C2C]"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

// Sends a test email to the signed-in admin.
export function TestEmailButton() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendAdminTestEmail();
            setMessage(result.ok ? { ok: true, text: `Sent to ${result.to}.` } : { ok: false, text: result.error });
          })
        }
        className="min-h-11 rounded-full border-[1.5px] border-baan-navy bg-white px-5 font-bold text-baan-navy hover:bg-baan-mist disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send test email"}
      </button>
      {message && (
        <span role={message.ok ? "status" : "alert"} className={`text-sm font-semibold ${message.ok ? "text-[#145C5A]" : "text-[#9B2C2C]"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
