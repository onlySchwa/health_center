// Shared by the booking form (browser) and server validation. Must match the
// check constraints in supabase/migrations/ (time slots: 0001 and 0011, statuses: 0004).
// Services are managed by admins in the services table (lib/services.ts).
export const timeSlots = ["Morning (8 AM – 12 NN)", "Afternoon (1 PM – 5 PM)"];

export type Status = "pending" | "confirmed" | "completed" | "missed" | "cancelled" | "rejected";

export const statusStyle: Record<Status, string> = {
  pending: "bg-[#FFF1E8] text-[#9E3E14]",
  confirmed: "bg-[#DDF3F2] text-[#145C5A]",
  completed: "bg-baan-mist text-baan-muted",
  missed: "bg-[#FBE9E9] text-[#9B2C2C]",
  cancelled: "bg-[#EEF0F1] text-[#55666B]",
  rejected: "bg-[#F6E7F0] text-[#7A2456]",
};
