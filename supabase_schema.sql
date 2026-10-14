-- Supabase Schema for Personal CyberSec & Tech Digest PWA

-- Create table public.news_items
CREATE TABLE IF NOT EXISTS public.news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('AI_FREE', 'CVE_SECURITY', 'CTF_COMPETITION', 'DEV_CLOUD')),
    title TEXT NOT NULL,
    tldr TEXT NOT NULL,
    actionable_value TEXT NOT NULL,
    url TEXT NOT NULL,
    event_start_date TIMESTAMPTZ,
    is_bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient chronological ordering and category filtering
CREATE INDEX IF NOT EXISTS idx_news_items_created_at ON public.news_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_category ON public.news_items (category);
CREATE INDEX IF NOT EXISTS idx_news_items_is_bookmarked ON public.news_items (is_bookmarked);

-- Enable Row-Level Security
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

-- Explicit schema & table privilege grants for Supabase Data API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, UPDATE ON public.news_items TO anon, authenticated;
GRANT ALL ON public.news_items TO service_role;

-- RLS Policies
-- Allow anon and authenticated users to select all news items
DROP POLICY IF EXISTS "Allow anon and authenticated to select news items" ON public.news_items;
CREATE POLICY "Allow anon and authenticated to select news items"
    ON public.news_items
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow anon and authenticated users to update items (for toggling is_bookmarked and is_read)
DROP POLICY IF EXISTS "Allow anon and authenticated to update news items" ON public.news_items;
CREATE POLICY "Allow anon and authenticated to update news items"
    ON public.news_items
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
