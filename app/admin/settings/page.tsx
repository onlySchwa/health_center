import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MinDelay } from "@/components/min-delay";
import { AppointmentsTableSkeleton } from "@/components/page-skeletons";
import { SettingsForm, TestEmailButton } from "@/components/settings-form";
import { formatTimestamp, getEmailDelivery, isAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import AdminLoading from "../loading";

export const metadata: Metadata = {
  title: "Settings — Admin — Baan Health Care",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <MinDelay fallback={<AdminLoading />}>
      <main className="w-full flex-1 bg-baan-mist text-baan-ink">
        <Suspense fallback={<AppointmentsTableSkeleton stats={3} />}>
          <SettingsContent />
        </Suspense>
      </main>
    </MinDelay>
  );
}

async function SettingsContent() {
  // proxy.ts already sends non-admins away; this check (and the admin-only database
  // function behind every save) keeps settings safe even if that ever changes.
  if (!(await isAdmin())) notFound();
  await connection(); // email delivery counts are live

  const fail = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [settings, delivery] = await Promise.all([getSettings().catch(fail), getEmailDelivery().catch(fail)]);

  return (
    <div className="mx-auto flex max-w-310 flex-col gap-7 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] font-extrabold text-baan-navy">Notifications &amp; settings</h1>
        <p className="text-[15px] text-baan-muted">Clinic details on the website, booking rules and which emails go out.</p>
      </div>

      <section
        aria-labelledby="delivery-h"
        className={`flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[20px] border bg-white p-7 ${delivery?.failed ? "border-[#F2C9C9]" : "border-baan-line"}`}
      >
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
          <h2 id="delivery-h" className="font-display text-2xl font-bold text-baan-navy">
            Email delivery
          </h2>
          <p className="text-[15px] text-baan-muted">
            Confirmed and rejected emails to residents, sent through Gmail. Counts exclude archived appointments.
          </p>
          {delivery?.lastFailure && (
            <p className="rounded-xl bg-[#FBE9E9] px-4 py-3 text-sm break-words text-[#5E2A2A]">
              <span className="font-semibold text-[#7F2222]">Last error</span> ({delivery.lastFailure.ref},{" "}
              {formatTimestamp(delivery.lastFailure.updated_at)}): {delivery.lastFailure.email_error ?? "No details recorded."}
            </p>
          )}
        </div>
        {delivery ? (
          <dl className="flex gap-7">
            {[
              ["Sent", delivery.sent, "text-[#145C5A]"],
              ["Failed", delivery.failed, "text-[#9B2C2C]"],
              ["No address", delivery.noEmail, "text-baan-muted"],
            ].map(([name, value, tone]) => (
              <div key={name}>
                <dt className="text-sm font-semibold text-baan-muted">{name}</dt>
                <dd className={`font-display text-[34px] leading-tight font-extrabold ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-baan-muted">Delivery counts couldn&apos;t be loaded.</p>
        )}
        <div className="flex flex-wrap items-start gap-3">
          <TestEmailButton />
          {(delivery?.failed ?? 0) + (delivery?.noEmail ?? 0) > 0 && (
            <Link
              href="/admin/appointments?tab=history&email=failed"
              className="inline-flex min-h-11 items-center rounded-full bg-[#9B2C2C] px-5 font-bold text-white hover:brightness-110"
            >
              Review unsent emails
            </Link>
          )}
        </div>
      </section>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p role="alert" className="rounded-xl bg-[#FFF1E8] px-5 py-4 text-center font-semibold text-[#9E3E14]">
          Settings couldn&apos;t be loaded. Please try again in a few minutes.
        </p>
      )}

      <p className="text-sm text-baan-muted">
        Every change is recorded in the{" "}
        <Link href="/admin/audit?action=settings" className="underline">
          audit log
        </Link>
        .
      </p>
    </div>
  );
}
