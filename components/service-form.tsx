"use client";

import { useState, useTransition } from "react";
import { saveService } from "@/lib/actions";
import { timeSlots } from "@/lib/appointment-options";
import type { Service } from "@/lib/services";

const weekdays = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
];

const field =
  "w-full rounded-xl border border-baan-line bg-baan-mist/60 px-3.5 py-2.5 text-[15px] focus:border-baan-teal focus:bg-white focus:outline-none focus:ring-4 focus:ring-baan-teal/15 disabled:opacity-70";
const label = "flex flex-col gap-1.5 text-sm font-semibold";
const chip =
  "flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-baan-line px-3.5 text-sm font-semibold has-checked:border-baan-teal has-checked:bg-baan-teal/10 has-checked:text-[#145C5A]";

const blank: Service = { name: "", description: "", requirements: "", days: [1, 2, 3, 4, 5], timeSlots, active: true };

// Add or edit one service. The name is fixed once created; the server checks every field again.
export function ServiceForm({ service }: { service?: Service }) {
  const isNew = !service;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(form: FormData) {
    setError("");
    const input = {
      name: form.get("name"),
      description: form.get("description"),
      requirements: form.get("requirements"),
      days: form.getAll("days").map(Number),
      timeSlots: form.getAll("timeSlots"),
      active: form.get("active") === "on",
    };
    startTransition(async () => {
      const result = await saveService(input, isNew);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isNew
            ? "inline-flex min-h-12 items-center rounded-full bg-baan-orange px-6 font-bold text-white hover:brightness-90"
            : "min-h-10 rounded-full border-[1.5px] border-baan-navy px-4 text-sm font-bold text-baan-navy hover:bg-baan-mist"
        }
      >
        {isNew ? "Add service" : "Edit"}
      </button>
    );
  }

  const s = service ?? blank;
  return (
    <form action={submit} className="flex w-full flex-col gap-4 rounded-2xl border border-baan-line bg-white p-5">
      <label className={label}>
        Name shown to residents
        <input name="name" defaultValue={s.name} required minLength={3} maxLength={60} disabled={!isNew} className={field} />
        {!isNew && <span className="text-xs font-normal text-baan-muted">Names can&apos;t be changed: appointments and staff assignments use them.</span>}
      </label>
      <label className={label}>
        Description
        <textarea name="description" defaultValue={s.description} rows={2} maxLength={300} className={`${field} resize-y`} />
      </label>
      <label className={label}>
        What to bring
        <textarea
          name="requirements"
          defaultValue={s.requirements}
          rows={2}
          maxLength={300}
          placeholder="e.g. the child's immunization card"
          className={`${field} resize-y`}
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Days offered</legend>
        <div className="flex flex-wrap gap-2">
          {weekdays.map((w) => (
            <label key={w.day} className={chip}>
              <input type="checkbox" name="days" value={w.day} defaultChecked={s.days.includes(w.day)} className="size-4 accent-baan-teal" />
              {w.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Time slots</legend>
        <div className="flex flex-wrap gap-2">
          {timeSlots.map((t) => (
            <label key={t} className={chip}>
              <input type="checkbox" name="timeSlots" value={t} defaultChecked={s.timeSlots.includes(t)} className="size-4 accent-baan-teal" />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2.5 text-[15px] font-semibold">
        <input type="checkbox" name="active" defaultChecked={s.active} className="size-4 accent-baan-teal" />
        Open for booking
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-[#FBE9E9] px-4 py-3 text-sm font-semibold text-[#9B2C2C]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-full bg-baan-navy px-5 font-bold text-white hover:brightness-125 disabled:opacity-60"
        >
          {isPending ? "Saving…" : isNew ? "Add service" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="min-h-11 rounded-full px-5 font-bold text-baan-muted hover:text-baan-navy"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
