// POST — tip podcaster (Pi payment)
// Body: { episode_id, amount_pi, message }

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ success: false }, { status: 401 });
  const payload = verifyToken(auth);
  if (!payload) return NextResponse.json({ success: false }, { status: 401 });

  const body = await req.json();
  const { episode_id, amount_pi, message } = body;
  if (!episode_id || !amount_pi || Number(amount_pi) <= 0) {
    return NextResponse.json({ success: false, error: "episode_id and amount_pi required" }, { status: 400 });
  }

  try {
    const supabase = await createAdminClient();
    const { data: ep } = await supabase
      .from("supapod_episodes")
      .select("id, supapod_id")
      .eq("id", episode_id)
      .eq("status", "published")
      .single();
    if (!ep) return NextResponse.json({ success: false, error: "Episode not found" }, { status: 404 });

    const { data: podcast } = await supabase.from("supapods").select("creator_id").eq("id", ep.supapod_id).single();
    if (!podcast) return NextResponse.json({ success: false, error: "Podcast not found" }, { status: 404 });
    if (podcast.creator_id === payload.userId) {
      return NextResponse.json({ success: false, error: "Cannot tip yourself" }, { status: 400 });
    }

    const { data: tip, error } = await supabase
      .from("supapod_tips")
      .insert({
        episode_id,
        from_user_id: payload.userId,
        amount_pi: Number(amount_pi),
        message: message?.trim() ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      data: {
        tip_id: tip.id,
        amount_pi: Number(amount_pi),
        creator_id: podcast.creator_id,
        message: "Use Pi SDK to complete payment. Tip record created.",
      },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
