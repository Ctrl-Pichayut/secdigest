-- ==============================================================================
-- Phase 6 Migration: Instant Thai Translation & Technical Term Explainer
-- ==============================================================================

-- Add nullable columns to public.news_items for pre-computed Thai translations and tech terms glossary
ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS tldr_th text,
  ADD COLUMN IF NOT EXISTS actionable_value_th text,
  ADD COLUMN IF NOT EXISTS tech_terms_th jsonb DEFAULT '[]'::jsonb;
