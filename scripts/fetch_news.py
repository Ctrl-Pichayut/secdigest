#!/usr/bin/env python3
"""
Personal CyberSec & Tech Digest Ingestion Pipeline.

Fetches intelligence from 4 sources:
1. CISA Known Exploited Vulnerabilities (KEV) Catalog (last 7 days)
2. OpenRouter Models API (models ending with :free)
3. Hacker News Algolia API (>50 points, last 24h, matching security/cloud/dev keywords)
4. CTFtime API (upcoming events; runs Mondays and Fridays, or with --force-ctf)

Deduplicates against existing items in Supabase public.news_items, curates the top <=5 items
using Gemini (gemini-3.8-flash via google-genai SDK with Structured Outputs), and upserts them
into Supabase.
"""

import argparse
from datetime import datetime, timezone, timedelta
from enum import Enum
import json
import logging
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field
import requests
from supabase import Client, create_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("digest_pipeline")

# Load environment variables
load_dotenv()


class CategoryEnum(str, Enum):
    AI_FREE = "AI_FREE"
    CVE_SECURITY = "CVE_SECURITY"
    CTF_COMPETITION = "CTF_COMPETITION"
    DEV_CLOUD = "DEV_CLOUD"


class TechTerm(BaseModel):
    term: str = Field(
        description="English technical term appearing in this news item (e.g. 'RCE', 'Path Traversal', 'Zero-Day', 'Weights', 'MoE')."
    )
    meaning: str = Field(
        description="Simple, clear Thai explanation of what this technical term means for a 2nd-year CS student (1 concise line)."
    )


class CuratedNewsItem(BaseModel):
    source_id: str = Field(
        description="Exact unique source_id from input (e.g. cisa_CVE-..., openrouter_..., hn_..., ctftime_...)."
    )
    category: CategoryEnum = Field(
        description="Allowed category: AI_FREE, CVE_SECURITY, CTF_COMPETITION, or DEV_CLOUD."
    )
    title: str = Field(
        description="Sharp, professional technical title in English."
    )
    tldr: str = Field(
        description="2-3 lines concise English summary highlighting technical mechanics and impact."
    )
    actionable_value: str = Field(
        description="1-2 lines concrete takeaway for a 2nd-year CS student targeting Cybersecurity/Cloud Security."
    )
    url: str = Field(
        description="Exact source URL from input (never modify or hallucinate links)."
    )
    event_start_date: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp string for competition start date, or null if not applicable."
    )
    tldr_th: str = Field(
        description="2-3 lines natural, fluent Thai summary. Keep standard technical keywords intact (RCE, JWT, MoE, etc.) without awkward over-translation."
    )
    actionable_value_th: str = Field(
        description="1-2 lines concrete takeaway in natural Thai explaining how a 2nd-year CS student can benefit."
    )
    tech_terms_th: List[TechTerm] = Field(
        default_factory=list,
        description="List of 1 to 3 difficult or specialized technical terms from this news item, each with a simple Thai explanation."
    )


class CuratedDigestResponse(BaseModel):
    curated_items: List[CuratedNewsItem] = Field(
        description="List of at most 5 highest-impact items total for the day."
    )


# ---------------------------------------------------------------------------
# Source Fetchers
# ---------------------------------------------------------------------------

def fetch_cisa_kev() -> List[Dict[str, Any]]:
    """
    Fetch CISA Known Exploited Vulnerabilities added within the last 7 days.
    """
    url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    items: List[Dict[str, Any]] = []
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        vulnerabilities = data.get("vulnerabilities", [])

        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        for v in vulnerabilities:
            date_added = v.get("dateAdded", "")
            if date_added >= cutoff_date:
                cve_id = v.get("cveID", "").strip()
                if not cve_id:
                    continue
                vuln_name = v.get("vulnerabilityName", "").strip()
                vendor = v.get("vendorProject", "").strip()
                product = v.get("product", "").strip()
                short_desc = v.get("shortDescription", "").strip()
                req_action = v.get("requiredAction", "").strip()

                title = f"{cve_id}: {vuln_name or f'{vendor} {product} Exploit'}"
                summary = (
                    f"Vendor: {vendor} | Product: {product} | Added to KEV: {date_added}\n"
                    f"Summary: {short_desc}\n"
                    f"Required Action: {req_action}"
                )
                items.append({
                    "source_id": f"cisa_{cve_id}",
                    "category": "CVE_SECURITY",
                    "title": title,
                    "url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
                    "raw_context": summary,
                    "event_start_date": None,
                })
        logger.info(f"CISA KEV: Fetched {len(items)} vulnerabilities added in last 7 days.")
    except Exception as e:
        logger.error(f"Failed to fetch CISA KEV catalog: {e}")
    return items


