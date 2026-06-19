type Status = "open" | "in_progress" | "waiting_on_user" | "resolved" | "closed";

const TRANSITIONS: Record<Status, Status[]> = {
  open:             ["in_progress", "closed"],
  in_progress:      ["waiting_on_user", "resolved", "open"],
  waiting_on_user:  ["in_progress", "resolved", "open"],
  resolved:         ["open", "closed"],
  closed:           [],
};

export function canTransition(from: string, to: string): boolean {
  const allowed = TRANSITIONS[from as Status];
  if (!allowed) return false;
  return allowed.includes(to as Status);
}

export function allowedTransitions(from: string): string[] {
  return TRANSITIONS[from as Status] ?? [];
}

export function timestampsForTransition(to: string): Record<string, string | null> {
  const now = new Date().toISOString();

  switch (to) {
    case "resolved":
      return { resolved_at: now };
    case "closed":
      return { closed_at: now };
    case "open":
      return { resolved_at: null, closed_at: null };
    default:
      return {};
  }
}
