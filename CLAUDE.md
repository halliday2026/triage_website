# CLAUDE.md — Triage

> **Authoritative technical contract** for the cross-product support, ticketing, and incident platform. All Claude Code sessions in this repo inherit these standards without re-reading the full spec.
> **Companion:** `TRIAGE_SPEC.md` (BR-numbered requirements).
> **Parent entity:** Halliday · **First consumer:** Liaison.legal · **BR namespace:** local to this repo (do not confuse with Liaison's BR-1xx/2xx/3xx).

---

## 1. What this is

**Triage** is a lightweight, **multi-tenant** support and incident tool built to serve multiple businesses and products across the custom-app/website practice. Liaison.legal is its **first consumer** — it integrates via the embedded capture widget. This repo is **not** coupled to Liaison and must never depend on Liaison internals.

---

## 2. Non-negotiables (the thesis)

- **Thin layer, rented primitives.** Build only the connective tissue: data model, capture widget, ingest API, routing, admin views. Rent the commodity parts — email send/inbound (Resend), error monitoring (Sentry), storage (Supabase). *Build stays cheaper than buy only as long as we never rebuild what we'd buy* (see §7).
- **Multi-tenant schema from line one; single-tenant scope to start.** Every row carries `client_id` + `product_id`. Build Liaison's workflow first; do **not** build tenant admin, routing, or billing until a second product is live.
- **Ingest through the API, never the DB.** Consumer apps never hold ticketing-DB credentials. The widget submits to the platform **ingest API**, authenticated by a per-product **publishable ingest key** (Sentry-DSN model): create-only, hashed at rest, rate-limited. The API is the single boundary where tenancy is stamped and the context allowlist is enforced.
- **Hybrid storage.** Stable spine = real columns (anything queried, sorted, joined, RLS-gated, or job-driven). Variable, per-product payload = `JSONB`. **Never all-JSON.**
- **Whitelisted capture, data-driven.** The ingest API drops any context key not in that product's `context_allowlist`. Never persist arbitrary client state — consumers may hold sensitive data (Liaison's ledger is radioactive: custody/abuse/finance).
- **Sensitivity defaults strict, relaxable per consumer.** A ticket stores the reporter's message + allowlisted context. It must **not** store a consumer's protected content. For Liaison: no ledger/message/case content, ever.

---

## 3. Stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase** — Postgres, Auth, RLS, Edge Functions (cron), Storage
- **Resend** — transactional email + inbound parse
- **Sentry** — machine-side error feed (the incident input; not rebuilt in-house)
- **Hosting:** Render.com (mirrors Liaison)

---

## 4. Data model (canonical)

Singular table naming · snake_case · enums as Postgres types · RLS on every table.

```sql
-- enums
create type ticket_type     as enum ('support', 'bug', 'incident');
create type ticket_status   as enum ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed');
create type ticket_severity as enum ('low', 'normal', 'high', 'critical');
create type comment_author  as enum ('reporter', 'agent', 'system');

-- tenant/product registry: defines valid tenants, holds ingest keys + per-product config
create table product (
  client_id          text not null,                      -- tenancy key
  product_id         text not null,                      -- tenancy key
  display_name       text,
  ingest_key_hash    text not null,                      -- hashed publishable ingest key (create-only)
  auth_only          boolean not null default false,     -- BR-002: force authenticated reporters
  retention_months   int     not null default 12,        -- BR-501: per-consumer override
  context_allowlist  jsonb   not null default '[]',       -- BR-104: permitted context keys for this product
  created_at         timestamptz not null default now(),
  primary key (client_id, product_id)
);

create table ticket (
  id                uuid primary key default gen_random_uuid(),
  client_id         text not null,                       -- tenancy key (NOT NULL)
  product_id        text not null,                       -- tenancy key (NOT NULL)
  type              ticket_type     not null default 'support',
  status            ticket_status   not null default 'open',
  severity          ticket_severity not null default 'normal',
  title             text,
  body              text not null,                       -- reporter's typed message
  reporter_user_id  uuid,                                -- auth user, if present
  reporter_email    text,                                -- required if no user id
  context           jsonb not null default '{}',         -- allowlisted auto-captured payload
  assignee          text,
  parent_ticket_id  uuid references ticket(id),          -- reply-to-closed → linked ticket
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  closed_at         timestamptz,
  constraint reporter_present check (reporter_user_id is not null or reporter_email is not null),
  constraint ticket_product_fk foreign key (client_id, product_id)
    references product (client_id, product_id)
);

create table ticket_comment (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references ticket(id) on delete cascade,
  author_type comment_author not null,
  author_id   text,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- indexes
create index ticket_tenant_status_idx on ticket (client_id, product_id, status);
create index ticket_resolved_at_idx   on ticket (resolved_at) where resolved_at is not null;  -- auto-close job
create index ticket_context_gin_idx   on ticket using gin (context);
create index ticket_comment_ticket_idx on ticket_comment (ticket_id, created_at);
```

