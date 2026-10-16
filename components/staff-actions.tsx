"use client";

import { useState, useTransition } from "react";
import { markAppointment } from "@/lib/actions";

// Staff can't undo a mark, so each one asks for confirmation first.
export function StaffActions({ id, resident }: { id: number; resident: string }) {
  const [choice, setChoice] = useState<"completed" | "missed" | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!choice) return;
    setError("");
    startTransition(async () => {
      const result = await markAppointment(id, choice);
      if (!result.ok) setError(result.error);
      setChoice(null);
    });
  }

  if (choice) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Mark {resident} as {choice}?</span>
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
        <button
          type="button"
          onClick={() => setChoice("completed")}
          className="min-h-10 rounded-full bg-baan-teal px-4 text-sm font-bold text-white hover:brightness-110"
        >
          Completed
        </button>
        <button
          type="button"
          onClick={() => setChoice("missed")}
          className="min-h-10 rounded-full border-[1.5px] border-[#9B2C2C] px-4 text-sm font-bold text-[#9B2C2C] hover:bg-[#FBE9E9]"
        >
          Missed
        </button>
      </div>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
    </div>
  );
}
