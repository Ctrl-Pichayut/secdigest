-- ==============================================================================
-- Phase 10 Migration: Generated Practice Cards (refill when running low)
-- ==============================================================================
-- The daily workflow (scripts/generate_practice_cards.py) writes new cards here
-- only when a language is running low on unseen cards. Every card is verified
-- by actually running its code before it is inserted. The app reads active
-- cards and appends them after the bundled starter bank.
--
-- Run once in the Supabase SQL editor (after phase 9). Safe to re-run.

CREATE TABLE IF NOT EXISTS public.practice_cards (
    id TEXT PRIMARY KEY,
    lang TEXT NOT NULL CHECK (lang IN ('python', 'c', 'js', 'java')),
    topic TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('output', 'bug', 'order', 'compare')),
    -- The full card object exactly as the app renders it (see lib/practice/types.ts).
    card JSONB NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Set to false to retire a bad card without deleting review history.
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_practice_cards_lang_created ON public.practice_cards (lang, created_at);

-- Enable Row-Level Security
ALTER TABLE public.practice_cards ENABLE ROW LEVEL SECURITY;

-- Explicit schema & table privilege grants for Supabase Data API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- The browser only reads cards; only the pipeline (service_role) writes them.
GRANT SELECT ON public.practice_cards TO anon, authenticated;
GRANT ALL ON public.practice_cards TO service_role;

-- RLS Policies
DROP POLICY IF EXISTS "Allow anon and authenticated to select active practice cards" ON public.practice_cards;
CREATE POLICY "Allow anon and authenticated to select active practice cards"
    ON public.practice_cards
    FOR SELECT
    TO anon, authenticated
    USING (active);