def fetch_openrouter_free_models() -> List[Dict[str, Any]]:
    """
    Fetch OpenRouter models whose id ends with :free.
    """
    url = "https://openrouter.ai/api/v1/models"
    items: List[Dict[str, Any]] = []
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        models = data.get("data", [])

        for m in models:
            model_id = m.get("id", "")
            if model_id.endswith(":free"):
                name = m.get("name") or model_id
                desc = m.get("description") or ""
                ctx = m.get("context_length")
                architecture = m.get("architecture", {})
                modality = architecture.get("modality", "text")

                summary = (
                    f"Model: {name} ({model_id})\n"
                    f"Context Window: {ctx} tokens | Modality: {modality}\n"
                    f"Description: {desc[:400]}"
                )
                items.append({
                    "source_id": f"openrouter_{model_id}",
                    "category": "AI_FREE",
                    "title": f"Free Model: {name}",
                    "url": f"https://openrouter.ai/{model_id}",
                    "raw_context": summary,
                    "event_start_date": None,
                })
        logger.info(f"OpenRouter: Fetched {len(items)} free models.")
    except Exception as e:
        logger.error(f"Failed to fetch OpenRouter models: {e}")
    return items


def fetch_hacker_news() -> List[Dict[str, Any]]:
    """
    Fetch Hacker News stories from the last 24 hours with >50 points
    matching security, cloud, aws, cli, ide, or llm keywords.
    """
    url = "https://hn.algolia.com/api/v1/search_by_date"
    params = {
        "tags": "story",
        "numericFilters": "points>50",
        "hitsPerPage": 100,
    }
    items: List[Dict[str, Any]] = []
    # Match keywords security, cloud, aws, cli, ide, llm (with optional plural 's')
    keyword_regex = re.compile(r"\b(security|cloud|aws|cli|ide|llm)s?\b", re.IGNORECASE)

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        hits = data.get("hits", [])

        now_ts = datetime.now(timezone.utc).timestamp()
        cutoff_24h = now_ts - 86400

        for h in hits:
            created_ts = h.get("created_at_i", 0)
            if created_ts < cutoff_24h:
                continue

            title = h.get("title") or ""
            story_text = h.get("story_text") or ""
            search_corpus = f"{title} {story_text}"

            if not keyword_regex.search(search_corpus):
                continue

            obj_id = str(h.get("objectID", "")).strip()
            if not obj_id:
                continue

            story_url = h.get("url") or f"https://news.ycombinator.com/item?id={obj_id}"
            points = h.get("points", 0)
            comments = h.get("num_comments", 0)

            summary = (
                f"Title: {title}\n"
                f"Score: {points} points | {comments} comments\n"
                f"HN Thread: https://news.ycombinator.com/item?id={obj_id}\n"
                f"Excerpt: {story_text[:300]}"
            )

            # Heuristic category classification for candidate prompt
            if re.search(r"\b(security|cve|exploit|vulnerability|backdoor|malware)\b", search_corpus, re.IGNORECASE):
                cat = "CVE_SECURITY"
            elif re.search(r"\b(llm|gpt|ai|claude|gemini)\b", search_corpus, re.IGNORECASE):
                cat = "DEV_CLOUD"
            else:
                cat = "DEV_CLOUD"

            items.append({
                "source_id": f"hn_{obj_id}",
                "category": cat,
                "title": title,
                "url": story_url,
                "raw_context": summary,
                "event_start_date": None,
            })
        logger.info(f"Hacker News: Fetched {len(items)} relevant stories from last 24h.")
    except Exception as e:
        logger.error(f"Failed to fetch Hacker News: {e}")
    return items


