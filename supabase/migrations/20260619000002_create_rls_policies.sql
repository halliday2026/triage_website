-- Migration: create_rls_policies
-- Enables RLS on all tables and creates access policies per BR-103.
--
-- Access model:
--   product        → server/admin-only (no policies; only service_role bypasses RLS)
--   ticket         → reporters read own; support reads within tenant
--   ticket_comment → reporters read own ticket's comments; support reads within tenant
--
-- All writes go through the ingest API / admin API using service_role,
-- which bypasses RLS. No INSERT/UPDATE/DELETE policies needed.
--
-- Support role identified via app_metadata custom claims:
--   triage_role      → 'support' | 'admin'
--   triage_client_id → scoped client_id

-- ============================================================
-- Enable RLS on all tables
-- ============================================================

alter table product        enable row level security;
alter table ticket         enable row level security;
alter table ticket_comment enable row level security;

-- ============================================================
-- product: no policies — server/admin-only
-- ============================================================
-- service_role bypasses RLS automatically.
-- No authenticated user should ever read product rows directly.

-- ============================================================
-- ticket policies
-- ============================================================

create policy "Reporters read own tickets"
  on ticket
  for select
  to authenticated
  using (reporter_user_id = auth.uid());

create policy "Support reads tenant tickets"
  on ticket
  for select
  to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'triage_role') in ('support', 'admin')
    and client_id = (auth.jwt() -> 'app_metadata' ->> 'triage_client_id')
  );

-- ============================================================
-- ticket_comment policies
-- ============================================================

create policy "Reporters read own ticket comments"
  on ticket_comment
  for select
  to authenticated
  using (
    exists (
      select 1 from ticket
      where ticket.id = ticket_comment.ticket_id
        and ticket.reporter_user_id = auth.uid()
    )
  );

create policy "Support reads tenant comments"
  on ticket_comment
  for select
  to authenticated
  using (
    exists (
      select 1 from ticket
      where ticket.id = ticket_comment.ticket_id
        and (auth.jwt() -> 'app_metadata' ->> 'triage_role') in ('support', 'admin')
        and ticket.client_id = (auth.jwt() -> 'app_metadata' ->> 'triage_client_id')
    )
  );
