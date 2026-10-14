# Project Rules & Architecture: Personal CyberSec & Tech Digest PWA

You are building a zero-cost, single-user daily intelligence digest web application tailored for a 2nd-year Computer Science student specializing in Cybersecurity, Cloud Security, CTF competitions, and AI/Developer Tools.

## Tech Stack & Strict Constraints
1. **Language Requirement**: All UI components, labels, code comments, and LLM-generated news summaries (`tldr` and `actionable_value`) MUST be written in clear, concise, professional English.
2. **Database**: Use Supabase PostgreSQL with a primary table named `public.news_items`. You MUST include explicit Data API privilege grants (`GRANT` to `anon`, `authenticated`, and `service_role`) alongside Row-Level Security (RLS) policies, as Supabase requires explicit schema/table exposure.
3. **Ingestion Pipeline (`/scripts`)**: Use Python 3.11+ with `supabase`, `requests`, `pydantic`, `python-dotenv`, and the official `google-genai` SDK (strictly do NOT use the legacy `google-generativeai` package). Use the `gemini-3.8-flash` model configured with `thinking_config=types.ThinkingConfig(thinking_level="low")`. Strictly do NOT use deprecated Gemini 2.5 parameters (`temperature`, `top_p`, `top_k`, or `thinking_budget`) with `gemini-3.8-flash`.
4. **Frontend (Root or `/web`)**: Use Next.js (App Router, TypeScript, Tailwind CSS, `lucide-react`) and `@supabase/supabase-js`. Design a strict Mobile-First dark-mode interface optimized for one-handed reading during a morning train commute.
5. **PWA Configuration**: Use native Next.js App Router support via `app/manifest.ts` (`MetadataRoute.Manifest`). Do NOT install deprecated third-party wrappers like `next-pwa`.
6. **Verification Workflow**: After completing each phase, run terminal commands to verify there are no syntax, build, or runtime errors. For frontend tasks, launch your Browser Agent on `http://localhost:3000` to visually inspect the layout, test interactive states, and confirm zero console errors before finishing.
