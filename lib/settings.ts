import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

// The clinic's details, booking rules and email switches (see 0012_settings.sql). One row.
export type ClinicSettings = {
  clinicName: string;
  address: string;
  clinicDays: string;
  clinicHours: string;
  phone: string;
  facebookUrl: string;
  messengerUrl: string;
  maxDaysAhead: number | null;
  maxPerSlot: number | null;
  allowSameDay: boolean;
  closedDates: string[];
  emailOnRequest: boolean;
  emailOnDecision: boolean;
  alertNewRequests: boolean;
};

export const SETTINGS_TAG = "settings";

// Settings are public, so this reads without a sign-in and is cached for every page;
// saving settings refreshes it (updateTag(SETTINGS_TAG)).
export async function getSettings(): Promise<ClinicSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("hours");

  const { data: s, error } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
    .from("clinic_settings")
    .select("*")
    .single();
  if (error) throw new Error(`Could not load clinic settings: ${error.message}`);
  return {
    clinicName: s.clinic_name,
    address: s.address,
    clinicDays: s.clinic_days,
    clinicHours: s.clinic_hours,
    phone: s.phone,
    facebookUrl: s.facebook_url,
    messengerUrl: s.messenger_url,
    maxDaysAhead: s.max_days_ahead,
    maxPerSlot: s.max_per_slot,
    allowSameDay: s.allow_same_day,
    closedDates: s.closed_dates,
    emailOnRequest: s.email_on_request,
    emailOnDecision: s.email_on_decision,
    alertNewRequests: s.alert_new_requests,
  };
}

// Booking rules the calendar applies before the server does (it can't know which slots are full).
export type BookingRules = Pick<ClinicSettings, "maxDaysAhead" | "allowSameDay" | "closedDates">;

// The calendar's rules; if settings can't load, no extra limits (the server still checks them all).
export async function getBookingRules(): Promise<BookingRules> {
  try {
    const { maxDaysAhead, allowSameDay, closedDates } = await getSettings();
    return { maxDaysAhead, allowSameDay, closedDates };
  } catch (error) {
    console.error(error);
    return { maxDaysAhead: null, allowSameDay: true, closedDates: [] };
  }
}
