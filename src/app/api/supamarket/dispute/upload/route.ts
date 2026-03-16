import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

// POST — upload dispute evidence image
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const orderId = String(formData.get("order_id") ?? "").trim();

    if (!orderId) return NextResponse.json({ success: false, error: "order_id is required" }, { status: 400 });
    if (!file) return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!allowedTypes.has(String(file.type).toLowerCase())) {
      return NextResponse.json({ success: false, error: "Only JPEG, PNG, or WEBP image is allowed" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ success: false, error: "Max 8MB per image" }, { status: 400 });

    const supabase = await createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, status")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    if (order.buyer_id !== payload.userId && order.seller_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }
    if (order.status !== "delivered" && order.status !== "disputed") {
      return NextResponse.json({ success: false, error: "Order not eligible for dispute evidence upload" }, { status: 400 });
    }

    const safeExt = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `disputes/${payload.userId}/${orderId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("listings")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(path);
    return NextResponse.json({ success: true, data: { url: publicUrl, path } });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

