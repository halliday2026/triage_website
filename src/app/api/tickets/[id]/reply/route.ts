import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { timestampsForTransition } from "@/lib/lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const replyBody = body.body;
  if (typeof replyBody !== "string" || !replyBody.trim()) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  const authorType = body.author_type;
  if (
    typeof authorType !== "string" ||
    !["reporter", "agent", "system"].includes(authorType)
  ) {
    return NextResponse.json(
      { error: "author_type must be reporter, agent, or system" },
      { status: 400 }
    );
  }

  const authorId = typeof body.author_id === "string" ? body.author_id : null;

  const { data: ticket, error: fetchError } = await supabase
    .from("ticket")
    .select(
      "id, status, client_id, product_id, reporter_user_id, reporter_email"
    )
    .eq("id", params.id)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Reporter reply to a closed ticket → create a new linked ticket
  if (ticket.status === "closed" && authorType === "reporter") {
    const { data: newTicket, error: insertError } = await supabase
      .from("ticket")
      .insert({
        client_id: ticket.client_id,
        product_id: ticket.product_id,
        reporter_user_id: ticket.reporter_user_id,
        reporter_email: ticket.reporter_email,
        body: replyBody.trim(),
        parent_ticket_id: ticket.id,
      })
      .select("id, client_id, product_id, status, parent_ticket_id")
      .single();

    if (insertError || !newTicket) {
      return NextResponse.json(
        { error: "Failed to create linked ticket" },
        { status: 500 }
      );
    }

    await supabase.from("ticket_comment").insert({
      ticket_id: newTicket.id,
      author_type: "system",
      body: `Linked from closed ticket ${ticket.id}`,
    });

    return NextResponse.json(newTicket, { status: 201 });
  }

  // Reporter reply to a resolved ticket → reopen
  if (ticket.status === "resolved" && authorType === "reporter") {
    const timestamps = timestampsForTransition("open");
    const { error: updateError } = await supabase
      .from("ticket")
      .update({ status: "open", ...timestamps })
      .eq("id", ticket.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to reopen ticket" },
        { status: 500 }
      );
    }
  }

  // Add the comment
  const { data: comment, error: commentError } = await supabase
    .from("ticket_comment")
    .insert({
      ticket_id: ticket.id,
      author_type: authorType,
      author_id: authorId,
      body: replyBody.trim(),
    })
    .select()
    .single();

  if (commentError || !comment) {
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    );
  }

  return NextResponse.json(comment);
}
