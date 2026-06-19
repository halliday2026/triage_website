"use client";

import { useRouter } from "next/navigation";

const STATUSES = ["open", "in_progress", "waiting_on_user", "resolved", "closed"];
const SEVERITIES = ["low", "normal", "high", "critical"];

interface TicketFiltersProps {
  currentStatus?: string;
  currentSeverity?: string;
}

export function TicketFilters({
  currentStatus,
  currentSeverity,
}: TicketFiltersProps) {
  const router = useRouter();

  function applyFilters(status: string, severity: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    const qs = params.toString();
    router.push(`/admin/tickets${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="mb-4 flex gap-3">
      <select
        value={currentStatus ?? ""}
        onChange={(e) => applyFilters(e.target.value, currentSeverity ?? "")}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={currentSeverity ?? ""}
        onChange={(e) => applyFilters(currentStatus ?? "", e.target.value)}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
      >
        <option value="">All severities</option>
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
