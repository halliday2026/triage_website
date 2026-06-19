-- Migration: add_ticket_deleted_at
-- Adds soft-delete support for retention purge (BR-501).
-- NULL = active, non-NULL = soft-deleted.

alter table ticket add column deleted_at timestamptz;

create index ticket_active_idx on ticket (deleted_at) where deleted_at is null;
