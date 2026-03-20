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
  const { data, error } = await supabase
    .from("supapi_credits")
    .select("balance,total_earned,total_spent")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data ?? { balance: 0, total_earned: 0, total_spent: 0 };
}

export async function spendSC(userId: string, amount: number, activity: string, note: string) {
  await ensureWallet(userId);
  const wallet = await readWallet(userId);
  const current = Number(wallet.balance ?? 0);
  if (current < amount) return { ok: false as const, balance: current };
  const next = current - amount;
  const { error: walletErr } = await supabase.from("supapi_credits").update({
    balance: Math.trunc(next),
    total_spent: Math.trunc(Number(wallet.total_spent ?? 0) + amount),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (walletErr) throw new Error(walletErr.message);
  const { error: txnErr } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "spend",
    activity,
    amount: -Math.abs(Math.trunc(amount)),
    balance_after: Math.trunc(next),
    note,
  });
  if (txnErr) throw new Error(txnErr.message);
  return { ok: true as const, balance: next };
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  const c = String(err?.code ?? "");
  const m = String(err?.message ?? "").toLowerCase();
  return c === "23505" || m.includes("duplicate key") || m.includes("unique constraint");
}

export async function creditSC(
  userId: string,
  amount: number,
  activity: string,
  note: string,
  refId?: string
) {
  const ref = refId?.trim() ?? "";

  // Arcade session rewards: insert ledger row FIRST (DB unique index), then credit wallet.
  // Stops concurrent /complete races that double-credit the same session.
  if (ref && activity === "arcade_play_complete") {
    await ensureWallet(userId);
    const wallet = await readWallet(userId);
    const safeAmount = Math.max(0, Math.trunc(amount));
    const current = Number(wallet.balance ?? 0);
    const next = Math.trunc(current + safeAmount);

    const { data: inserted, error: insErr } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: userId,
        type: "earn",
        activity,
        amount: safeAmount,
        balance_after: next,
        ref_id: ref,
        note,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      if (isUniqueViolation(insErr)) {
        const { data: row } = await supabase
          .from("credit_transactions")
          .select("balance_after")
          .eq("user_id", userId)
          .eq("type", "earn")
          .eq("activity", activity)
          .eq("ref_id", ref)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        return Number(row?.balance_after ?? (await readWallet(userId)).balance ?? 0);
      }
      throw new Error(insErr.message);
    }

    const { error: walletErr } = await supabase.from("supapi_credits").update({
      balance: next,
      total_earned: Math.trunc(Number(wallet.total_earned ?? 0) + safeAmount),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    if (walletErr) {
      if (inserted?.id) {
        await supabase.from("credit_transactions").delete().eq("id", inserted.id);
      }
      throw new Error(walletErr.message);
    }
    return next;
  }

  if (ref) {
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id,balance_after")
      .eq("user_id", userId)
      .eq("type", "earn")
      .eq("activity", activity)
      .eq("ref_id", ref)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return Number(existing.balance_after ?? (await readWallet(userId)).balance ?? 0);
    }
  }

  await ensureWallet(userId);
  const wallet = await readWallet(userId);
  const safeAmount = Math.max(0, Math.trunc(amount));
  const current = Number(wallet.balance ?? 0);
  const next = current + safeAmount;
  const { error: walletErr } = await supabase.from("supapi_credits").update({
    balance: Math.trunc(next),
    total_earned: Math.trunc(Number(wallet.total_earned ?? 0) + safeAmount),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (walletErr) throw new Error(walletErr.message);
  const { error: txnErr } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "earn",
    activity,
    amount: safeAmount,
    balance_after: Math.trunc(next),
    ref_id: ref || null,
    note,
  });
  if (txnErr) throw new Error(txnErr.message);
  return next;
}

/**
 * Reverse excess SC credited multiple times for the same arcade session (ref_id).
 * Keeps the earliest earn row as canonical; deducts (sum - first) from balance + total_earned.
 * Adjusts arcade_leaderboard total_plays / total_sc_earned when session exists.
 */
export async function reverseDuplicateArcadeRewardCredits(params: {
  userId: string;
  sessionRefId: string;
}): Promise<{ ok: true; excess: number; duplicateCount: number; newBalance: number } | { ok: false; reason: string }> {
  const refId = params.sessionRefId.trim();
  if (!refId) return { ok: false, reason: "missing_ref" };

  const { data: rows, error: selErr } = await supabase
    .from("credit_transactions")
    .select("id, amount, created_at")
    .eq("user_id", params.userId)
    .eq("type", "earn")
    .eq("activity", "arcade_play_complete")
    .eq("ref_id", refId)
    .order("created_at", { ascending: true });

  if (selErr) return { ok: false, reason: selErr.message };
  const list = rows ?? [];
  if (list.length <= 1) return { ok: false, reason: "no_duplicates" };

  const amounts = list.map((r) => Math.trunc(Number(r.amount ?? 0)));
  const total = amounts.reduce((a, b) => a + b, 0);
  const first = amounts[0] ?? 0;
  const excess = Math.max(0, total - first);
  if (excess <= 0) return { ok: false, reason: "no_excess" };

  await ensureWallet(params.userId);
  const wallet = await readWallet(params.userId);
  const nextBal = Math.max(0, Math.trunc(Number(wallet.balance ?? 0) - excess));
  const nextEarned = Math.max(0, Math.trunc(Number(wallet.total_earned ?? 0) - excess));

  const { error: wErr } = await supabase.from("supapi_credits").update({
    balance: nextBal,
    total_earned: nextEarned,
    updated_at: new Date().toISOString(),
  }).eq("user_id", params.userId);
  if (wErr) return { ok: false, reason: wErr.message };

  const short = refId.slice(0, 8).toUpperCase();
  const { error: tErr } = await supabase.from("credit_transactions").insert({
    user_id: params.userId,
    type: "spend",
    activity: "arcade_duplicate_reversal",
    amount: -excess,
    balance_after: nextBal,
    note: `Duplicate arcade reward reversed (session #${short})`,
  });
  if (tErr) return { ok: false, reason: tErr.message };

  const duplicateCount = list.length;
  const decPlays = duplicateCount - 1;
  const { data: session } = await supabase.from("arcade_sessions").select("game_id").eq("id", refId).maybeSingle();
  if (session?.game_id) {
    const { data: board } = await supabase
      .from("arcade_leaderboard")
      .select("id, total_plays, total_sc_earned")
      .eq("game_id", session.game_id)
      .eq("user_id", params.userId)
      .maybeSingle();
    if (board?.id) {
      await supabase
        .from("arcade_leaderboard")
        .update({
          total_plays: Math.max(0, Number(board.total_plays ?? 0) - decPlays),
          total_sc_earned: Math.max(0, Number(board.total_sc_earned ?? 0) - excess),
          updated_at: new Date().toISOString(),
        })
        .eq("id", board.id);
    }
  }

  return { ok: true, excess, duplicateCount, newBalance: nextBal };
}
