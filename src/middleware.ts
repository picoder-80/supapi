// middleware.ts
// Admin auth is handled client-side via localStorage in AdminShell.tsx
// No server-side cookie checks needed

import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};