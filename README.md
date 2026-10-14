# SecDigest: Personal CyberSec & Tech Intelligence PWA

A zero-cost, single-user daily intelligence digest web application tailored for Computer Science students and developers specializing in **Cybersecurity**, **Cloud Security**, **CTF Competitions**, and **AI / Developer Tools**.

Designed with a strict **Mobile-First** dark mode interface optimized for one-handed commute reading on smartphones.

---

## Architecture Overview

```
                   +-------------------------------+
                   |     Automated Ingestion       |
                   |   (GitHub Actions @ 06:30)    |
                   +---------------+---------------+
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
         v                         v                         v
+-----------------+       +-----------------+       +-----------------+
|  CISA KEV (CVE) |       | OpenRouter Free |       | Hacker News API |
|   Last 7 Days   |       |   Models (:free)|       |  Points > 50    |
+--------+--------+       +--------+--------+       +--------+--------+
         |                         |                         |
         +-------------------------+-------------------------+
                                   |
                                   v
                   +-------------------------------+
                   |       CTFtime Events          |
                   |      (Mondays & Fridays)      |
                   +---------------+---------------+
                                   |
                                   v
                   +-------------------------------+
                   |     Supabase Deduplication    |
                   |   (Filter seen source_ids)    |
                   +---------------+---------------+
                                   |
                                   v
                   +-------------------------------+
                   |        Gemini Flash           |
                   |   Curate top <= 5 items/day   |
                   |  Generate TLDR & Action Value |
                   +---------------+---------------+
                                   |
                                   v
                   +-------------------------------+
                   |     Supabase PostgreSQL       |
                   |     (public.news_items)       |
                   +---------------+---------------+
                                   |
                                   v
                   +-------------------------------+
                   |   Next.js 15 App Router PWA   |
                   |  (Vercel / Mobile Standalone) |
                   +-------------------------------+
```

---

## Features

- **High-Signal Data Sources**:
  - **CISA KEV Catalog**: Actively exploited vulnerabilities added within the last 7 days (`CVE_SECURITY`).
  - **OpenRouter API**: Newly added free developer models ending in `:free` (`AI_FREE`).
  - **Hacker News Algolia**: Stories with >50 points in the last 24h matching security, cloud, aws, cli, ide, or llm (`DEV_CLOUD`).
  - **CTFtime**: Upcoming CTF competitions with live countdowns (`CTF_COMPETITION`).
- **AI Intelligence Curation**:
  - Automatically filters noise, marketing hype, and trivial patches.
  - Generates sharp, 2-3 line technical `TLDR`s and 1-2 line `WHY IT MATTERS` takeaways (actionable portfolio ideas, free credits, or interview talking points).
- **Mobile-First Dark Interface**:
  - Built with Next.js App Router, TypeScript, and Tailwind CSS.
  - Sticky horizontal pill category navigation.
  - CTF start date countdown badges (`Starts in Xd`, `Live Now`).
  - One-tap thumb toggles for **Saved** (bookmarks) and **Mark Read** (dimming read cards) with optimistic UI updates.
- **Progressive Web App (PWA)**:
  - Native Next.js `app/manifest.ts` configuration.
  - Full-screen standalone mode without browser address bars when added to home screen on iOS and Android.
- **Zero-Cost Automation**:
  - GitHub Actions cron job triggers daily at 23:30 UTC (06:30 AM Bangkok time UTC+7).

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS) policies.
- **Backend / Pipeline**: Python 3.11+, Google GenAI SDK (`google-genai`), Pydantic v2, Supabase Python client.
- **Automation**: GitHub Actions (`daily_digest.yml`).

---

## Getting Started

### 1. Database Setup (Supabase)
Run the SQL script in [`supabase_schema.sql`](./supabase_schema.sql) in your **Supabase Dashboard > SQL Editor** to create `public.news_items`, enable Row-Level Security, and grant explicit API privileges.

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Run Ingestion Pipeline (Python)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt

# Run ingestion manually (forces CTF fetch on any day of the week)
python scripts/fetch_news.py --force-ctf
```

### 4. Run Frontend (Next.js)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your mobile browser or emulator.

---

## Deployment

### Automated Ingestion (GitHub Actions)
Add the following secrets to your GitHub repository (**Settings > Secrets and variables > Actions > Repository secrets**):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

### Frontend Hosting (Vercel)
Deploy the repository directly on [Vercel](https://vercel.com) and configure:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## License
MIT
