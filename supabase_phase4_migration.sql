-- ==============================================================================
-- Phase 4 Migration: Security Hardening & Rejected-Item Deduplication
-- ==============================================================================

-- 1. Column-Level Update Restriction (Prevent Mass Assignment via anon key)
-- Revoke full table UPDATE and restrict anon/authenticated to only toggle bookmarks and read status.
REVOKE UPDATE ON public.news_items FROM anon, authenticated;
GRANT UPDATE (is_bookmarked, is_read) ON public.news_items TO anon, authenticated;

-- 2. Track All Seen Sources (public.seen_sources)
-- Stores all candidate source_ids fetched from upstream APIs to ensure low-value/rejected items
-- are never sent to Gemini repeatedly across daily runs.
CREATE TABLE IF NOT EXISTS public.seen_sources (
    source_id TEXT PRIMARY KEY,
    seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and grant service_role full management access
ALTER TABLE public.seen_sources ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.seen_sources TO service_role;

-- 3. Backfill existing source_ids from news_items
INSERT INTO public.seen_sources (source_id)
SELECT source_id FROM public.news_items
ON CONFLICT (source_id) DO NOTHING;
