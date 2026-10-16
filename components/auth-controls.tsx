import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function AuthControls() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border-2 border-baan-navy px-5 text-[15px] font-bold text-baan-navy hover:bg-baan-mist"
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-baan-orange px-5 text-[15px] font-bold text-white hover:brightness-90"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center rounded-full bg-baan-navy px-5 text-[15px] font-bold text-white hover:brightness-125"
        >
          My dashboard
        </Link>
        <UserButton />
      </Show>
    </>
  );
}
