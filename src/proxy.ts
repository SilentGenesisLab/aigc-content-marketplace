import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/register", "/api/auth", "/api/health", "/api/test"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !pathname.startsWith("/api/") && !pathname.startsWith("/_next")) {
    const canonical = new URL(appUrl);
    const requestHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (canonical.protocol === "https:" && requestHost && requestHost !== canonical.host) {
      return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, canonical), 308);
    }
  }

  if (publicPaths.some((path) => pathname.startsWith(path)) || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (!request.cookies.get("aigc_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
