// GET/POST — find & reverse duplicate SupaNova reward credits (same session ref_id).
// GET or POST { execute: false } — list only. POST { execute: true } — apply fixes.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { reverseDuplicateArcadeRewardCredits, supabase } from "@/app/api/supanova/_shared";

async function requireAuth(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return { ok: false as const, res: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  if (!hasAdminPermission(auth.role, "admin.sc_wallet.read")) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

async function scanDuplicateGroups() {
  const { data: earnRows, error: qErr } = await supabase
    .from("credit_transactions")
    .select("user_id, ref_id")
    .eq("type", "earn")
    .eq("activity", "arcade_play_complete")
    .not("ref_id", "is", null);

  if (qErr) return { error: qErr.message as string, groups: [] as Array<{ userId: string; refId: string; n: number }> };

  const counts = new Map<string, { userId: string; refId: string; n: number }>();
  for (const row of earnRows ?? []) {
    const uid = String((row as { user_id?: string }).user_id ?? "");
    const ref = String((row as { ref_id?: string }).ref_id ?? "").trim();
    if (!uid || !ref) continue;
    const k = `${uid}::${ref}`;
    const prev = counts.get(k);
    counts.set(k, { userId: uid, refId: ref, n: (prev?.n ?? 0) + 1 });
  }

  const groups = [...counts.values()].filter((g) => g.n > 1);
  return { error: null as string | null, groups };
}

export async function GET(req: NextRequest) {
  const gate = await requireAuth(req);
  if (!gate.ok) return gate.res;

  try {
    const { error, groups } = await scanDuplicateGroups();
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });

    return NextResponse.json({
      success: true,
      data: {
        mode: "dry_run",
        duplicate_groups: groups.length,
        groups: groups.map((g) => ({ user_id: g.userId, ref_id: g.refId, earn_rows: g.n })),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAuth(req);
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));
  const execute = Boolean(body?.execute);

  try {
    const { error, groups } = await scanDuplicateGroups();
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });

    if (!execute) {
      return NextResponse.json({
        success: true,
        data: {
          mode: "dry_run",
          duplicate_groups: groups.length,
          groups: groups.map((g) => ({ user_id: g.userId, ref_id: g.refId, earn_rows: g.n })),
        },
      });
    }

    const results: Array<{
      user_id: string;
      ref_id: string;
      status: "fixed" | "skipped";
      detail?: string;
      excess?: number;
      duplicate_count?: number;
      new_balance?: number;
    }> = [];

    for (const g of groups) {
      const res = await reverseDuplicateArcadeRewardCredits({
        userId: g.userId,
        sessionRefId: g.refId,
      });
      if (res.ok) {
        results.push({
          user_id: g.userId,
          ref_id: g.refId,
          status: "fixed",
          excess: res.excess,
          duplicate_count: res.duplicateCount,
          new_balance: res.newBalance,
        });
      } else {
        results.push({
          user_id: g.userId,
          ref_id: g.refId,
          status: "skipped",
          detail: res.reason,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: "execute",
        duplicate_groups: groups.length,
        fixed: results.filter((r) => r.status === "fixed").length,
        results,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
