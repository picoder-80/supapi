import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

type EmailRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: string | null;
  kyc_status: string | null;
  created_at: string | null;
};

function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.email_list.read")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const q = String(req.nextUrl.searchParams.get("q") ?? "").trim();
  const pageRaw = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
  const format = String(req.nextUrl.searchParams.get("format") ?? "").trim().toLowerCase();
  const includeUnverified = String(req.nextUrl.searchParams.get("include_unverified") ?? "false").trim() === "true";
  const includeAllRoles = String(req.nextUrl.searchParams.get("include_all_roles") ?? "false").trim() === "true";

  try {
    const supabase = await createAdminClient();
    let query = supabase
      .from("users")
      .select("id, username, display_name, email, role, kyc_status, created_at", { count: "exact" })
      .not("email", "is", null)
      .neq("email", "")
      .order("created_at", { ascending: false });

    if (!includeAllRoles) query = query.eq("role", "pioneer");
    if (!includeUnverified) query = query.eq("kyc_status", "verified");
    if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const rows = (data ?? []) as EmailRow[];

    if (format === "csv") {
      const header = ["id", "username", "display_name", "email", "role", "kyc_status", "created_at"];
      const body = rows
        .map((r) =>
          [
            csvEscape(r.id),
            csvEscape(r.username),
            csvEscape(r.display_name),
            csvEscape(r.email),
            csvEscape(r.role),
            csvEscape(r.kyc_status),
            csvEscape(r.created_at),
          ].join(","),
        )
        .join("\n");
      const csv = `${header.join(",")}\n${body}`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pioneer-email-broadcast-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rows,
        total: count ?? 0,
        page,
        limit,
        total_pages: Math.max(1, Math.ceil(Number(count ?? 0) / limit)),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message ?? "Server error" }, { status: 500 });
  }
}
