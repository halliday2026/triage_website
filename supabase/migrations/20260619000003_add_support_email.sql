-- Migration: add_support_email
-- Adds a per-product support email address for new-ticket notifications (BR-301).

alter table product add column support_email text;
