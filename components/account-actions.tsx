"use client";

import { useState, useTransition } from "react";
import { setAccountActive, setAccountRole } from "@/lib/actions";
import type { Account, AccountRole } from "@/lib/admin";

const roleLabels: Record<AccountRole, string> = { resident: "Resident", staff: "Staff", admin: "Admin" };
const smallButton = "min-h-10 rounded-full px-4 text-sm font-bold disabled:opacity-60";

// Role and active/deactivated controls for one account. The server re-checks every change.
// services: every service name on record, offered when assigning a staff member.
export function AccountActions({
  account,
  services,
}: {
  account: Pick<Account, "id" | "name" | "role" | "services" | "banned">;
  services: string[];
}) {
  const [mode, setMode] = useState<"idle" | "role" | "status">("idle");
  const [role, setRole] = useState<AccountRole>(account.role);
  const [picked, setPicked] = useState<string[]>(account.services);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: () => ReturnType<typeof setAccountActive>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMode("idle");
      else setError(result.error);
    });
  }

  function cancel() {
    setMode("idle");
    setRole(account.role);
    setPicked(account.services);
    setError("");
  }

  const errorText = error && (
    <span role="alert" className="text-sm font-semibold text-[#9B2C2C]">
      {error}
    </span>
  );

  if (mode === "role") {
    return (
      <div className="flex min-w-60 flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Role for {account.name}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AccountRole)}
            className="min-h-10 rounded-lg border border-baan-line bg-white px-3 text-[15px] font-normal"
          >
            {Object.entries(roleLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {role === "staff" && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-semibold">Services they handle</legend>
            {services.map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(s)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, s] : picked.filter((p) => p !== s))}
                  className="size-4 accent-baan-teal"
                />
                {s}
              </label>
            ))}
          </fieldset>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setAccountRole(account.id, role, picked))}
            className={`${smallButton} bg-baan-navy text-white hover:brightness-125`}
          >
            {isPending ? "Saving…" : "Save role"}
          </button>
          <button type="button" disabled={isPending} onClick={cancel} className={`${smallButton} text-baan-muted hover:text-baan-navy`}>
            Cancel
          </button>
        </div>
        {errorText}
      </div>
    );
  }

  if (mode === "status") {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          {account.banned
            ? `Reactivate ${account.name}? They'll be able to sign in again.`
            : `Deactivate ${account.name}? They'll be signed out and can't sign in.`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setAccountActive(account.id, account.banned))}
            className={`${smallButton} text-white ${account.banned ? "bg-baan-teal hover:brightness-110" : "bg-[#9B2C2C] hover:brightness-110"}`}
          >
            {isPending ? "Saving…" : "Yes"}
          </button>
          <button type="button" disabled={isPending} onClick={cancel} className={`${smallButton} text-baan-muted hover:text-baan-navy`}>
            No
          </button>
        </div>
        {errorText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("role")}
          className={`${smallButton} border-[1.5px] border-baan-navy text-baan-navy hover:bg-baan-mist`}
        >
          Change role
        </button>
        <button
          type="button"
          onClick={() => setMode("status")}
          className={`${smallButton} border-[1.5px] ${account.banned ? "border-baan-teal text-[#145C5A] hover:bg-[#E8F4F3]" : "border-baan-line text-[#9B2C2C] hover:bg-[#FBE9E9]"}`}
        >
          {account.banned ? "Reactivate" : "Deactivate"}
        </button>
      </div>
      {errorText}
    </div>
  );
}