def fetch_ctftime(force_ctf: bool = False) -> List[Dict[str, Any]]:
    """
    Fetch upcoming CTF events from CTFtime.
    Runs on Mondays and Fridays, or when force_ctf is True.
    """
    now = datetime.now(timezone.utc)
    weekday = now.weekday()  # Monday = 0, Friday = 4

    if not force_ctf and weekday not in (0, 4):
        logger.info("CTFtime: Skipping CTF fetch today (only runs Mon/Fri; use --force-ctf to override).")
        return []

    url = "https://ctftime.org/api/v1/events/?limit=20"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberSecDigestBot/1.0"
    }
    items: List[Dict[str, Any]] = []
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        events = resp.json()

        for ev in events:
            event_id = str(ev.get("id", "")).strip()
            if not event_id:
                continue

            title = ev.get("title", "").strip()
            start_date = ev.get("start")
            finish_date = ev.get("finish")
            ctf_url = ev.get("url") or ev.get("ctftime_url") or f"https://ctftime.org/event/{event_id}"
            format_type = ev.get("format", "Jeopardy")
            weight = ev.get("weight", 0.0)
            organizers = ", ".join([org.get("name", "") for org in ev.get("organizers", [])])

            summary = (
                f"CTF Event: {title}\n"
                f"Start Date: {start_date} | Finish Date: {finish_date}\n"
                f"Format: {format_type} | Weight: {weight}\n"
                f"Organizers: {organizers}\n"
                f"Description: {ev.get('description', '')[:300]}"
            )

            items.append({
                "source_id": f"ctftime_{event_id}",
                "category": "CTF_COMPETITION",
                "title": f"CTF: {title}",
                "url": ctf_url,
                "raw_context": summary,
                "event_start_date": start_date,
            })
        logger.info(f"CTFtime: Fetched {len(items)} upcoming CTF events.")
    except Exception as e:
        logger.error(f"Failed to fetch CTFtime events: {e}")
    return items


# ---------------------------------------------------------------------------
# Deduplication & Database Operations
# ---------------------------------------------------------------------------

def get_existing_source_ids(supabase_client: Client) -> Set[str]:
    """Query existing source_id values from public.seen_sources and public.news_items to prevent reprocessing."""
    existing: Set[str] = set()

    # 1. Query seen_sources table (tracks all fetched candidates including rejected items)
    try:
        resp = supabase_client.table("seen_sources").select("source_id").execute()
        for row in (resp.data or []):
            if "source_id" in row:
                existing.add(row["source_id"])
        logger.info(f"Retrieved {len(existing)} existing source_ids from public.seen_sources.")
    except Exception as e:
        logger.warning(f"Could not retrieve source_ids from public.seen_sources: {e}")

    # 2. Query news_items table as secondary safety
    try:
        resp = supabase_client.table("news_items").select("source_id").execute()
        news_count = 0
        for row in (resp.data or []):
            if "source_id" in row:
                existing.add(row["source_id"])
                news_count += 1
        logger.info(f"Retrieved {news_count} existing source_ids from public.news_items.")
    except Exception as e:
        logger.warning(f"Could not retrieve existing source_ids from public.news_items: {e}")

    logger.info(f"Total unique previously processed source_ids: {len(existing)}")
    return existing


def record_seen_sources(supabase_client: Client, source_ids: List[str]) -> None:
    """Upsert all candidate source_ids into public.seen_sources so rejected items never loop back."""
    if not source_ids:
        return
    try:
        unique_ids = list(set(source_ids))
        batch_size = 100
        total_upserted = 0
        for i in range(0, len(unique_ids), batch_size):
            chunk = unique_ids[i:i + batch_size]
            payload = [{"source_id": sid} for sid in chunk]
            supabase_client.table("seen_sources").upsert(payload, on_conflict="source_id").execute()
            total_upserted += len(chunk)
        logger.info(f"Recorded {total_upserted} candidate source_ids into public.seen_sources.")
    except Exception as e:
        logger.warning(f"Failed to record source_ids into public.seen_sources: {e}")


MODEL_FALLBACK_CHAIN = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
]


