import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({ success: false }, { status: 401 });
  const payload = verifyToken(auth.slice(7));
  if (!payload) return NextResponse.json({ success: false }, { status: 401 });

  const supabase = await createAdminClient();

  // Increment view count
  await supabase.rpc("increment_listing_views", { listing_id: id }).catch(() => {});

  const { data, error } = await supabase
    .from("listings")
    .select("*, seller:seller_id(id, username, display_name, avatar_url, kyc_status, seller_verified)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true, data });
}