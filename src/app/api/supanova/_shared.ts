import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function getUserIdFromAuthHeader(authHeader?: string | null): string | null {
  try {
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId?: string;
      id?: string;
      sub?: string;
    };
    return String(decoded.userId ?? decoded.id ?? decoded.sub ?? "");
  } catch {
    return null;
  }
}

export async function ensureWallet(userId: string) {
  await supabase.from("supapi_credits").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}

export async function readWallet(userId: string) {
  const { data } = await supabase.from("supapi_credits").select("balance,total_earned,total_spent").eq("user_id", userId).single();
  return data ?? { balance: 0, total_earned: 0, total_spent: 0 };
}

export async function spendSC(userId: string, amount: number, activity: string, note: string) {
  await ensureWallet(userId);
  const wallet = await readWallet(userId);
  const current = Number(wallet.balance ?? 0);
  if (current < amount) return { ok: false as const, balance: current };
  const next = current - amount;
  await supabase.from("supapi_credits").update({
    balance: next,
    total_spent: Number(wallet.total_spent ?? 0) + amount,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "spend",
    activity,
    amount: -Math.abs(amount),
    balance_after: next,
    note,
  });
  return { ok: true as const, balance: next };
}

export async function creditSC(userId: string, amount: number, activity: string, note: string) {
  await ensureWallet(userId);
  const wallet = await readWallet(userId);
  const current = Number(wallet.balance ?? 0);
  const next = current + amount;
  await supabase.from("supapi_credits").update({
    balance: next,
    total_earned: Number(wallet.total_earned ?? 0) + amount,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "earn",
    activity,
    amount,
    balance_after: next,
    note,
  });
  return next;
}
