-- =============================================================================
-- Phase 11: Add Breaking News Flag to public.news_items
-- =============================================================================
-- Paste and run this script manually in the Supabase Dashboard -> SQL Editor.
-- Existing table-level grants and RLS policies on public.news_items already
-- cover the new column, so no GRANT or policy changes are needed.

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN NOT NULL DEFAULT FALSE;
