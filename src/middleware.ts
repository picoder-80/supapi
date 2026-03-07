// middleware.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    // Check cookie
    const token = req.cookies.get("supapi_admin_token")?.value
      // Also check Authorization header as fallback
      ?? req.headers.get("x-admin-token")
      ?? undefined;

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