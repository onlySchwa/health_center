import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

// Health services admins manage (see 0011_services.sql). Days are ISO weekdays, 1 = Monday.
export type Service = {
  name: string;
  description: string;
  requirements: string;
  days: number[];
  timeSlots: string[];
  active: boolean;
};

export const SERVICES_TAG = "services";

// Every service, active or not, in display order. Services are public, so this reads without a
// sign-in and is cached for every page; saving a service refreshes it (updateTag(SERVICES_TAG)).
export async function getServices(): Promise<Service[]> {
  "use cache";
  cacheTag(SERVICES_TAG);
  cacheLife("hours");

  const { data, error } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
    .from("services")
    .select("name, description, requirements, days, time_slots, active")
    .order("sort_order");
  if (error) throw new Error(`Could not load services: ${error.message}`);
  return data.map(({ time_slots, ...s }) => ({ ...s, timeSlots: time_slots }));
}

export const activeServices = (services: Service[]) => services.filter((s) => s.active);

// Weekday (1 = Monday … 7 = Sunday) of a YYYY-MM-DD date.
export const isoWeekday = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).getUTCDay() || 7;
