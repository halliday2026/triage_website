import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: products, error: productsError } = await supabase
    .from("product")
    .select("client_id, product_id, retention_months");

  if (productsError || !products) {
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }

  const results: { client_id: string; product_id: string; purged: number }[] = [];

  for (const product of products) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - product.retention_months);

    const { data, error } = await supabase
      .from("ticket")
      .update({ deleted_at: new Date().toISOString() })
      .eq("client_id", product.client_id)
      .eq("product_id", product.product_id)
      .lt("created_at", cutoff.toISOString())
      .is("deleted_at", null)
      .select("id");

    if (!error && data) {
      results.push({
        client_id: product.client_id,
        product_id: product.product_id,
        purged: data.length,
      });
    }
  }

  const totalPurged = results.reduce((sum, r) => sum + r.purged, 0);

  return NextResponse.json({ total_purged: totalPurged, details: results });
}