**Rules:**
- Tenancy keys (`client_id`, `product_id`) are **NOT NULL**, FK-bound to `product`, and never live in `context`.
- A ticket can only exist for a registered product (the composite FK enforces this).
- `ingest_key_hash` stores only a hash; the plaintext key is shown once at registration and validated server-side by the ingest API.
- `context` holds only keys listed in that product's `context_allowlist`. No protected content.
- Comments are a **child table**, never a JSON array on `ticket`.

---

## 5. Status lifecycle

```
open → in_progress → waiting_on_user → resolved → closed
```

- **resolved → closed:** auto-close after **7 days** with no reporter reply (Edge Function cron, keyed off `resolved_at`).
- **reporter reply to a resolved ticket:** reopen → `open` (the fix didn't hold).
- **reporter reply to a closed ticket:** create a **new linked ticket** with `parent_ticket_id` set (don't resurrect closed history).
- `severity = critical` is the lightweight **incident** signal — it surfaces in routing (spec BR-302) but does not spawn a separate incident system at MVP.

---

## 6. Conventions

- Singular tables; snake_case columns; Postgres enums for `type`/`status`/`severity`.
- RLS on every table; tenancy keys required and never nullable.
- `updated_at` maintained by trigger; `resolved_at`/`closed_at` nullable.
- Reporter may read **only their own** tickets; support role reads within its tenant scope; `product` is admin/server-side only (never reporter-readable).
- The ingest API runs with the service role to validate keys and write tickets; consumer clients never touch Postgres directly.
- Decisions get logged in §8 and are not re-litigated.

---

## 7. Out of scope — do not build (defer or rent)

Re-entry only by an explicit decision logged in §8.

- Knowledge base / help center
- SLA timers & escalation automation
- Live chat
- Slack integration & digests *(post-MVP)*
- Per-tenant admin consoles / client-facing portals
- An inbound email-parsing engine — use **Resend inbound**, don't build one

---

## 8. Decision log

| Decision | Resolution |
| --- | --- |
| Build vs. buy | **Build.** As a custom-app shop, reusable client-support infra is part of the service line, not overhead. Holds only under the thin-layer discipline (§2, §7). |
| Project boundary | **New repo, own CLAUDE.md.** Not folded into Liaison's contract. Liaison is the first *consumer*, not the host. |
| Tenancy key | `client_id` + `product_id`. Liaison = `client_id='halliday'`, `product_id='liaison'`. Registered in the `product` table. |
| Storage model | **Hybrid** — spine columns + `JSONB` context. Never all-JSON. Comments as a child table. |
| Ingest path | **Via API, never direct DB.** Consumer widgets POST to the ingest API; no ticketing-DB credentials ever ship in client code. The API stamps tenancy, enforces the allowlist, and rate-limits. |
| Ingest auth | Per-product **publishable ingest key** (Sentry-DSN model): create-only, hashed at rest, rate-limited. Leak risk is capped at spam, not data exposure. |
| Context whitelist | **Data-driven** via `product.context_allowlist`, enforced server-side at ingest. Liaison's list omits all ledger/message/case keys. |
| Status model | 5 states; resolved auto-closes after 7 days; reply-to-resolved reopens; reply-to-closed spawns a linked ticket. |
| Reporter identity | **Both** — auth user when present, anonymous-with-email fallback. Per-product `auth_only` flag can force authenticated. |
| Sensitivity | Ticket stores message + allowlisted context; never a consumer's protected content. 12-month retention then purge (per-product override). |
| Routing (MVP) | New-ticket email via Resend; severity in subject so incidents stand out. Slack/digests deferred. |
| Incident handling | Lightweight at MVP — a `critical` severity flag, fed by Sentry on the machine side. No standalone incident system yet. |
