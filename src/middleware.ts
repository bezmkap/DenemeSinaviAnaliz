import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

const PROTECTED = ["/panel", "/yonetim", "/yukle", "/sifre", "/il-analizi"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const needsAuth = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (needsAuth && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/giris";
    url.searchParams.set("sonraki", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/giris" && hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/panel",
    "/yonetim/:path*",
    "/yonetim",
    "/yukle/:path*",
    "/yukle",
    "/sifre",
    "/il-analizi/:path*",
    "/il-analizi",
    "/giris",
  ],
};
