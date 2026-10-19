"use client";

import { useState, useTransition } from "react";
import { DatePicker } from "@/components/date-picker";
import { bookFollowUp, markAppointment, recordWalkIn, reviewAppointment, undoMark } from "@/lib/actions";

const field =
  "min-h-10 rounded-xl border border-baan-line bg-white px-3 text-sm focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]";
const smallButton = "min-h-10 rounded-full px-4 text-sm font-bold";

type Choice = "confirmed" | "rejected" | "completed" | "missed";

const buttons: Record<Choice, { label: string; className: string }> = {
  confirmed: { label: "Confirm", className: "bg-baan-teal text-white hover:brightness-110" },
  rejected: { label: "Reject", className: "border-[1.5px] border-[#7A2456] text-[#7A2456] hover:bg-[#F6E7F0]" },
  completed: { label: "Completed", className: "bg-baan-teal text-white hover:brightness-110" },
  missed: { label: "Missed", className: "border-[1.5px] border-[#9B2C2C] text-[#9B2C2C] hover:bg-[#FBE9E9]" },
};

const question: Record<Choice, string> = {
  confirmed: "Confirm the request from",
  rejected: "Reject the request from",
  completed: "Mark as completed:",
  missed: "Mark as missed:",
};

// Decisions can't be undone and marks only briefly (UndoButton), so each one asks for confirmation first.
// choices: what this appointment allows (pending → confirm/reject, due → completed/missed).
export function StaffActions({ id, resident, choices }: { id: number; resident: string; choices: Choice[] }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!choice) return;
    setError("");
    startTransition(async () => {
      const result =
        choice === "confirmed" || choice === "rejected" ? await reviewAppointment(id, choice) : await markAppointment(id, choice);
      if (!result.ok) setError(result.error);
      setChoice(null);
    });
  }

  if (choice) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {question[choice]} {resident}?
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={confirm}
            className="min-h-10 rounded-full bg-baan-navy px-4 text-sm font-bold text-white hover:brightness-125 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Yes"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setChoice(null)}
            className="min-h-10 rounded-full px-4 text-sm font-bold text-baan-muted hover:text-baan-navy"
          >
            No
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChoice(c)}
            className={`min-h-10 rounded-full px-4 text-sm font-bold ${buttons[c].className}`}
          >
            {buttons[c].label}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
    </div>
  );
}

// Books the resident's next visit from a completed one. The server applies the booking rules
// (days, time slots, closed dates, full slots) and explains any problem.
export function FollowUpButton({ id, slots, today }: { id: number; slots: string[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setError("");
    startTransition(async () => {
      const result = await bookFollowUp(id, data);
      if (result.ok) {
        setDone(true);
        setOpen(false);
      } else setError(result.error);
    });
  }

  if (done) return <span className="text-sm font-semibold text-baan-teal">Next visit booked and confirmed.</span>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${smallButton} border-[1.5px] border-baan-teal text-baan-teal hover:bg-baan-teal/5`}>
        Book next visit
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-baan-muted">
        Date
        <DatePicker name="date" min={today} required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-baan-muted">
        Time
        <select name="time" required className={field}>
          {slots.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={`${smallButton} bg-baan-teal text-white hover:brightness-110 disabled:opacity-60`}>
          {isPending ? "Booking…" : "Book"}
        </button>
        <button type="button" disabled={isPending} onClick={() => setOpen(false)} className={`${smallButton} text-baan-muted hover:text-baan-navy`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Records a resident who came in without booking online, for today (they're saved as confirmed).
// services: the staff member's services with their time slots.
export function WalkInForm({ services }: { services: { name: string; timeSlots: string[] }[] }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState(services[0]?.name ?? "");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [isPending, startTransition] = useTransition();
  const slots = services.find((s) => s.name === service)?.timeSlots ?? [];
  const label = "flex flex-col gap-1 text-xs font-semibold text-baan-muted";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError("");
    startTransition(async () => {
      const result = await recordWalkIn(data);
      if (result.ok) {
        setDone(result.ref ?? "");
        setOpen(false);
        form.reset();
      } else setError(result.error);
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDone("");
            setOpen(true);
          }}
          className={`${smallButton} self-start bg-baan-teal text-white hover:brightness-110`}
        >
          Record walk-in visit
        </button>
        {done && <span className="text-sm font-semibold text-baan-teal">Walk-in recorded ({done}). It&apos;s in Today below.</span>}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-baan-line p-5">
      <p className="text-sm text-baan-muted">
        For residents who came in without booking online. Saved for today as confirmed; mark it completed after the visit.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          First name
          <input name="firstName" required maxLength={50} className={field} />
        </label>
        <label className={label}>
          Last name
          <input name="lastName" required maxLength={50} className={field} />
        </label>
        <label className={label}>
          Mobile number
          <input name="phone" type="tel" required maxLength={20} pattern="[0-9+ \-]{7,20}" className={field} />
        </label>
        <label className={label}>
          Address
          <input name="address" required minLength={5} maxLength={200} className={field} />
        </label>
        <label className={label}>
          Service
          <select name="service" required value={service} onChange={(e) => setService(e.target.value)} className={field}>
            {services.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Time
          <select name="time" required className={field}>
            {slots.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label className={label}>
        Note (optional)
        <textarea name="note" maxLength={500} rows={2} className={`${field} py-2`} />
      </label>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={`${smallButton} bg-baan-teal text-white hover:brightness-110 disabled:opacity-60`}>
          {isPending ? "Saving…" : "Record visit"}
        </button>
        <button type="button" disabled={isPending} onClick={() => setOpen(false)} className={`${smallButton} text-baan-muted hover:text-baan-navy`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// Puts the staff member's own completed/missed mark back, until `until` (10 minutes after the mark).
export function UndoButton({ id, until }: { id: number; until: string }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const time = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(new Date(until));

  function undo() {
    setError("");
    startTransition(async () => {
      const result = await undoMark(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={undo}
        className={`${smallButton} self-start border-[1.5px] border-baan-navy text-baan-navy hover:bg-baan-mist disabled:opacity-60`}
      >
        {isPending ? "Undoing…" : "Undo mark"}
      </button>
      <span className="text-xs text-baan-muted">Possible until {time}</span>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
    </div>
  );
}
