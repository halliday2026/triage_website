import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { TicketFilters } from "./filters";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting_on_user: "bg-yellow-100 text-yellow-800",
  resolved: "bg-gray-100 text-gray-800",
  closed: "bg-gray-200 text-gray-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "text-gray-500",
  normal: "text-gray-700",
  high: "text-orange-600",
  critical: "text-red-600 font-semibold",
};

interface PageProps {
  searchParams: { [key: string]: string | undefined };
}

export default async function TicketListPage({ searchParams }: PageProps) {
  const supabase = createServiceClient();

  const status = searchParams.status;
  const severity = searchParams.severity;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("ticket")
    .select("id, title, body, status, severity, type, reporter_email, reporter_user_id, assignee, client_id, product_id, created_at", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (severity) query = query.eq("severity", severity);

  const { data: tickets, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      <TicketFilters currentStatus={status} currentSeverity={severity} />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Ticket
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Severity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Reporter
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Assignee
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tickets?.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    className="block"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {ticket.title || ticket.body.slice(0, 80)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ticket.client_id}/{ticket.product_id}
                    </p>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ticket.status] ?? ""}`}
                  >
                    {ticket.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm ${SEVERITY_COLORS[ticket.severity] ?? ""}`}
                  >
                    {ticket.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {ticket.reporter_email || ticket.reporter_user_id?.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {ticket.assignee ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!tickets || tickets.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No tickets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/tickets?page=${page - 1}${status ? `&status=${status}` : ""}${severity ? `&severity=${severity}` : ""}`}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/tickets?page=${page + 1}${status ? `&status=${status}` : ""}${severity ? `&severity=${severity}` : ""}`}
              className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
