import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next.js 16 renamed `middleware` to `proxy`. This is an optimistic auth gate:
// it only checks for the presence of the session cookie (no DB call, so it stays
// edge-friendly). Real validation happens server-side in the protected route via
// getSession().
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
