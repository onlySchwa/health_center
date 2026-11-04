"use client";

import { useState, useTransition } from "react";
import { setDuty } from "@/lib/actions";

// Puts one nurse or staff member on or off duty for a day. The server re-checks every change.
export function DutyToggle({ date, userId, name, onDuty, locked }: {
  date: string;
  userId: string;
  name: string;
  onDuty: boolean;
  locked: boolean; // past days can only be read
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (locked) {
    return <span className="text-sm text-baan-muted">{onDuty ? "Was on duty" : "Off"}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-pressed={onDuty}
        aria-label={`${onDuty ? "Take" : "Put"} ${name} ${onDuty ? "off" : "on"} duty`}
        disabled={isPending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await setDuty(date, userId, !onDuty);
            if (!result.ok) setError(result.error);
          });
        }}
        className={`min-h-10 min-w-28 rounded-full px-4 text-sm font-bold disabled:opacity-60 ${
          onDuty ? "bg-baan-teal text-white hover:brightness-110" : "border-[1.5px] border-baan-navy text-baan-navy hover:bg-baan-mist"
        }`}
      >
        {isPending ? "Saving…" : onDuty ? "On duty ✓" : "Put on duty"}
      </button>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
    </div>
  );
}
