# Triage — Requirements Spec

*BR-numbered requirements · namespace local to this repo · companion to `CLAUDE.md`*
*First consumer: Liaison.legal · Parent entity: Halliday*

Scope is split: **MVP** (ship to make Liaison's support real) vs **Future** (deferred until a second consumer or clear need). Schema, conventions, and out-of-scope guardrails live in `CLAUDE.md` — this spec covers behavior.

---

## Capture & ingestion — BR-0xx

**BR-001 — Embedded capture widget** *(MVP)*
A drop-in widget any consumer app mounts behind a "Support" link. Reporter enters a short title + message; the widget silently attaches context (route, app version, device, browser, recent client-side errors). It POSTs to the platform **ingest API** — never to the database — tagged with `client_id` + `product_id` and authenticated by the product's publishable ingest key.
*Accept:* a Liaison user can file a ticket without leaving the app; no ticketing-DB credential is present anywhere in the consumer client.

**BR-002 — Reporter identity** *(MVP)*
Capture the authenticated user when present (`reporter_user_id`); otherwise require `reporter_email`. Per-product `auth_only` config can force authenticated.
*Accept:* a logged-out user reporting a login failure can still file with an email; the `reporter_present` constraint holds.

**BR-004 — Ingest API & authentication** *(MVP)*
A single create-only endpoint that: validates the publishable ingest key against `product.ingest_key_hash`; stamps `client_id` + `product_id` server-side (never trusts the client); enforces the context allowlist (BR-104); rate-limits per key; then writes the ticket with the service role. Rejects unknown keys and unregistered tenants.
*Accept:* a forged or stale key is rejected; a valid key cannot read or write anything but a new ticket for its own product.

**BR-003 — Email-to-ticket** *(Future)*
Inbound address routed through **Resend inbound** → creates a ticket. Fallback channel, not primary. No custom parsing engine.

---

## Data & tenancy — BR-1xx

**BR-101 — Ticket model** *(MVP)*
Hybrid spine-plus-`JSONB` per `CLAUDE.md §4`. Anything queried/sorted/RLS-gated is a column; variable payload is `context`.

**BR-102 — Ticket comments** *(MVP)*
Threaded child table (`ticket_comment`), author-typed (reporter / agent / system). Appends only; ordered by `created_at`.

**BR-103 — Multi-tenancy + RLS** *(MVP)*
`client_id` + `product_id` on every row, NOT NULL, FK-bound to `product`, never in JSON. RLS: reporters read only their own tickets; support role reads within tenant scope; `product` is server/admin-only.
*Accept:* no query path returns a ticket across tenant boundaries; a reporter cannot see another reporter's ticket or any `product` row.

**BR-104 — Context allowlist** *(MVP)*
Enforced server-side at the ingest API, driven by `product.context_allowlist`. Any context key not on that product's list is dropped at the boundary. Liaison's list omits ledger/message/case keys entirely.
*Accept:* injecting arbitrary client state into the widget does not persist beyond the product's allowlist.

**BR-105 — Product registry** *(MVP)*
The `product` table defines valid tenants and holds, per product: the hashed ingest key, the `auth_only` flag, `retention_months`, and `context_allowlist`. Registering a product mints a publishable ingest key, shown once.
*Accept:* a ticket cannot be created for an unregistered `client_id` + `product_id`; rotating a key invalidates the old one.

---

## Lifecycle — BR-2xx

**BR-201 — Status transitions** *(MVP)*
`open → in_progress → waiting_on_user → resolved → closed`, enforced server-side.

**BR-202 — Resolved auto-close** *(MVP)*
Edge Function cron closes `resolved` tickets after 7 days with no reporter reply, keyed off `resolved_at`; sets `closed_at`.

**BR-203 — Reopen / linked ticket** *(MVP)*
Reporter reply to `resolved` → reopen to `open`. Reply to `closed` → new ticket with `parent_ticket_id` set.

**BR-204 — Severity & incident flag** *(MVP, lightweight)*
`low | normal | high | critical`. `critical` is the incident signal — surfaces in routing. A standalone incident system is **out of scope** (`CLAUDE.md §7`); Sentry is the machine-side feed.

---

## Notification & routing — BR-3xx

**BR-301 — New-ticket notification** *(MVP)*
On create, email via Resend to the support address for that tenant (single address day one).

**BR-302 — Severity surfacing** *(MVP)*
Severity in the email subject; `critical` visually distinct so incidents stand out in the inbox.

**BR-303 — Slack & digests** *(Future)*
Per-tenant Slack routing and daily digests. Deferred.

---

## Admin — BR-4xx

**BR-401 — Ticket list + detail** *(MVP)*
The one view actually used: filter by status/severity/product, open a ticket, read context + thread.

**BR-402 — Agent actions** *(MVP)*
Change status, assign, add an agent comment, set severity. All transitions logged.

**BR-403 — Cross-tenant dashboard** *(Future)*
"All tickets for Client A across their products" — unlocks when a second consumer exists.

---

## Retention & access — BR-5xx

**BR-501 — Retention & purge** *(MVP)*
Default 12-month retention, then purge (Edge Function cron). Per-product override via `product.retention_months`; Liaison stays at default.

**BR-502 — Access control** *(MVP)*
Support role scoped to its tenant; reporter scoped to own tickets (BR-103); ingest key create-only (BR-004). The platform never reaches into a consumer's database.

---

## Build order

1. **Data layer** — `product`, `ticket`, `ticket_comment`, indexes, constraints, RLS (BR-101/102/103/104-schema/105)
2. **Ingest** — ingest API + key validation + capture widget + reporter identity (BR-001/002/004; BR-104 enforcement)
3. **Lifecycle** — transitions + auto-close + reopen/linking (BR-201/202/203)
4. **Notification** — Resend new-ticket email + severity surfacing (BR-301/302)
5. **Admin** — ticket list/detail + agent actions (BR-401/402)
6. **Retention** — purge job (BR-501)

Everything marked *Future* stays unbuilt until logged into `CLAUDE.md §8`.
