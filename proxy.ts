import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Pages that hold a resident's own data. Signed-out visitors are sent to /sign-in.
const isPrivateRoute = createRouteMatcher(["/dashboard(.*)"]);
// Staff-only pages. Signed-in non-staff are sent to their own dashboard.
const isStaffRoute = createRouteMatcher(["/staff(.*)"]);
// Admin-only pages. Signed-in non-admins are sent to their own dashboard.
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPrivateRoute(req)) await auth.protect();
  if (isStaffRoute(req)) {
    const { sessionClaims } = await auth.protect();
    if (sessionClaims?.metadata?.role !== "staff") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth.protect();
    if (sessionClaims?.metadata?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
