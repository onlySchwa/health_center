import Link from "next/link";
import { formatTimestamp } from "@/lib/admin";
import type { StaffNotice } from "@/lib/staff";

// Same colors as the admin overview's notifications: red for problems, orange for to-dos, teal for updates.
const noticeStyle: Record<StaffNotice["kind"], { box: string; title: string; tag: string }> = {
  schedule: { box: "bg-[#FBE9E9] text-[#5E2A2A]", title: "text-[#7F2222]", tag: "Schedule change" },
  email: { box: "bg-[#FBE9E9] text-[#5E2A2A]", title: "text-[#7F2222]", tag: "Email failed" },
  request: { box: "bg-[#FFF1E8] text-[#5E3A28]", title: "text-[#7E3210]", tag: "New request" },
  update: { box: "bg-[#E8F4F3] text-[#2F5654]", title: "text-[#145C5A]", tag: "Update" },
};

export function NoticeItem({ n }: { n: StaffNotice }) {
  const style = noticeStyle[n.kind];
  return (
    <li className={`flex flex-col gap-1 rounded-xl px-4 py-3.5 ${style.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className={style.title}>{n.title}</strong>
        <span className="text-xs font-semibold opacity-80">
          {style.tag}
          {n.at ? ` · ${formatTimestamp(n.at)}` : ""}
        </span>
      </div>
      <p className="text-sm leading-snug">{n.text}</p>
      {n.href && (
        <Link href={n.href} className="text-sm font-bold underline">
          View
        </Link>
      )}
    </li>
  );
}
