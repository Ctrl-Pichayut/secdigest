-- ==============================================================================
-- Phase 9 Migration: Daily Coding Practice (spaced repetition)
-- ==============================================================================
-- Stores review history for the Practice tab so progress survives cleared
-- browser storage and syncs between devices. Card content itself is bundled
-- in the app (lib/practice/cards/*.json); only the learner's state lives here.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- One row per practice card the learner has seen.
CREATE TABLE IF NOT EXISTS public.practice_reviews (
    card_id TEXT PRIMARY KEY,
    lang TEXT NOT NULL CHECK (lang IN ('python', 'c', 'js', 'java')),
    -- Next due time, duplicated out of `fsrs` so it can be indexed and queried.
    due TIMESTAMPTZ NOT NULL,
    -- Full FSRS scheduler state (ts-fsrs Card, dates as ISO strings).
    fsrs JSONB NOT NULL,
    -- When the card was first shown; used to measure how fast new cards are consumed.
    introduced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_reviews_due ON public.practice_reviews (due);
CREATE INDEX IF NOT EXISTS idx_practice_reviews_lang_introduced ON public.practice_reviews (lang, introduced_at DESC);

-- One row per finished practice session (powers the weekly goal).
CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    minutes SMALLINT NOT NULL CHECK (minutes > 0),
    mode TEXT NOT NULL,
    reviewed SMALLINT NOT NULL DEFAULT 0,
    new_cards SMALLINT NOT NULL DEFAULT 0,
    correct SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_finished_at ON public.practice_sessions (finished_at DESC);

-- Enable Row-Level Security
ALTER TABLE public.practice_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

-- Explicit schema & table privilege grants for Supabase Data API
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.practice_reviews TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.practice_sessions TO anon, authenticated;
GRANT ALL ON public.practice_reviews TO service_role;
GRANT ALL ON public.practice_sessions TO service_role;

-- RLS Policies
-- Single-user app: the browser (anon key) reads and writes its own practice state,
-- following the same model as news_items bookmarks / read status. No DELETE grant.
DROP POLICY IF EXISTS "Allow anon and authenticated to select practice reviews" ON public.practice_reviews;
CREATE POLICY "Allow anon and authenticated to select practice reviews"
    ON public.practice_reviews
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to insert practice reviews" ON public.practice_reviews;
CREATE POLICY "Allow anon and authenticated to insert practice reviews"
    ON public.practice_reviews
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to update practice reviews" ON public.practice_reviews;
CREATE POLICY "Allow anon and authenticated to update practice reviews"
    ON public.practice_reviews
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to select practice sessions" ON public.practice_sessions;
CREATE POLICY "Allow anon and authenticated to select practice sessions"
    ON public.practice_sessions
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to insert practice sessions" ON public.practice_sessions;
CREATE POLICY "Allow anon and authenticated to insert practice sessions"
    ON public.practice_sessions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon and authenticated to update practice sessions" ON public.practice_sessions;
CREATE POLICY "Allow anon and authenticated to update practice sessions"
    ON public.practice_sessions
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
