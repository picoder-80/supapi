// middleware.ts
// Protect /admin routes — redirect to login if no valid admin session

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin routes (except /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get("supapi_admin_token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
