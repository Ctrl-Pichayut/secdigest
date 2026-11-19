# SecDigest

Single-user daily cybersecurity and tech digest Progressive Web App (PWA). Built with Next.js 15 (App Router, React 19, TypeScript, Tailwind CSS), Supabase PostgreSQL, and Python ingestion scripts.

## Overview

- **Feed (`/`)**: Daily digest cards with category filters (`All`, `Free AI & Credits`, `CTF & Labs`, `Hot Bugs (KEV)`, `Dev & Cloud`, `Saved`), per-card English/Thai summary toggle with technical term glossary, bookmarks, read tracking, Paper/Dusk reading themes, and native PWA manifest (`app/manifest.ts`).
- **Practice (`/practice`)**: Spaced-repetition coding practice (see [Practice](#practice)).
- **Solved CTF**: interactive write-ups and labs (`/solved`).

## Architecture

```text
GitHub Actions daily cron (20:30 UTC / 03:30 UTC+7, .github/workflows/daily_digest.yml)
  -> scripts/fetch_news.py
     -> fetch 5 sources + deduplicate against public.seen_sources & public.news_items
     -> Gemini structured-output fallback chain (google-genai):
        gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.6-flash -> gemini-2.5-flash
     -> upsert into Supabase PostgreSQL (public.news_items, then public.seen_sources)
  -> scripts/generate_practice_cards.py (runs after news; continue-on-error)
     -> refill public.practice_cards only when an active language runs low
  -> Next.js App Router PWA on Vercel (reads via @supabase/supabase-js)
```

Gemini 3.x models use `thinking_level="low"`; the `gemini-2.5-flash` fallback omits `thinking_level` and pins `api_version="v1beta"`.

## Digest Sources and Breaking-News Rule

`scripts/fetch_news.py` collects candidates from five sources:

1. **CISA KEV**: Known Exploited Vulnerabilities added in the last 7 days (`CVE_SECURITY`).
2. **OpenRouter Free Models**: Models whose ID ends with `:free` (`AI_FREE`).
3. **Hacker News**: Top 30 stories by points from the Algolia API in the last 36 hours with more than 50 points (`CVE_SECURITY` or `DEV_CLOUD`).
4. **Official Status Pages**: Major/critical incidents from Anthropic, OpenAI, GitHub, and Cloudflare, plus high-severity incidents from Google Cloud, created in the last 36 hours (`DEV_CLOUD`).
5. **CTFtime**: Upcoming CTF events. Runs on Mondays and Fridays (UTC), or any day with `--force-ctf` (`CTF_COMPETITION`).

**Breaking-news rule**: Each run keeps up to 5 normal (`is_breaking=false`) items plus every breaking (`is_breaking=true`) item, capped at 8 items total (with breaking items ordered first, and at most 2 non-breaking `CVE_SECURITY` items per run). Breaking items are reserved for major global outages, actively exploited mass-impact vulnerabilities, or flagship launches from major AI vendors. In the feed, unread breaking items appear in a `Breaking` group at the top.

`public.seen_sources` is updated only after Gemini curation and the Supabase upsert succeed, so failed runs retry the same candidates on the next run.

## Practice

- **Active languages**: Python only, configured by `ACTIVE_LANGS` in `lib/practice/types.ts` (frontend) and `ACTIVE` in `scripts/generate_practice_cards.py` (refill pipeline). Bundled card banks for C, JavaScript, and Java also exist in `lib/practice/cards/` and can be re-enabled by adding them to both lists.
- **Scheduling (FSRS)**: Uses `ts-fsrs` (target retention `0.9`, max interval `365` days) with 2 / 5 / 15-minute sessions and a weekly session goal. Progress is stored local-first in `localStorage` and synced to `public.practice_reviews` and `public.practice_sessions`.
- **Starter bank and refill**: Combines bundled cards (`lib/practice/cards/*.json`) with generated cards from `public.practice_cards`. `scripts/generate_practice_cards.py` requests a new Gemini batch only when an active language has been practiced in the last 14 days and its unseen count drops below `max(FLOOR[lang], ceil(pace * 14))` (floor is 10 for Python), or when forced via `--force-lang` / the workflow `practice_refill` input (`PRACTICE_FORCE_LANG`).
- **Verifier**: `scripts/verify_practice_cards.py` validates card structure and executes code snippets in a temp directory with a scrubbed environment, timeout, and denylist (plus ASan/UBSan for C) to confirm deterministic output, a single valid order for `order` cards, and a working fix for `bug` cards. Generated cards that fail any check are discarded before storage.

## Environment Variables

Variable names from `.env.example`:

- `SUPABASE_URL` (Python scripts, GitHub Actions secret)
- `SUPABASE_SERVICE_ROLE_KEY` (Python scripts, GitHub Actions secret)
- `GEMINI_API_KEY` (Python scripts, GitHub Actions secret)
- `NEXT_PUBLIC_SUPABASE_URL` (Next.js frontend, Vercel)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Next.js frontend, Vercel)

Copy `.env.example` to `.env` for local development and fill in your values.

## Database Migrations (Supabase)

There is no automated migration runner. Paste and run the SQL files manually in **Supabase Dashboard -> SQL Editor** in this order:

1. `supabase_schema.sql` — creates `public.news_items` (including Thai columns) and `public.seen_sources`, indexes, RLS policies, and explicit Data API `GRANT`s.
2. `supabase_phase9_practice.sql` — creates `public.practice_reviews` and `public.practice_sessions`, indexes, RLS policies, and `GRANT`s.
3. `supabase_phase10_practice_cards.sql` — creates `public.practice_cards` for verified generated cards, RLS policy, and `GRANT`s.
4. `supabase_phase11_breaking.sql` — adds the `is_breaking` column to `public.news_items`.

## Local Commands

### Python setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

### Dry runs

```bash
# Fetch news candidates without calling Gemini or writing to Supabase
python scripts/fetch_news.py --dry-run
python scripts/fetch_news.py --dry-run --force-ctf

# Plan practice refills without calling Gemini or writing (add --offline to skip Supabase)
python scripts/generate_practice_cards.py --dry-run
python scripts/generate_practice_cards.py --offline --force-lang python
```

### Unit tests

```bash
python -m unittest discover -s scripts/tests -v
```

### Practice card verifier

```bash
# Runs bundled cards (requires python3, node, gcc, and java on PATH; missing toolchains are skipped unless --strict)
python scripts/verify_practice_cards.py
python scripts/verify_practice_cards.py --lang python --strict
```

### Frontend (Next.js)

```bash
npm install
npm run dev
```

`npm run build` requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to be set in the environment (or `.env`), because `lib/supabaseClient.ts` initializes the Supabase client at module load:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm run build
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request with read-only `contents` permissions, per-ref concurrency (`cancel-in-progress: true`), and no real repository secrets. It verifies:

- TypeScript types (`npx tsc --noEmit`) and the Next.js production build (`npm run build`) using dummy Supabase environment variables.
- Python ingestion unit tests (`python -m unittest discover -s scripts/tests -v`).
- Bundled Python practice cards (`python scripts/verify_practice_cards.py --lang python`).
- Playwright end-to-end smoke tests (`npm run e2e`) against the built app served on `http://localhost:3005` with mocked Supabase requests.

## License

MIT
