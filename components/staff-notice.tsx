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

// A notice with a link is clickable as a whole card: it lifts on hover, presses on click, and its
// arrow slides toward where it leads. Motion is skipped for people who ask for reduced motion.
// Shared with the admin overview's notifications.
export const clickableNotice =
  "group flex flex-col gap-1 rounded-xl px-4 py-3.5 ring-1 ring-transparent transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-6px_rgba(16,42,67,0.25)] hover:ring-current/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7FC7C4] active:translate-y-0 active:scale-[0.99] active:shadow-none motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function NoticeArrow() {
  return (
    <span
      aria-hidden="true"
      className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
    >
      →
    </span>
  );
}

export function NoticeItem({ n }: { n: StaffNotice }) {
  const style = noticeStyle[n.kind];
  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className={style.title}>{n.title}</strong>
        <span className="text-xs font-semibold opacity-80">
          {style.tag}
          {n.at ? ` · ${formatTimestamp(n.at)}` : ""}
        </span>
      </div>
      <p className="text-sm leading-snug">{n.text}</p>
    </>
  );
  if (!n.href) return <li className={`flex flex-col gap-1 rounded-xl px-4 py-3.5 ${style.box}`}>{body}</li>;
  return (
    <li>
      <Link href={n.href} className={`${clickableNotice} ${style.box}`}>
        {body}
        <span className="inline-flex items-center gap-1 text-sm font-bold">
          View
          <NoticeArrow />
        </span>
      </Link>
    </li>
  );
}
