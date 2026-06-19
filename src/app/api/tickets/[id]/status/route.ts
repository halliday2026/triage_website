import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  canTransition,
  allowedTransitions,
  timestampsForTransition,
} from "@/lib/lifecycle";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = user.app_metadata?.triage_role;
  if (role !== "support" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const newStatus = body.status;
  if (typeof newStatus !== "string") {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  const { data: ticket, error: fetchError } = await supabase
    .from("ticket")
    .select("id, status, client_id")
    .eq("id", params.id)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const userClientId = user.app_metadata?.triage_client_id;
  if (userClientId && ticket.client_id !== userClientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canTransition(ticket.status, newStatus)) {
    return NextResponse.json(
      {
        error: `Cannot transition from '${ticket.status}' to '${newStatus}'`,
        allowed: allowedTransitions(ticket.status),
      },
      { status: 400 }
    );
  }

  const timestamps = timestampsForTransition(newStatus);
  const { data: updated, error: updateError } = await supabase
    .from("ticket")
    .update({ status: newStatus, ...timestamps })
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
