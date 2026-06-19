-- Migration: create_schema
-- Creates enums, tables, indexes, constraints, and the updated_at trigger
-- for the Triage data model (CLAUDE.md §4, §6).

-- ============================================================
-- Enums
-- ============================================================

create type ticket_type     as enum ('support', 'bug', 'incident');
create type ticket_status   as enum ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed');
create type ticket_severity as enum ('low', 'normal', 'high', 'critical');
create type comment_author  as enum ('reporter', 'agent', 'system');

-- ============================================================
-- Tables
-- ============================================================

create table product (
  client_id          text        not null,
  product_id         text        not null,
  display_name       text,
  ingest_key_hash    text        not null,
  auth_only          boolean     not null default false,
  retention_months   int         not null default 12,
  context_allowlist  jsonb       not null default '[]',
  created_at         timestamptz not null default now(),
  primary key (client_id, product_id)
);

create table ticket (
  id                uuid            primary key default gen_random_uuid(),
  client_id         text            not null,
  product_id        text            not null,
  type              ticket_type     not null default 'support',
  status            ticket_status   not null default 'open',
  severity          ticket_severity not null default 'normal',
  title             text,
  body              text            not null,
  reporter_user_id  uuid,
  reporter_email    text,
  context           jsonb           not null default '{}',
  assignee          text,
  parent_ticket_id  uuid            references ticket(id),
  created_at        timestamptz     not null default now(),
  updated_at        timestamptz     not null default now(),
  resolved_at       timestamptz,
  closed_at         timestamptz,
  constraint reporter_present check (
    reporter_user_id is not null or reporter_email is not null
  ),
  constraint ticket_product_fk foreign key (client_id, product_id)
    references product (client_id, product_id)
);

create table ticket_comment (
  id          uuid           primary key default gen_random_uuid(),
  ticket_id   uuid           not null references ticket(id) on delete cascade,
  author_type comment_author not null,
  author_id   text,
  body        text           not null,
  created_at  timestamptz    not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index ticket_tenant_status_idx  on ticket (client_id, product_id, status);
create index ticket_resolved_at_idx    on ticket (resolved_at) where resolved_at is not null;
create index ticket_context_gin_idx    on ticket using gin (context);
create index ticket_comment_ticket_idx on ticket_comment (ticket_id, created_at);

-- ============================================================
-- updated_at trigger (CLAUDE.md §6)
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ticket_set_updated_at
  before update on ticket
  for each row
  execute function set_updated_at();
