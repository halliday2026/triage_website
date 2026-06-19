import { createHash } from "crypto";

export function hashIngestKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
