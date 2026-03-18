import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/dashboard/brackets" || pathname === "/dashboard/brackets/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/brackets-under-construction";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/brackets/:path*", "/dashboard/leaderboard/:path*"],
};
