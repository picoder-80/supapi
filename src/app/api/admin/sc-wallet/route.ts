import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.sc_wallet.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const format = (searchParams.get("format") ?? "json").trim().toLowerCase();
  const scanLimit = Math.max(limit, 400);
  const type = (searchParams.get("type") ?? "").trim();
  const activity = (searchParams.get("activity") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const { data: walletRows, error: walletErr } = await supabase
    .from("supapi_credits")
    .select("user_id, balance, total_earned, total_spent");

  if (walletErr) {
    return NextResponse.json({ success: false, error: walletErr.message }, { status: 500 });
  }

  const totals = (walletRows ?? []).reduce(
    (acc, row: any) => {
      acc.total_balance += Number(row?.balance ?? 0);
      acc.total_earned += Number(row?.total_earned ?? 0);
      acc.total_spent += Number(row?.total_spent ?? 0);
      if (Number(row?.balance ?? 0) > 0) acc.active_wallets += 1;
      return acc;
    },
    { total_balance: 0, total_earned: 0, total_spent: 0, active_wallets: 0 }
  );

  const { data: typeRows } = await supabase
    .from("credit_transactions")
    .select("type, activity")
    .order("created_at", { ascending: false })
    .limit(1000);

  let txQuery = supabase
    .from("credit_transactions")
    .select("id, user_id, type, activity, amount, balance_after, note, created_at")
    .order("created_at", { ascending: false })
    .limit(scanLimit);

  if (type) txQuery = txQuery.eq("type", type);
  if (activity) txQuery = txQuery.eq("activity", activity);

  const { data: txRows, error: txErr } = await txQuery;
  if (txErr) return NextResponse.json({ success: false, error: txErr.message }, { status: 500 });

  const txList = txRows ?? [];
  const userIds = [...new Set(txList.map((t: any) => String(t.user_id)).filter(Boolean))];

  let usersMap: Record<string, { username?: string; display_name?: string | null }> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name")
      .in("id", userIds);
    usersMap = Object.fromEntries((users ?? []).map((u: any) => [String(u.id), u]));
  }

  const enriched = txList
    .map((tx: any) => ({
      ...tx,
      user: usersMap[String(tx.user_id)] ?? null,
    }))
    .filter((tx: any) => {
      if (!q) return true;
      const username = String(tx.user?.username ?? "").toLowerCase();
      const activity = String(tx.activity ?? "").toLowerCase();
      const note = String(tx.note ?? "").toLowerCase();
      const displayName = String(tx.user?.display_name ?? "").toLowerCase();
      return username.includes(q) || displayName.includes(q) || activity.includes(q) || note.includes(q);
    });

  const availableTypes = [...new Set((typeRows ?? []).map((tx: any) => String(tx.type ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const availableActivities = [...new Set((typeRows ?? []).map((tx: any) => String(tx.activity ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const totalFiltered = enriched.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const pagedRows = enriched.slice(start, start + limit);

  if (format === "csv") {
    const esc = (v: unknown) => {
      const raw = String(v ?? "");
      if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
        return `"${raw.replaceAll("\"", "\"\"")}"`;
      }
      return raw;
    };
    const lines = [
      [
        "id",
        "created_at",
        "user_id",
        "username",
        "display_name",
        "type",
        "activity",
        "amount",
        "balance_after",
        "note",
      ].join(","),
      ...enriched.map((tx: any) =>
        [
          esc(tx.id),
          esc(tx.created_at),
          esc(tx.user_id),
          esc(tx.user?.username ?? ""),
          esc(tx.user?.display_name ?? ""),
          esc(tx.type),
          esc(tx.activity),
          esc(tx.amount),
          esc(tx.balance_after),
          esc(tx.note ?? ""),
        ].join(",")
      ),
    ];
    const csv = lines.join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sc-wallet-transactions-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        total_balance: Number(totals.total_balance.toFixed(2)),
        total_earned: Number(totals.total_earned.toFixed(2)),
        total_spent: Number(totals.total_spent.toFixed(2)),
        active_wallets: totals.active_wallets,
        total_wallets: walletRows?.length ?? 0,
      },
      available_types: availableTypes,
      available_activities: availableActivities,
      pagination: {
        page: safePage,
        limit,
        total: totalFiltered,
        total_pages: totalPages,
      },
      recent_transactions: pagedRows,
    },
  });
}
