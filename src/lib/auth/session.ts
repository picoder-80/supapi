// lib/auth/session.ts

import { cookies } from "next/headers";
import { verifyToken, type JwtPayload } from "./jwt";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types";

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("supapi_token")?.value;

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", payload.userId)
    .single();

  if (error || !user) return null;
  return user as User;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function getTokenFromRequest(request: Request): JwtPayload | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.substring(7));
  }

  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith("supapi_token="))
    ?.split("=")[1];

  if (cookie) return verifyToken(cookie);
  return null;
}
