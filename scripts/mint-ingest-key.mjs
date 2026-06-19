#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";

const args = process.argv.slice(2);

function flag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const clientId = flag("client");
const productId = flag("product");
const displayName = flag("name");
const supportEmail = flag("support-email");

if (!clientId || !productId) {
  console.error(
    "Usage: node scripts/mint-ingest-key.mjs --client <client_id> --product <product_id> [--name <display_name>] [--support-email <email>]"
  );
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const plaintext = `triage_pk_${randomBytes(32).toString("hex")}`;
const keyHash = createHash("sha256").update(plaintext).digest("hex");

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { error } = await supabase.from("product").insert({
  client_id: clientId,
  product_id: productId,
  display_name: displayName || null,
  support_email: supportEmail || null,
  ingest_key_hash: keyHash,
});

if (error) {
  console.error("Failed to register product:", error.message);
  process.exit(1);
}

console.log(`Product registered: ${clientId}/${productId}`);
console.log(`Ingest key (save this — it will not be shown again):\n`);
console.log(`  ${plaintext}\n`);
