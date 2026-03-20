import { NextResponse } from "next/server";
import { supabase } from "../_shared";

export async function GET() {
  const { data, error } = await supabase
    .from("arcade_games")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}
