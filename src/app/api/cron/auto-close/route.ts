import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("ticket")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "resolved")
    .lt("resolved_at", sevenDaysAgo)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: "Failed to auto-close tickets" },
      { status: 500 }
    );
  }

  return NextResponse.json({ closed: data?.length ?? 0 });
}
