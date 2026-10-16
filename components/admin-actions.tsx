"use client";

import { useState, useTransition } from "react";
import { retryStatusEmail, reviewAppointment } from "@/lib/actions";

const labels = { confirmed: "Confirm", rejected: "Reject" } as const;

// A review can't be undone from the app, so each one asks for confirmation first.
export function AdminActions({ id, resident, canConfirm }: { id: number; resident: string; canConfirm: boolean }) {
  const [choice, setChoice] = useState<"confirmed" | "rejected" | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    if (!choice) return;
    setError("");
    startTransition(async () => {
      const result = await reviewAppointment(id, choice);
      if (!result.ok) setError(result.error);
      setChoice(null);
    });
  }

  if (choice) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {labels[choice]} {resident}&apos;s request?
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
        {canConfirm && (
          <button
            type="button"
            onClick={() => setChoice("confirmed")}
            className="min-h-10 rounded-full bg-baan-teal px-4 text-sm font-bold text-white hover:brightness-110"
          >
            Confirm
          </button>
        )}
        <button
          type="button"
          onClick={() => setChoice("rejected")}
          className="min-h-10 rounded-full border-[1.5px] border-[#9B2C2C] px-4 text-sm font-bold text-[#9B2C2C] hover:bg-[#FBE9E9]"
        >
          Reject
        </button>
      </div>
      {!canConfirm && <span className="text-sm text-baan-muted">Date has passed</span>}
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
    </div>
  );
}

// Re-sends a confirmed/rejected email that failed. The server skips it if it has since been sent.
export function RetryEmailButton({ id }: { id: number }) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const result = await retryStatusEmail(id);
            if (!result.ok) setError(result.error);
          })
        }
        className="min-h-9 text-sm font-bold text-baan-teal hover:underline disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Retry email"}
      </button>
      {error && (
        <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
          {error}
        </span>
      )}
    </>
  );
}
