"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { allowedTransitions } from "@/lib/lifecycle";

interface TicketActionsProps {
  ticketId: string;
  currentStatus: string;
  currentSeverity: string;
  currentAssignee: string | null;
}

export function TicketActions({
  ticketId,
  currentStatus,
  currentSeverity,
  currentAssignee,
}: TicketActionsProps) {
  const router = useRouter();
  const [assignee, setAssignee] = useState(currentAssignee ?? "");
  const [severity, setSeverity] = useState(currentSeverity);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function getSession() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  }

  async function getAuthHeaders() {
    const session = await getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };
  }

  async function handleStatusChange(newStatus: string) {
    setLoading(`status-${newStatus}`);
    const headers = await getAuthHeaders();
    await fetch(`/api/tickets/${ticketId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: newStatus }),
    });
    setLoading(null);
    router.refresh();
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    setLoading("assignee");
    const headers = await getAuthHeaders();
    await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ assignee }),
    });
    setLoading(null);
    router.refresh();
  }

  async function handleSeverity(newSeverity: string) {
    setSeverity(newSeverity);
    setLoading("severity");
    const headers = await getAuthHeaders();
    await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ severity: newSeverity }),
    });
    setLoading(null);
    router.refresh();
  }

  async function handleComment(e: FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setLoading("comment");
    const session = await getSession();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    };
    await fetch(`/api/tickets/${ticketId}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        body: comment,
        author_type: "agent",
        author_id: session?.user?.email ?? null,
      }),
    });
    setComment("");
    setLoading(null);
    router.refresh();
  }

  const transitions = allowedTransitions(currentStatus);

  return (
    <div className="space-y-6">
      {/* Status transitions */}
      {transitions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Change status
          </h3>
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={loading !== null}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading === `status-${status}` ? "..." : status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assignee */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Assignee</h3>
        <form onSubmit={handleAssign} className="flex gap-2">
          <input
            type="text"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="Assign to..."
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "assignee" ? "..." : "Save"}
          </button>
        </form>
      </div>

      {/* Severity */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Severity</h3>
        <select
          value={severity}
          onChange={(e) => handleSeverity(e.target.value)}
          disabled={loading !== null}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Agent comment */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Add comment
        </h3>
        <form onSubmit={handleComment}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment..."
            rows={3}
            className="mb-2 w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading !== null || !comment.trim()}
            className="w-full rounded bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "comment" ? "Sending..." : "Comment"}
          </button>
        </form>
      </div>
    </div>
  );
}
