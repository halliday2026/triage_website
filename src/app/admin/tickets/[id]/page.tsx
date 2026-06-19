import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { TicketActions } from "./actions";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting_on_user: "bg-yellow-100 text-yellow-800",
  resolved: "bg-gray-100 text-gray-800",
  closed: "bg-gray-200 text-gray-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-gray-100 text-gray-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const AUTHOR_COLORS: Record<string, string> = {
  reporter: "bg-blue-50 border-blue-200",
  agent: "bg-green-50 border-green-200",
  system: "bg-gray-50 border-gray-200",
};

interface PageProps {
  params: { id: string };
}

export default async function TicketDetailPage({ params }: PageProps) {
  const supabase = createServiceClient();

  const { data: ticket, error } = await supabase
    .from("ticket")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !ticket) notFound();

  const { data: comments } = await supabase
    .from("ticket_comment")
    .select("*")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true });

  const context = ticket.context as Record<string, unknown> | null;
  const contextEntries = context ? Object.entries(context) : [];

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/tickets"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          &larr; Back to tickets
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[ticket.status] ?? ""}`}
              >
                {ticket.status}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[ticket.severity] ?? ""}`}
              >
                {ticket.severity}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                {ticket.type}
              </span>
            </div>

            <h1 className="mb-2 text-lg font-semibold text-gray-900">
              {ticket.title || "Untitled ticket"}
            </h1>

            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {ticket.body}
            </p>
          </div>

          {/* Context */}
          {contextEntries.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">
                Context
              </h2>
              <dl className="space-y-1">
                {contextEntries.map(([key, value]) => (
                  <div key={key} className="flex text-sm">
                    <dt className="w-32 flex-shrink-0 font-medium text-gray-500">
                      {key}
                    </dt>
                    <dd className="text-gray-700">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Comments */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              Comments ({comments?.length ?? 0})
            </h2>
            <div className="space-y-3">
              {comments?.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded border p-3 ${AUTHOR_COLORS[comment.author_type] ?? ""}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      {comment.author_id ?? comment.author_type}
                      {comment.author_id ? ` · ${comment.author_type}` : ""}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">
                    {comment.body}
                  </p>
                </div>
              ))}
              {(!comments || comments.length === 0) && (
                <p className="text-sm text-gray-500">No comments yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">ID</dt>
                <dd className="font-mono text-xs text-gray-700">{ticket.id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Product</dt>
                <dd className="text-gray-700">
                  {ticket.client_id}/{ticket.product_id}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Reporter</dt>
                <dd className="text-gray-700">
                  {ticket.reporter_email || ticket.reporter_user_id}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Assignee</dt>
                <dd className="text-gray-700">{ticket.assignee ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-700">
                  {new Date(ticket.created_at).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Updated</dt>
                <dd className="text-gray-700">
                  {new Date(ticket.updated_at).toLocaleString()}
                </dd>
              </div>
              {ticket.resolved_at && (
                <div>
                  <dt className="text-gray-500">Resolved</dt>
                  <dd className="text-gray-700">
                    {new Date(ticket.resolved_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {ticket.closed_at && (
                <div>
                  <dt className="text-gray-500">Closed</dt>
                  <dd className="text-gray-700">
                    {new Date(ticket.closed_at).toLocaleString()}
                  </dd>
                </div>
              )}
              {ticket.parent_ticket_id && (
                <div>
                  <dt className="text-gray-500">Parent ticket</dt>
                  <dd>
                    <Link
                      href={`/admin/tickets/${ticket.parent_ticket_id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      {ticket.parent_ticket_id.slice(0, 8)}...
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          <TicketActions
            ticketId={ticket.id}
            currentStatus={ticket.status}
            currentSeverity={ticket.severity}
            currentAssignee={ticket.assignee}
          />
        </div>
      </div>
    </div>
  );
}
