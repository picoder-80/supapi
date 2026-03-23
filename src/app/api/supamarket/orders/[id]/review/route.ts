// POST /api/supamarket/orders/[id]/review
// Buyer leaves rating for seller (via listing) after order completed

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

type Params = { params: Promise<{ id: string }> };

const MAX_REVIEW_IMAGES = 4;

/** Only accept URLs from our public listings bucket (review uploads). */
function sanitizeReviewImageUrls(raw: unknown): string[] {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const needle = "/storage/v1/object/public/listings/reviews/";
  if (!base) return [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const u of raw) {
    if (out.length >= MAX_REVIEW_IMAGES) break;
    if (typeof u !== "string") continue;
    const s = u.trim().slice(0, 2048);
    if (!/^https?:\/\//i.test(s)) continue;
    if (!s.startsWith(base) || !s.includes(needle)) continue;
    out.push(s);
  }
  return out;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: orderId } = await params;
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 500) : null;
    const images = sanitizeReviewImageUrls(body?.images);

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be 1–5" }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, buyer_id, seller_id, listing_id, status")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== payload.userId) {
      return NextResponse.json({ success: false, error: "Only the buyer can leave a review" }, { status: 403 });
    }

    if (order.status !== "completed") {
      return NextResponse.json({ success: false, error: "Can only review completed orders" }, { status: 400 });
    }

    const listingId = order.listing_id;
    if (!listingId) {
      return NextResponse.json({ success: false, error: "Order has no listing" }, { status: 400 });
    }

    // One review per buyer per listing (UNIQUE constraint)
    const { error: insertErr } = await supabase.from("reviews").upsert(
      {
        reviewer_id: payload.userId,
        target_id: listingId,
        target_type: "listing",
        rating: Math.round(rating),
        comment: comment || null,
        images: images.length ? images : [],
      },
      { onConflict: "reviewer_id,target_id,target_type" }
    );

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ success: false, error: "You have already reviewed this purchase" }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    // Reward SC once per order review submission
    const REVIEW_SC_REWARD = Math.max(0, Number(process.env.MARKET_REVIEW_SC_REWARD ?? "20"));
    let scRewarded = false;
    let scAmount = 0;
    let scBalance: number | null = null;

    if (REVIEW_SC_REWARD > 0) {
      const rewardActivity = "market_review";
      const rewardRefId = `market_order_review:${orderId}`;
      const { data: existingReward } = await supabase
        .from("credit_transactions")
        .select("id")
        .eq("user_id", payload.userId)
        .eq("activity", rewardActivity)
        .eq("ref_id", rewardRefId)
        .limit(1)
        .maybeSingle();

      if (!existingReward) {
        await supabase.from("supapi_credits").upsert(
          { user_id: payload.userId },
          { onConflict: "user_id", ignoreDuplicates: true }
        );
        const { data: wallet } = await supabase
          .from("supapi_credits")
          .select("balance, total_earned")
          .eq("user_id", payload.userId)
          .single();

        const nextBalance = Number(wallet?.balance ?? 0) + REVIEW_SC_REWARD;
        const nextEarned = Number(wallet?.total_earned ?? 0) + REVIEW_SC_REWARD;
        const { error: walletErr } = await supabase
          .from("supapi_credits")
          .update({
            balance: nextBalance,
            total_earned: nextEarned,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", payload.userId);

        if (!walletErr) {
          const { error: txErr } = await supabase.from("credit_transactions").insert({
            user_id: payload.userId,
            type: "earn",
            activity: rewardActivity,
            amount: REVIEW_SC_REWARD,
            balance_after: nextBalance,
            ref_id: rewardRefId,
            note: `SupaMarket review reward · order ${orderId.slice(0, 8)}`,
          });
          if (!txErr) {
            scRewarded = true;
            scAmount = REVIEW_SC_REWARD;
            scBalance = nextBalance;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sc_rewarded: scRewarded,
        sc_amount: scAmount,
        sc_balance: scBalance,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
