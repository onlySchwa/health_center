"use client";

import { useRef, useState, useTransition } from "react";
import { adminUpdateAppointment, deleteAppointment, setAppointmentArchived, type ActionResult } from "@/lib/actions";
import { services, statusStyle, timeSlots, type Status } from "@/lib/appointment-options";

type Appointment = {
  id: number;
  ref: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  service: string;
  appt_date: string;
  time_slot: string;
  note: string | null;
  status: Status;
  archived_at: string | null;
};

const field =
  "min-h-11 w-full rounded-xl border-[1.5px] border-[#B9C9CC] bg-white px-3 text-base focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]";
const small = "min-h-10 rounded-full px-4 text-sm font-bold";

// Edit / Archive (or Restore) / Delete for one appointment. Archive and delete ask first.
export function AdminRowActions({ appointment: a }: { appointment: Appointment }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  // Bumped on every open so the form starts from the latest saved values.
  const [editKey, setEditKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else onDone?.();
      setConfirming(null);
    });
  }

  function save(form: FormData) {
    run(() => adminUpdateAppointment(a.id, Object.fromEntries(form)), () => dialog.current?.close());
  }

  return (
    <div className="flex flex-col gap-1.5">
      {confirming ? (
        <>
          <span className="text-sm font-semibold">
            {confirming === "delete"
              ? `Permanently delete ${a.ref}? This can't be undone.`
              : `${a.archived_at ? "Restore" : "Archive"} ${a.ref}?`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(() => (confirming === "delete" ? deleteAppointment(a.id) : setAppointmentArchived(a.id, !a.archived_at)))
              }
              className={`${small} text-white disabled:opacity-60 ${confirming === "delete" ? "bg-[#9B2C2C] hover:brightness-110" : "bg-baan-navy hover:brightness-125"}`}
            >
              {isPending ? "Saving…" : "Yes"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(null)}
              className={`${small} text-baan-muted hover:text-baan-navy`}
            >
              No
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError("");
              setEditKey((k) => k + 1);
              setEditing(true);
              dialog.current?.showModal();
            }}
            className={`${small} bg-baan-teal text-white hover:brightness-110`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming("archive")}
            className={`${small} border-[1.5px] border-baan-line text-baan-navy hover:bg-baan-mist`}
          >
            {a.archived_at ? "Restore" : "Archive"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming("delete")}
            className={`${small} border-[1.5px] border-[#9B2C2C] text-[#9B2C2C] hover:bg-[#FBE9E9]`}
          >
            Delete
          </button>
        </div>
      )}
      {error && !editing && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}

      <dialog
        ref={dialog}
        onClose={() => setEditing(false)}
        aria-labelledby={`edit-${a.id}-h`}
        className="m-auto w-[min(560px,calc(100%-32px))] rounded-[20px] p-0 text-baan-ink backdrop:bg-black/40"
      >
        <form key={editKey} action={save} className="flex flex-col gap-4 p-7">
          <h2 id={`edit-${a.id}-h`} className="font-display text-2xl font-bold text-baan-navy">
            Edit {a.ref}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-semibold">
              First name
              <input name="firstName" required maxLength={50} defaultValue={a.first_name} className={field} />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Last name
              <input name="lastName" required maxLength={50} defaultValue={a.last_name} className={field} />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Email
              <input name="email" type="email" maxLength={254} defaultValue={a.email ?? ""} className={field} />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Mobile number
              <input name="phone" pattern="[0-9+ \-]{7,20}" defaultValue={a.phone ?? ""} className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-1 font-semibold">
            Address
            <input name="address" minLength={5} maxLength={200} defaultValue={a.address ?? ""} className={field} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-semibold">
              Service
              <select name="service" defaultValue={a.service} className={field}>
                {services.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Status
              <select name="status" defaultValue={a.status} className={`${field} capitalize`}>
                {(Object.keys(statusStyle) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Date
              <input name="date" type="date" required defaultValue={a.appt_date} className={field} />
            </label>
            <label className="flex flex-col gap-1 font-semibold">
              Time
              <select name="time" defaultValue={a.time_slot} className={field}>
                {timeSlots.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 font-semibold">
            Visit note
            <textarea name="note" maxLength={500} rows={3} defaultValue={a.note ?? ""} className={`${field} py-2`} />
          </label>
          {error && (
            <p role="alert" className="text-sm font-semibold text-[#9B2C2C]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => dialog.current?.close()}
              className="min-h-12 rounded-full px-5 font-bold text-baan-muted hover:text-baan-navy"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="min-h-12 rounded-full bg-baan-orange px-6 font-bold text-white hover:brightness-90 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
