const WINDOW_MS = 60_000;
const MAX_REQUESTS = parseInt(
  process.env.INGEST_RATE_LIMIT_PER_MINUTE ?? "60",
  10
);

interface Window {
  count: number;
  start: number;
}

const windows = new Map<string, Window>();

export function checkRateLimit(keyHash: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const window = windows.get(keyHash);

  if (!window || now - window.start >= WINDOW_MS) {
    windows.set(keyHash, { count: 1, start: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  window.count++;

  if (window.count > MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: MAX_REQUESTS - window.count };
}
