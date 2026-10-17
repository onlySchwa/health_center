import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountActions } from "@/components/account-actions";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { formatTimestamp, getAccounts, isAdmin, type Account } from "@/lib/admin";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Staff & Accounts — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

type Filter = "all" | "resident" | "staff" | "admin" | "deactivated";

const filters: { id: Filter; label: string; match: (a: Account) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "resident", label: "Residents", match: (a) => a.role === "resident" },
  { id: "staff", label: "Staff", match: (a) => a.role === "staff" },
  { id: "admin", label: "Admins", match: (a) => a.role === "admin" },
  { id: "deactivated", label: "Deactivated", match: (a) => a.banned },
];

const roleStyle: Record<Account["role"], string> = {
  resident: "bg-baan-mist text-baan-muted",
  staff: "bg-[#DDF3F2] text-[#145C5A]",
  admin: "bg-[#FFF1E8] text-[#9E3E14]",
};

const panel = "rounded-[20px] border border-baan-line bg-white";
const th = "px-4 py-3";
const td = "px-4 py-4";
const maxShown = 200;

const accountsHref = (filter: Filter, q: string) => {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("role", filter);
  if (q) params.set("q", q);
  return `/admin/accounts${params.size ? `?${params}` : ""}`;
};

export default function AdminAccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <AccountsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function AccountsContent({ searchParams }: { searchParams: PageProps<"/admin/accounts">["searchParams"] }) {
  // proxy.ts already sends non-admins away; this check (and the checks inside every
  // account action) keeps accounts safe even if that ever changes.
  if (!(await isAdmin())) notFound();
  const { userId: me } = await auth();

  const params = await searchParams;
  const filter = filters.find((f) => f.id === params.role) ?? filters[0];
  const q = typeof params.q === "string" ? params.q.slice(0, 60) : "";
  await connection(); // the list reflects live Clerk accounts

  const accounts = await getAccounts().catch((error) => {
    console.error(error);
    return null;
  });
  const term = q.trim().toLowerCase();
  const shown = (accounts ?? []).filter(
    (a) => filter.match(a) && (!term || [a.name, a.email].some((v) => v?.toLowerCase().includes(term))),
  );

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Staff &amp; accounts</h1>
        <p className="text-[15px] text-baan-muted">Sign-in is handled by Clerk. Roles and access are set here.</p>
      </div>

      <section aria-labelledby="accounts-h" className={`${panel} flex flex-col gap-5 p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="accounts-h" className="font-display text-2xl font-bold text-baan-navy">
            {filter.label}
          </h2>
          <nav aria-label="Filter accounts" className="flex flex-wrap rounded-full bg-baan-mist p-1">
            {filters.map((f) => (
              <Link
                key={f.id}
                href={accountsHref(f.id, q)}
                aria-current={filter.id === f.id ? "page" : undefined}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold ${
                  filter.id === f.id ? "bg-white text-baan-navy shadow-sm" : "text-baan-muted hover:text-baan-navy"
                }`}
              >
                {f.label}
                {accounts && <span className="font-semibold opacity-70">{accounts.filter(f.match).length}</span>}
              </Link>
            ))}
          </nav>
        </div>

        <form action="/admin/accounts" role="search" className="flex flex-wrap gap-3">
          {filter.id !== "all" && <input type="hidden" name="role" value={filter.id} />}
          <label htmlFor="account-q" className="sr-only">
            Search accounts by name or email
          </label>
          <input
            id="account-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search name or email"
            className="min-h-12 min-w-0 flex-[1_1_280px] rounded-full border-[1.5px] border-[#B9C9CC] bg-white px-5 text-base focus:border-baan-teal focus:outline-3 focus:outline-[#7FC7C4]"
          />
          <button type="submit" className="min-h-12 rounded-full bg-baan-orange px-6 text-base font-bold text-white hover:brightness-90">
            Search
          </button>
          {q && (
            <Link href={accountsHref(filter.id, "")} className="inline-flex min-h-12 items-center px-2 font-bold text-baan-muted hover:text-baan-navy">
              Clear
            </Link>
          )}
        </form>

        {!accounts ? (
          <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
            Accounts couldn&apos;t be loaded. Please try again in a few minutes.
          </p>
        ) : shown.length === 0 ? (
          <p className="rounded-xl bg-baan-mist px-5 py-10 text-center text-baan-muted">
            {q ? `No accounts match “${q}”.` : "No accounts here."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-baan-line">
            <table className="w-full min-w-215 border-collapse text-left text-[15px]">
              <thead className="bg-baan-mist text-[13px] tracking-[0.08em] text-baan-muted uppercase">
                <tr>
                  <th scope="col" className={th}>Account</th>
                  <th scope="col" className={th}>Role</th>
                  <th scope="col" className={th}>Handles</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, maxShown).map((a) => (
                  <tr key={a.id} className="border-t border-baan-line align-top">
                    <td className={td}>
                      <div className="font-semibold text-baan-navy">{a.name}</div>
                      {a.email && <div className="text-sm break-all text-baan-muted">{a.email}</div>}
                      <div className="text-sm text-baan-muted">
                        Last signed in {a.lastSignInAt ? formatTimestamp(new Date(a.lastSignInAt).toISOString()) : "never"}
                      </div>
                    </td>
                    <td className={td}>
                      <span className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${roleStyle[a.role]}`}>{a.role}</span>
                    </td>
                    <td className={td}>
                      {a.services.length > 0 ? (
                        <div className="flex max-w-64 flex-wrap gap-1.5">
                          {a.services.map((s) => (
                            <span key={s} className="rounded-full bg-[#E3EEEF] px-2.5 py-0.5 text-sm font-semibold text-baan-navy">
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-baan-muted">{a.role === "staff" ? "No services yet" : "—"}</span>
                      )}
                    </td>
                    <td className={td}>
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${a.banned ? "bg-[#EEF0F1] text-[#55666B]" : "bg-[#DDF3F2] text-[#145C5A]"}`}
                      >
                        {a.banned ? "Deactivated" : "Active"}
                      </span>
                    </td>
                    <td className={td}>
                      {a.id === me ? (
                        <span className="text-sm text-baan-muted">This is you</span>
                      ) : (
                        <AccountActions account={a} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-baan-muted">
          {shown.length > maxShown ? `Showing the first ${maxShown} of ${shown.length}. Search to narrow the list. ` : ""}
          Changes are checked on the server and saved to the{" "}
          <Link href="/admin/audit" className="underline">
            audit log
          </Link>
          . Deactivating signs the person out straight away; a new role reaches someone already signed in within about a
          minute. You can&apos;t change your own account.
        </p>
      </section>
    </div>
  );
}
