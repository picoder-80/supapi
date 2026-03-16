// lib/api.ts
// Consistent API response helpers

import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function ok<T>(data: T, message?: string): NextResponse {
  const body: ApiResponse<T> = { success: true, data, message };
  return NextResponse.json(body, { status: 200 });
}

export function created<T>(data: T, message?: string): NextResponse {
  const body: ApiResponse<T> = { success: true, data, message };
  return NextResponse.json(body, { status: 201 });
}

export function badRequest(error: string): NextResponse {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status: 400 });
}

export function unauthorized(error = "Unauthorized"): NextResponse {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status: 401 });
}

export function forbidden(error = "Access denied"): NextResponse {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status: 403 });
}

export function notFound(error = "Not found"): NextResponse {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status: 404 });
}

export function serverError(error = "Internal server error"): NextResponse {
  const body: ApiResponse = { success: false, error };
  return NextResponse.json(body, { status: 500 });
}

/** CORS headers for cross-origin requests (e.g. from Pi Sandbox iframe). */
export function corsHeaders(origin?: string | null): Record<string, string> {
  const allowOrigin =
    origin && /^https:\/\/(sandbox\.)?minepi\.com$/.test(origin)
      ? origin
      : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    // Include Authorization for Pi Sandbox cross-origin API calls.
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
  };
}

export function withCors<T>(res: NextResponse, origin?: string | null): NextResponse {
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
