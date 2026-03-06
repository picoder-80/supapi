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
