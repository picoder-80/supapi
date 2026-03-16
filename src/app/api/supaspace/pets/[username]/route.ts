import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const supabase = await createAdminClient();

    const { data: user } = await supabase.from("users").select("id").eq("username", username).single();
    if (!user) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const { data: pets, error } = await supabase
      .from("supapets_pets")
      .select("id, pet_key, pet_name, stage, level, xp, is_hatched, hatch_ready_at, hunger, happiness, health, energy, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: pets ?? [],
    });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
