import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

async function authenticate(request: NextRequest) {
  const supabase = createServiceClient();
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.slice(7));

  if (!user) return null;

  const role = user.app_metadata?.triage_role;
  if (role !== "support" && role !== "admin") return null;

  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("ticket")
    .select("*")
    .eq("id", params.id)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const userClientId = user.app_metadata?.triage_client_id;
  if (userClientId && ticket.client_id !== userClientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: comments } = await supabase
    .from("ticket_comment")
    .select("*")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ticket, comments: comments ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: ticket, error: fetchError } = await supabase
    .from("ticket")
    .select("id, client_id")
    .eq("id", params.id)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const userClientId = user.app_metadata?.triage_client_id;
  if (userClientId && ticket.client_id !== userClientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.assignee === "string") {
    updates.assignee = body.assignee || null;
  }

  if (
    typeof body.severity === "string" &&
    ["low", "normal", "high", "critical"].includes(body.severity)
  ) {
    updates.severity = body.severity;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("ticket")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }

  return NextResponse.json(updated);
}