def generate_content_with_fallback(
    client: genai.Client,
    prompt: str,
    response_schema: Any,
) -> str:
    """
    Execute structured output generation iterating through MODEL_FALLBACK_CHAIN
    whenever an API call raises HTTP 429 (RESOURCE_EXHAUSTED/rate limit), HTTP 503 (UNAVAILABLE),
    or a transient server error.
    """
    last_error: Optional[Exception] = None
    for idx, model_name in enumerate(MODEL_FALLBACK_CHAIN):
        is_gemini_3 = model_name.startswith("gemini-3.")
        config_kwargs: Dict[str, Any] = {
            "response_mime_type": "application/json",
            "response_schema": response_schema,
        }
        if is_gemini_3:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="low")

        config = types.GenerateContentConfig(**config_kwargs)

        try:
            logger.info("Attempting LLM call with model '%s'...", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            raw_text = (response.text or "").strip()
            if idx > 0:
                logger.info(
                    "[LLM] Fallback succeeded! Completed request with '%s' (fallback #%d).",
                    model_name, idx
                )
            else:
                logger.info("[LLM] Primary '%s' succeeded.", model_name)
            return raw_text
        except errors.APIError as e:
            last_error = e
            err_msg = str(e).lower()
            is_transient = any(
                keyword in err_msg
                for keyword in [
                    "429", "resource_exhausted", "quota", "rate limit",
                    "503", "unavailable", "high demand", "overloaded", "server error"
                ]
            )
            if is_transient and idx < len(MODEL_FALLBACK_CHAIN) - 1:
                next_model = MODEL_FALLBACK_CHAIN[idx + 1]
                logger.warning(
                    "[LLM] Primary %s hit %s limit -> falling back to %s",
                    model_name,
                    "429 RPD" if ("429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg) else "503/transient",
                    next_model,
                )
                continue
            logger.error("[LLM] Unrecoverable error or fallback chain exhausted with '%s': %s", model_name, e)
            raise
        except Exception as e:
            last_error = e
            logger.error("[LLM] Unexpected error with model '%s': %s", model_name, e)
            if idx < len(MODEL_FALLBACK_CHAIN) - 1:
                next_model = MODEL_FALLBACK_CHAIN[idx + 1]
                logger.warning("[LLM] %s encountered error -> falling back to %s...", model_name, next_model)
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Model fallback chain failed without returning response.")


def curate_with_gemini(
    unseen_items: List[Dict[str, Any]],
    gemini_api_key: str
) -> List[CuratedNewsItem]:
    """
    Send unseen candidate items to Gemini structured outputs using MODEL_FALLBACK_CHAIN
    to select at most 5 highest-impact items.
    """
    if not unseen_items:
        return []

    client = genai.Client(api_key=gemini_api_key)

    prompt = f"""You are the intelligence curator for a personal daily CyberSec & Tech digest web application.
The target audience is a 2nd-year Computer Science student specializing in Cybersecurity, Cloud Security, CTFs, and AI/Developer Tools.

Below is a feed of raw candidate items fetched today from CISA KEV, OpenRouter (free models), Hacker News, and CTFtime.

YOUR OBJECTIVES:
1. Select at most 5 highest-impact items TOTAL for the day.
   - Prioritize actively exploited zero-days / critical vulnerabilities, genuinely useful free AI models/APIs, high-signal cloud/developer tools news, and major upcoming CTFs.
   - Filter out low-value items, minor library patches, marketing hype, and spam.
   - If only 1-3 items are genuinely high quality, return only those. Return at most 5 items total.

2. CATEGORY DIVERSITY & BALANCE:
   - Select AT MOST 2 'CVE_SECURITY' (CISA KEV) items per run. Do NOT allow CISA KEV catalog batch updates to crowd out other categories.
   - Ensure a balanced spread across available high-signal items in 'DEV_CLOUD', 'AI_FREE', and 'CTF_COMPETITION'.

3. CONSOLIDATE RELATED RELEASES (VENDOR & PRODUCT DEDUPLICATION):
   - If multiple CVEs affect the same vendor/product (e.g., multiple AhsayCBS or Ivanti CVEs released in the same catalog batch), pick ONLY the single most impactful entry and mention the related CVE IDs or variants inside its tldr rather than creating separate cards.
   - If a vendor releases multiple AI model variants simultaneously (e.g., multiple Poolside Laguna variants or multiple Google Gemma 4 sizes), select ONLY the single most relevant variant for developers, and mention the other variants/sizes concisely within its tldr.

4. For each selected item:
   - source_id: MUST PRESERVE the exact source_id from input without modification.
   - url: MUST PRESERVE the exact source url from input (never alter or fabricate links).
   - category: MUST be exactly one of: 'AI_FREE', 'CVE_SECURITY', 'CTF_COMPETITION', 'DEV_CLOUD'.
   - title: Sharp, professional title in English.
   - tldr: Exactly 2-3 lines of concise technical English summary explaining the vulnerability mechanics, tool capabilities, or infrastructure change (and citing related variants/CVEs if consolidated).
   - actionable_value: Exactly 1-2 lines in sharp, technical English providing a concrete takeaway for a 2nd-year CS student targeting Cybersecurity/Cloud Security (e.g. specific home lab to spin up, API credit to claim, CTF to join, or interview talking point).
   - event_start_date: For CTF competitions, preserve the ISO 8601 timestamp string from input; otherwise set to null.
   - tldr_th: Exactly 2-3 lines of natural, clear Thai summary explaining the same technical points. Keep standard English technical keywords intact (RCE, JWT, MoE, Path Traversal, WAF, etc.) without awkward or literal over-translation.
   - actionable_value_th: Exactly 1-2 lines in natural, clear Thai explaining concrete value for a student.
   - tech_terms_th: List of 1 to 3 difficult, specialized technical keywords from this news item (e.g. 'RCE', 'Zero-Day', 'Weights', 'Buffer Overflow'). Each object has 'term' (the English keyword) and 'meaning' (a simple 1-line explanation in clear Thai tailored for a 2nd-year CS student).

Candidate items:
{json.dumps(unseen_items, indent=2)}
"""

    logger.info("Sending %d candidate items to Gemini for curation (fallback chain enabled)...", len(unseen_items))
    raw_text = generate_content_with_fallback(client, prompt, CuratedDigestResponse)

    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)

    parsed = CuratedDigestResponse.model_validate_json(raw_text)
    curated = parsed.curated_items[:5]
    logger.info("Gemini selected %d high-impact items.", len(curated))
    return curated


def save_to_supabase(supabase_client: Client, curated_items: List[CuratedNewsItem]) -> int:
    """Save curated items into Supabase using upsert with on_conflict='source_id'."""
    if not curated_items:
        logger.info("No items to save to Supabase.")
        return 0

    payload = []
    for item in curated_items:
        category_str = item.category.value if hasattr(item.category, "value") else str(item.category)
        terms_payload = [
            t.model_dump() if hasattr(t, "model_dump") else dict(t)
            for t in item.tech_terms_th
        ] if item.tech_terms_th else []

        payload.append({
            "source_id": item.source_id,
            "category": category_str,
            "title": item.title,
            "tldr": item.tldr,
            "actionable_value": item.actionable_value,
            "url": item.url,
            "event_start_date": item.event_start_date,
            "tldr_th": item.tldr_th,
            "actionable_value_th": item.actionable_value_th,
            "tech_terms_th": terms_payload,
        })

    logger.info(f"Upserting {len(payload)} items into Supabase public.news_items...")
    resp = supabase_client.table("news_items").upsert(payload, on_conflict="source_id").execute()
    inserted_count = len(resp.data) if resp.data else len(payload)
    logger.info(f"Successfully upserted {inserted_count} rows into news_items.")
    return inserted_count


class BackfillItemTranslation(BaseModel):
    id: str = Field(description="Exact UUID id of the news item from input.")
    tldr_th: str = Field(description="2-3 lines natural, fluent Thai summary. Keep standard technical keywords intact (RCE, JWT, MoE, etc.).")
    actionable_value_th: str = Field(description="1-2 lines concrete takeaway in natural Thai.")
    tech_terms_th: List[TechTerm] = Field(description="List of 1 to 3 difficult/specialized technical terms from this news item, each with a 1-line explanation in simple Thai.")


class BackfillBatchResponse(BaseModel):
    items: List[BackfillItemTranslation] = Field(description="List of translated items.")


def backfill_thai_translations(supabase_client: Client, gemini_api_key: str) -> None:
    """Backfill tldr_th, actionable_value_th, and tech_terms_th for rows where tldr_th is null."""
    logger.info("=== Starting Thai Translation & Tech Glossary Backfill ===")
    resp = supabase_client.table("news_items").select("id, source_id, title, category, tldr, actionable_value, url").is_("tldr_th", "null").execute()
    rows = resp.data or []

    if not rows:
        logger.info("All existing news items already have Thai translations. Nothing to backfill!")
        return

    logger.info("Found %d news items missing Thai translations. Processing in batches...", len(rows))
    client = genai.Client(api_key=gemini_api_key)

    batch_size = 10
    total_updated = 0

    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        logger.info("Translating batch %d to %d (of %d)...", i + 1, min(i + batch_size, len(rows)), len(rows))

        prompt = f"""You are a bilingual technical translator specializing in Cybersecurity, Cloud Computing, and AI for Computer Science students.
Translate and explain the technical terms for the following news items into natural, easy-to-understand Thai for a 2nd-year CS student.

STRICT INSTRUCTIONS:
1. Keep standard English technical keywords intact inside the Thai text (do not awkwardly translate terms like RCE, JWT, MoE, Path Traversal, WAF, Zero-Day, Weights, etc. into literal Thai).
2. For each item:
   - id: MUST PRESERVE the exact UUID id from input.
   - tldr_th: 2-3 lines of natural, clear Thai summary explaining what happened and its technical mechanics.
   - actionable_value_th: 1-2 lines in natural, clear Thai explaining concrete value for a CS student (e.g., home lab to try, credit to claim, or interview talking point).
   - tech_terms_th: 1 to 3 difficult or specialized technical terms from this item, with a simple 1-line explanation in plain Thai for a 2nd-year CS student.

News items to translate:
{json.dumps(chunk, indent=2)}
"""
        raw_text = generate_content_with_fallback(client, prompt, BackfillBatchResponse)

        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        parsed = BackfillBatchResponse.model_validate_json(raw_text)

        for item in parsed.items:
            terms_payload = [
                t.model_dump() if hasattr(t, "model_dump") else dict(t)
                for t in item.tech_terms_th
            ]
            supabase_client.table("news_items").update({
                "tldr_th": item.tldr_th,
                "actionable_value_th": item.actionable_value_th,
                "tech_terms_th": terms_payload,
            }).eq("id", item.id).execute()
            total_updated += 1

    logger.info("=== Successfully backfilled Thai translations for %d news items ===", total_updated)


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="CyberSec & Tech Digest Ingestion Pipeline")
    parser.add_argument(
        "--force-ctf",
        action="store_true",
        help="Force fetching CTF events even if today is not Monday or Friday",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and display candidates from all sources without writing to Supabase or invoking Gemini",
    )
    parser.add_argument(
        "--backfill-th",
        action="store_true",
        help="Backfill Thai translations and technical glossaries for existing rows where tldr_th IS NULL",
    )
    args = parser.parse_args()

    # Retrieve environment variables
    raw_supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_url = raw_supabase_url.strip().rstrip("/") if raw_supabase_url else None
    if supabase_url and supabase_url.endswith("/rest/v1"):
        supabase_url = supabase_url[:-len("/rest/v1")].rstrip("/")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    )
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    if not args.dry_run:
        missing_vars = []
        if not supabase_url:
            missing_vars.append("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
        if not supabase_key:
            missing_vars.append("SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
        if not gemini_api_key:
            missing_vars.append("GEMINI_API_KEY")

        if missing_vars:
            logger.error(
                "Missing required environment variables in .env:\n  - "
                + "\n  - ".join(missing_vars)
                + "\nPlease update your .env file before running without --dry-run."
            )
            sys.exit(1)

    # Initialize Supabase client
    supabase_client: Client = create_client(supabase_url, supabase_key)

    # Check if backfill mode requested
    if args.backfill_th:
        backfill_thai_translations(supabase_client, gemini_api_key)
        return

    # 1. Fetch from all 4 sources
    logger.info("=== Starting Data Collection ===")
    candidates: List[Dict[str, Any]] = []
    candidates.extend(fetch_cisa_kev())
    candidates.extend(fetch_openrouter_free_models())
    candidates.extend(fetch_hacker_news())
    candidates.extend(fetch_ctftime(force_ctf=args.force_ctf))

    logger.info("=== Total Candidate Items Collected: %d ===", len(candidates))

    if args.dry_run:
        print("\n--- DRY RUN CANDIDATE SUMMARY ---")
        for i, item in enumerate(candidates, 1):
            print(f"[{i}] [{item['category']}] {item['title']}")
            print(f"    Source ID: {item['source_id']}")
            print(f"    URL: {item['url']}")
            if item.get("event_start_date"):
                print(f"    Event Start: {item['event_start_date']}")
        print(f"\nDry run complete. Found {len(candidates)} candidate items.")
        return

    # 2. Query deduplication state
    existing_ids = get_existing_source_ids(supabase_client)

    # 3. Filter unseen items
    unseen_items = [item for item in candidates if item["source_id"] not in existing_ids]
    logger.info(f"Unseen items requiring processing: {len(unseen_items)} (out of {len(candidates)} total)")

    # 4. Record all candidate source_ids into seen_sources so rejected items never loop back
    candidate_source_ids = [item["source_id"] for item in candidates if item.get("source_id")]
    record_seen_sources(supabase_client, candidate_source_ids)

    if not unseen_items:
        logger.info("No new unseen items to curate today. Database is already up to date.")
        return

    # 5. Curate and summarize via Gemini
    curated_items = curate_with_gemini(unseen_items, gemini_api_key=gemini_api_key)

    # 6. Save to Supabase
    save_to_supabase(supabase_client, curated_items)
    logger.info("=== Ingestion Pipeline Completed Successfully ===")


if __name__ == "__main__":
    main()
