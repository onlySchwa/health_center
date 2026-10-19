"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// A date field for admin and staff forms: shows the date, opens the calendar in a pop-up, and submits
// the date as yyyy-mm-dd under `name` like the plain date input it replaces. Pass `value` and
// `onChange` to control it; otherwise it starts at `defaultValue`. Optional fields get a Clear button.
export function DatePicker({
  name,
  id,
  defaultValue = "",
  value,
  onChange,
  min,
  required = false,
  className = "",
}: {
  name?: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string; // yyyy-mm-dd, earliest date that can be picked
  required?: boolean;
  className?: string; // the field's look, from the form it sits in
}) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const current = value ?? inner;
  const date = current ? parseISO(current) : undefined;

  function pick(next: string) {
    setInner(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          type="button"
          className={`${className} flex items-center justify-between gap-3 text-left ${date ? "text-baan-ink" : "text-[#7A9095]"}`}
        >
          {date ? format(date, "MM/dd/yyyy") : "mm/dd/yyyy"}
          <CalendarDays aria-hidden className="size-5 flex-none text-baan-ink" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto gap-2 p-2">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(day) => day && pick(format(day, "yyyy-MM-dd"))}
            disabled={min ? { before: parseISO(min) } : undefined}
            className="rounded-lg border"
          />
          {!required && current && (
            <Button type="button" variant="ghost" size="sm" onClick={() => pick("")}>
              Clear
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
