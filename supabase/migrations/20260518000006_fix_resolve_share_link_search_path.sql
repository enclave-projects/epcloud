-- ============================================================================
-- EP Cloud :: 006 :: Fix resolve_share_link — qualify uuid_nil()
-- ============================================================================
-- Superseded by migration 007 below. Kept for migration-history continuity.
-- Migration 007 swaps the uuid_nil() approach for a NULL share_link_id on
-- not_found audit rows, which is cleaner and avoids extension lookups.

-- (no-op when 007 has been applied — this file documents the intermediate fix)
select 1;
