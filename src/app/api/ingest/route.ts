import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hashIngestKey } from "@/lib/hash";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyNewTicket } from "@/lib/notify";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const ingestKey = body.ingest_key;
  if (typeof ingestKey !== "string" || !ingestKey) {
    return NextResponse.json(
      { error: "Missing ingest_key" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const ticketBody = body.body;
  if (typeof ticketBody !== "string" || !ticketBody) {
    return NextResponse.json(
      { error: "Missing body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const keyHash = hashIngestKey(ingestKey);
  const supabase = createServiceClient();

  const { data: product, error: productError } = await supabase
    .from("product")
    .select("client_id, product_id, auth_only, context_allowlist, support_email")
    .eq("ingest_key_hash", keyHash)
    .single();

  if (productError || !product) {
    return NextResponse.json(
      { error: "Invalid ingest key" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const { allowed, remaining } = checkRateLimit(keyHash);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": "60",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const reporterUserId =
    typeof body.reporter_user_id === "string" ? body.reporter_user_id : null;
  const reporterEmail =
    typeof body.reporter_email === "string" ? body.reporter_email : null;

  if (product.auth_only && !reporterUserId) {
    return NextResponse.json(
      { error: "This product requires authenticated reporters" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  if (!reporterUserId && !reporterEmail) {
    return NextResponse.json(
      { error: "Either reporter_user_id or reporter_email is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const allowlist: string[] = Array.isArray(product.context_allowlist)
    ? product.context_allowlist
    : [];
  const rawContext =
    typeof body.context === "object" && body.context !== null
      ? (body.context as Record<string, unknown>)
      : {};
  const filteredContext: Record<string, unknown> = {};
  for (const key of allowlist) {
    if (key in rawContext) {
      filteredContext[key] = rawContext[key];
    }
  }

  const title = typeof body.title === "string" ? body.title : null;
  const type =
    typeof body.type === "string" &&
    ["support", "bug", "incident"].includes(body.type)
      ? body.type
      : "support";
  const severity =
    typeof body.severity === "string" &&
    ["low", "normal", "high", "critical"].includes(body.severity)
      ? body.severity
      : "normal";

  const { data: ticket, error: insertError } = await supabase
    .from("ticket")
    .insert({
      client_id: product.client_id,
      product_id: product.product_id,
      type,
      severity,
      title,
      body: ticketBody,
      reporter_user_id: reporterUserId,
      reporter_email: reporterEmail,
      context: filteredContext,
    })
    .select("id, client_id, product_id")
    .single();

  if (insertError || !ticket) {
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  void notifyNewTicket(
    { ...ticket, title, body: ticketBody, type, severity, reporter_email: reporterEmail, reporter_user_id: reporterUserId },
    product
  );

  return NextResponse.json(ticket, {
    status: 201,
    headers: {
      ...CORS_HEADERS,
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}
