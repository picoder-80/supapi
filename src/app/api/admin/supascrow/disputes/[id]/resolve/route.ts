import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(req.headers.get("authorization"));
  if (!auth.ok || !auth.userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!hasAdminPermission(auth.role, "admin.supascrow.write")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await params;
  return NextResponse.json(
    { success: false, error: "Admin dispute resolve endpoint has been disabled." },
    { status: 410 }
  );
}
