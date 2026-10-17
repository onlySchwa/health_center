"use client";

import { Printer } from "lucide-react";

// Opens the browser's print dialog, where "Save as PDF" gives a PDF copy of the report.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-baan-navy px-5 font-bold text-white hover:brightness-110"
    >
      <Printer aria-hidden className="size-4" />
      Print / PDF
    </button>
  );
}
