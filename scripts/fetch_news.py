#!/usr/bin/env python3
"""
Personal CyberSec & Tech Digest Ingestion Pipeline.

Fetches intelligence from 6 sources:
1. CISA Known Exploited Vulnerabilities (KEV) Catalog (last 7 days)
2. OpenRouter Models API (models ending with :free)
3. Hacker News Algolia API (>50 points, last 36h, top 30 by points)
4. Official Status Pages (Anthropic, OpenAI, GitHub, Cloudflare, Google Cloud; major/critical/high in last 36h)
5. CTFtime API (upcoming events; runs Mondays and Fridays, or with --force-ctf)
6. Primary-Source RSS/Atom Feeds (10 vendor blogs, security news sites, and ThaiCERT; last 36h, <=5/feed, <=30 total)

Deduplicates against existing items in Supabase public.news_items, curates up to 5 normal
items plus breaking items (at most 8 total) using Gemini (via google-genai SDK with
Structured Outputs), and upserts them into Supabase.
"""

import argparse
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from enum import Enum
import hashlib
import html
import io
import json
import logging
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple
import xml.etree.ElementTree as ET

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
        description="Exact unique source_id from input (e.g. cisa_CVE-..., openrouter_..., hn_..., status_..., ctftime_..., rss_...)."
    )
    category: CategoryEnum = Field(
        description="Allowed category: AI_FREE, CVE_SECURITY, CTF_COMPETITION, or DEV_CLOUD."
    )
    is_breaking: bool = Field(
        description=(
            "True only for major global outages, actively exploited mass-impact vulnerabilities, "
            "or a flagship model/product launch from a major AI vendor."
        )
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
        description="List of at most 5 normal items plus every breaking item, capped at 8 items total for the day."
    )


# ---------------------------------------------------------------------------
# Run Report State & Source Fetchers
# ---------------------------------------------------------------------------

SOURCE_ORDER = (
    "cisa_kev",
    "openrouter",
    "hacker_news",
    "status_pages",
    "ctftime",
    "rss",
)

# Per-source error details recorded during the current run (source_name -> detail).
SOURCE_ERRORS: Dict[str, str] = {}

# Name of the Gemini model that answered the most recent successful fallback call.
LAST_GEMINI_MODEL: Optional[str] = None


def fetch_cisa_kev() -> List[Dict[str, Any]]:
    """
    Fetch CISA Known Exploited Vulnerabilities added within the last 7 days.
    """
    SOURCE_ERRORS.pop("cisa_kev", None)
    url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    items: List[Dict[str, Any]] = []
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        vulnerabilities = (data.get("vulnerabilities") or []) if isinstance(data, dict) else []

        cutoff_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
        for v in vulnerabilities:
            if not isinstance(v, dict):
                continue
            date_added = str(v.get("dateAdded") or "").strip()
            if date_added >= cutoff_date:
                cve_id = str(v.get("cveID") or "").strip()
                if not cve_id:
                    continue
                vuln_name = str(v.get("vulnerabilityName") or "").strip()
                vendor = str(v.get("vendorProject") or "").strip()
                product = str(v.get("product") or "").strip()
                short_desc = str(v.get("shortDescription") or "").strip()
                req_action = str(v.get("requiredAction") or "").strip()

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
        SOURCE_ERRORS["cisa_kev"] = str(e)
        logger.error(f"Failed to fetch CISA KEV catalog: {e}")
    return items


def fetch_openrouter_free_models() -> List[Dict[str, Any]]:
    """
    Fetch OpenRouter models whose id ends with :free.
    """
    SOURCE_ERRORS.pop("openrouter", None)
    url = "https://openrouter.ai/api/v1/models"
    items: List[Dict[str, Any]] = []
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        models = (data.get("data") or []) if isinstance(data, dict) else []

        for m in models:
            if not isinstance(m, dict):
                continue
            model_id = str(m.get("id") or "").strip()
            if not model_id or not model_id.endswith(":free"):
                continue
            name = str(m.get("name") or "").strip() or model_id
            desc = str(m.get("description") or "")
            ctx = m.get("context_length")
            architecture = m.get("architecture") or {}
            if not isinstance(architecture, dict):
                architecture = {}
            modality = architecture.get("modality") or "text"

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
        SOURCE_ERRORS["openrouter"] = str(e)
        logger.error(f"Failed to fetch OpenRouter models: {e}")
    return items


def fetch_hacker_news() -> List[Dict[str, Any]]:
    """
    Fetch top 30 Hacker News stories (sorted by points descending) from the
    last 36 hours with >50 points. Relevance is decided downstream by the LLM.
    """
    SOURCE_ERRORS.pop("hacker_news", None)
    cutoff_36h = int((datetime.now(timezone.utc) - timedelta(hours=36)).timestamp())
    url = "https://hn.algolia.com/api/v1/search_by_date"
    params = {
        "tags": "story",
        "numericFilters": f"points>50,created_at_i>{cutoff_36h}",
        "hitsPerPage": 500,
    }
    items: List[Dict[str, Any]] = []

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        hits = (data.get("hits") or []) if isinstance(data, dict) else []
        nb_hits = data.get("nbHits") if isinstance(data, dict) else None
        if isinstance(nb_hits, int) and nb_hits > len(hits):
            logger.warning(
                "Hacker News: Algolia returned %d of %d matching stories (truncated by hitsPerPage).",
                len(hits),
                nb_hits,
            )

        valid_hits = [
            h for h in hits
            if isinstance(h, dict) and str(h.get("objectID") or "").strip()
        ]
        top_hits = sorted(
            valid_hits,
            key=lambda h: h.get("points") or 0,
            reverse=True,
        )[:30]

        for h in top_hits:
            obj_id = str(h.get("objectID") or "").strip()
            if not obj_id:
                continue
            title = str(h.get("title") or "")
            story_text = str(h.get("story_text") or "")
            search_corpus = f"{title} {story_text}"

            story_url = str(h.get("url") or "").strip() or f"https://news.ycombinator.com/item?id={obj_id}"
            points = h.get("points") or 0
            comments = h.get("num_comments") or 0

            summary = (
                f"Title: {title}\n"
                f"Score: {points} points | {comments} comments\n"
                f"HN Thread: https://news.ycombinator.com/item?id={obj_id}\n"
                f"Excerpt: {story_text[:300]}"
            )

            # Heuristic category classification for candidate prompt (restricted to DB CHECK enum)
            if re.search(
                r"\b(security|cve|cve-\d+|exploit|vulnerability|backdoor|malware|rce|zero-day|0-day|ransomware|breach|hacked|leak)\b",
                search_corpus,
                re.IGNORECASE,
            ):
                cat = "CVE_SECURITY"
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
        logger.info(f"Hacker News: Fetched {len(items)} top stories from last 36h.")
    except Exception as e:
        SOURCE_ERRORS["hacker_news"] = str(e)
        logger.error(f"Failed to fetch Hacker News: {e}")
    return items


def _parse_iso_utc(ts: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 timestamp string into a timezone-aware UTC datetime."""
    if not ts or not isinstance(ts, str):
        return None
    try:
        dt = datetime.fromisoformat(ts.strip())
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def fetch_status_incidents() -> List[Dict[str, Any]]:
    """
    Fetch major/critical/high-severity incidents created in the last 36 hours
    from official public status pages (Anthropic, OpenAI, GitHub, Cloudflare, Google Cloud).
    """
    SOURCE_ERRORS.pop("status_pages", None)
    cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=36)
    items: List[Dict[str, Any]] = []
    provider_errors: List[str] = []

    statuspage_providers = [
        ("anthropic", "Anthropic", "https://status.claude.com"),
        ("openai", "OpenAI", "https://status.openai.com"),
        ("github", "GitHub", "https://www.githubstatus.com"),
        ("cloudflare", "Cloudflare", "https://www.cloudflarestatus.com"),
    ]

    for slug, provider_name, base_url in statuspage_providers:
        endpoint = f"{base_url}/api/v2/incidents.json"
        try:
            resp = requests.get(endpoint, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            incidents = data.get("incidents", []) if isinstance(data, dict) else []

            for inc in incidents:
                if not isinstance(inc, dict):
                    continue
                inc_id = str(inc.get("id") or "").strip()
                if not inc_id:
                    continue

                impact = (inc.get("impact") or "").strip().lower()
                if impact not in ("major", "critical"):
                    continue

                created_at = inc.get("created_at")
                created_dt = _parse_iso_utc(created_at)
                if created_dt is None or created_dt < cutoff_dt:
                    continue

                name = " ".join((inc.get("name") or "Major incident").split())
                status = (inc.get("status") or "unknown").strip()
                resolved_at = inc.get("resolved_at") or "ongoing"
                shortlink = (inc.get("shortlink") or "").strip() or f"{base_url}/incidents/{inc_id}"

                components = inc.get("components") or []
                component_names = ", ".join(
                    c.get("name", "").strip()
                    for c in components
                    if isinstance(c, dict) and c.get("name")
                ) or "N/A"

                updates = inc.get("incident_updates") or []
                latest_body = ""
                if updates and isinstance(updates[0], dict):
                    latest_body = (updates[0].get("body") or "").strip()

                raw_context = (
                    f"Provider: {provider_name} | Impact: {impact} | Status: {status}\n"
                    f"Created: {created_at} | Resolved: {resolved_at}\n"
                    f"Affected Components: {component_names}\n"
                    f"Latest Update: {latest_body[:400]}"
                )

                items.append({
                    "source_id": f"status_{slug}_{inc_id}",
                    "category": "DEV_CLOUD",
                    "title": f"{provider_name} status: {name}",
                    "url": shortlink,
                    "raw_context": raw_context,
                    "event_start_date": None,
                })
        except Exception as e:
            provider_errors.append(f"{provider_name}: {e}")
            logger.error(f"Failed to fetch status incidents for {provider_name}: {e}")

    # Google Cloud status page (JSON list format)
    gcp_url = "https://status.cloud.google.com/incidents.json"
    try:
        resp = requests.get(gcp_url, timeout=15)
        resp.raise_for_status()
        gcp_incidents = resp.json()
        if not isinstance(gcp_incidents, list):
            raise ValueError(f"Expected JSON list, got {type(gcp_incidents).__name__}")

        for inc in gcp_incidents:
            if not isinstance(inc, dict):
                continue
            inc_id = str(inc.get("id") or "").strip()
            if not inc_id:
                continue

            severity = (inc.get("severity") or "").strip().lower()
            if severity != "high":
                continue

            created_str = inc.get("created") or inc.get("begin")
            created_dt = _parse_iso_utc(created_str)
            if created_dt is None or created_dt < cutoff_dt:
                continue

            external_desc = " ".join(
                (inc.get("external_desc") or inc.get("service_name") or "High-severity incident").split()
            )
            status_impact = (inc.get("status_impact") or "unknown").strip()
            begin_str = inc.get("begin") or created_str or "unknown"
            end_str = inc.get("end") or "ongoing"

            affected_products = inc.get("affected_products") or []
            product_titles = [
                p.get("title", "").strip()
                for p in affected_products
                if isinstance(p, dict) and p.get("title")
            ]
            service_name = (inc.get("service_name") or "").strip()
            if not product_titles and service_name:
                product_titles = [service_name]
            affected_str = ", ".join(product_titles) or "N/A"

            most_recent = inc.get("most_recent_update")
            latest_text = (
                (most_recent.get("text") or "").strip()
                if isinstance(most_recent, dict)
                else ""
            )

            uri = (inc.get("uri") or "").strip()
            if uri.startswith(("http://", "https://")):
                inc_url = uri
            elif uri:
                inc_url = f"https://status.cloud.google.com/{uri.lstrip('/')}"
            else:
                inc_url = f"https://status.cloud.google.com/incidents/{inc_id}"

            raw_context = (
                f"Provider: Google Cloud | Severity: {severity} | Status: {status_impact}\n"
                f"Created: {created_str} | Begin: {begin_str} | End: {end_str}\n"
                f"Affected Components: {affected_str}\n"
                f"Latest Update: {latest_text[:400]}"
            )

            items.append({
                "source_id": f"status_google_cloud_{inc_id}",
                "category": "DEV_CLOUD",
                "title": f"Google Cloud status: {external_desc}",
                "url": inc_url,
                "raw_context": raw_context,
                "event_start_date": None,
            })
    except Exception as e:
        provider_errors.append(f"Google Cloud: {e}")
        logger.error(f"Failed to fetch status incidents for Google Cloud: {e}")

    if provider_errors:
        SOURCE_ERRORS["status_pages"] = "; ".join(provider_errors)

    logger.info(f"Status Pages: Fetched {len(items)} major/critical/high incidents from last 36h.")
    return items


def fetch_ctftime(force_ctf: bool = False) -> List[Dict[str, Any]]:
    """
    Fetch upcoming CTF events from CTFtime.
    Runs on Mondays and Fridays, or when force_ctf is True.
    """
    SOURCE_ERRORS.pop("ctftime", None)
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
        raw_events = resp.json()
        events = raw_events if isinstance(raw_events, list) else []

        for ev in events:
            if not isinstance(ev, dict):
                continue
            event_id = str(ev.get("id") or "").strip()
            if not event_id:
                continue

            title = str(ev.get("title") or "").strip()
            start_date = ev.get("start")
            finish_date = ev.get("finish")
            ctf_url = (
                str(ev.get("url") or "").strip()
                or str(ev.get("ctftime_url") or "").strip()
                or f"https://ctftime.org/event/{event_id}"
            )
            format_type = ev.get("format") or "Jeopardy"
            weight = ev.get("weight") if ev.get("weight") is not None else 0.0
            organizers_raw = ev.get("organizers") or []
            if not isinstance(organizers_raw, list):
                organizers_raw = []
            organizers = ", ".join(
                str(org.get("name") or "").strip()
                for org in organizers_raw
                if isinstance(org, dict) and str(org.get("name") or "").strip()
            )
            description = str(ev.get("description") or "")

            summary = (
                f"CTF Event: {title}\n"
                f"Start Date: {start_date} | Finish Date: {finish_date}\n"
                f"Format: {format_type} | Weight: {weight}\n"
                f"Organizers: {organizers}\n"
                f"Description: {description[:300]}"
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
        SOURCE_ERRORS["ctftime"] = str(e)
        logger.error(f"Failed to fetch CTFtime events: {e}")
    return items


RSS_USER_AGENT = "SecDigestBot/1.0 (+https://secdigest.vercel.app)"
RSS_MAX_BYTES = 5 * 1024 * 1024  # 5 MB response cap
RSS_PER_FEED_CAP = 5
RSS_TOTAL_CAP = 30

RSS_FEEDS: List[Dict[str, str]] = [
    {
        "slug": "openai",
        "name": "OpenAI News",
        "url": "https://openai.com/news/rss.xml",
        "category": "DEV_CLOUD",
    },
    {
        "slug": "google_deepmind",
        "name": "Google DeepMind Blog",
        "url": "https://deepmind.google/blog/rss.xml",
        "category": "DEV_CLOUD",
    },
    {
        "slug": "google_ai",
        "name": "Google AI Blog",
        "url": "https://blog.google/technology/ai/rss/",
        "category": "DEV_CLOUD",
    },
    {
        "slug": "github_changelog",
        "name": "GitHub Changelog",
        "url": "https://github.blog/changelog/feed/",
        "category": "DEV_CLOUD",
    },
    {
        "slug": "aws_security",
        "name": "AWS Security Bulletins",
        "url": "https://aws.amazon.com/security/security-bulletins/rss/feed/",
        "category": "CVE_SECURITY",
    },
    {
        "slug": "cloudflare",
        "name": "Cloudflare Blog",
        "url": "https://blog.cloudflare.com/rss/",
        "category": "DEV_CLOUD",
    },
    {
        "slug": "bleepingcomputer",
        "name": "BleepingComputer",
        "url": "https://www.bleepingcomputer.com/feed/",
        "category": "CVE_SECURITY",
    },
    {
        "slug": "thehackernews",
        "name": "The Hacker News",
        "url": "https://feeds.feedburner.com/TheHackersNews",
        "category": "CVE_SECURITY",
    },
    {
        "slug": "krebs",
        "name": "Krebs on Security",
        "url": "https://krebsonsecurity.com/feed/",
        "category": "CVE_SECURITY",
    },
    {
        "slug": "thaicert",
        "name": "ThaiCERT",
        "url": "https://www.thaicert.or.th/feed/",
        "category": "CVE_SECURITY",
    },
]

_SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_BLOCK_TAG_RE = re.compile(
    r"</?(?:p|div|br|li|ul|ol|tr|td|th|h[1-6]|blockquote|pre|hr|section|article|header|footer)\b[^>]*>",
    re.IGNORECASE,
)
_ANY_TAG_RE = re.compile(r"<[^>]+>")


def _xml_local_name(tag: str) -> str:
    """Return the local tag name with any XML namespace URI stripped."""
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _element_raw_text(elem: ET.Element) -> str:
    """Return raw text or serialized inner markup for an XML element."""
    if len(elem):
        return ET.tostring(elem, encoding="unicode")
    return elem.text or ""


def _strip_html_and_collapse(raw: Optional[str]) -> str:
    """Strip HTML tags, unescape HTML entities, and collapse whitespace."""
    if not raw or not isinstance(raw, str):
        return ""
    text = _SCRIPT_STYLE_RE.sub(" ", raw)
    text = _HTML_COMMENT_RE.sub(" ", text)
    text = _BLOCK_TAG_RE.sub(" ", text)
    text = _ANY_TAG_RE.sub("", text)
    text = html.unescape(text)
    return " ".join(text.split())


def _parse_feed_datetime(raw: Optional[str]) -> Optional[datetime]:
    """Parse an RFC 2822 (RSS) or ISO 8601 (Atom / dc:date) timestamp into UTC."""
    if not raw or not isinstance(raw, str):
        return None
    text = " ".join(raw.split())
    if not text:
        return None

    iso_dt = _parse_iso_utc(text)
    if iso_dt is not None:
        return iso_dt

    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _download_feed_bytes(url: str) -> bytes:
    """Download an RSS/Atom feed with timeout and RSS_MAX_BYTES size guard."""
    headers = {
        "User-Agent": RSS_USER_AGENT,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    }
    resp = requests.get(url, headers=headers, timeout=15, stream=True)
    try:
        resp.raise_for_status()
        content_length = None
        if hasattr(resp, "headers") and resp.headers:
            for header_key, header_val in resp.headers.items():
                if str(header_key).lower() == "content-length":
                    content_length = header_val
                    break
        if content_length is not None:
            try:
                declared_size = int(str(content_length).strip())
            except ValueError:
                declared_size = None
            if declared_size is not None and declared_size > RSS_MAX_BYTES:
                raise ValueError(
                    f"Feed response too large ({declared_size} bytes > {RSS_MAX_BYTES} byte limit)"
                )

        chunks: List[bytes] = []
        total_bytes = 0
        for chunk in resp.iter_content(chunk_size=65536):
            if not chunk:
                continue
            if isinstance(chunk, str):
                chunk = chunk.encode("utf-8")
            total_bytes += len(chunk)
            if total_bytes > RSS_MAX_BYTES:
                raise ValueError(
                    f"Feed response exceeded {RSS_MAX_BYTES} byte limit"
                )
            chunks.append(chunk)
        return b"".join(chunks)
    finally:
        if hasattr(resp, "close"):
            resp.close()


def _extract_feed_entry(
    elem: ET.Element,
    is_atom: bool,
    cutoff_dt: datetime,
    feed_slug: str,
    feed_name: str,
    feed_category: str,
) -> Optional[Tuple[datetime, Dict[str, Any]]]:
    """
    Extract a candidate item from a single RSS <item> or Atom <entry> element.
    Returns (published_dt, item_dict) if valid and within cutoff_dt, else None.
    """
    # Check date first so out-of-window entries skip link, HTML, and hashing work.
    date_candidates: Dict[str, str] = {}
    for child in elem:
        local = _xml_local_name(child.tag).lower()
        if local in ("pubdate", "published", "updated", "date"):
            if local not in date_candidates and child.text and child.text.strip():
                date_candidates[local] = child.text.strip()

    date_order = (
        ("published", "updated", "date", "pubdate")
        if is_atom
        else ("pubdate", "date", "published", "updated")
    )
    pub_dt: Optional[datetime] = None
    for key in date_order:
        if key in date_candidates:
            pub_dt = _parse_feed_datetime(date_candidates[key])
            if pub_dt is not None:
                break
    if pub_dt is None or pub_dt < cutoff_dt:
        return None

    title_raw: Optional[str] = None
    rss_text_link: Optional[str] = None
    explicit_alt_link: Optional[str] = None
    default_alt_link: Optional[str] = None
    fallback_href_link: Optional[str] = None
    atom_text_link: Optional[str] = None
    summary_parts: Dict[str, str] = {}

    for child in elem:
        local = _xml_local_name(child.tag).lower()
        if local == "link":
            href = (child.attrib.get("href") or "").strip()
            rel = (child.attrib.get("rel") or "").strip().lower()
            text_val = (child.text or "").strip()
            if href:
                if rel == "alternate" and explicit_alt_link is None:
                    explicit_alt_link = href
                elif not rel and default_alt_link is None:
                    default_alt_link = href
                elif fallback_href_link is None:
                    fallback_href_link = href
            if text_val:
                if not is_atom and rss_text_link is None:
                    rss_text_link = text_val
                elif is_atom and atom_text_link is None:
                    atom_text_link = text_val
        elif local == "title" and title_raw is None:
            title_raw = _element_raw_text(child)
        elif local in ("description", "encoded", "summary", "content"):
            if local not in summary_parts:
                raw_val = _element_raw_text(child)
                if raw_val and raw_val.strip():
                    summary_parts[local] = raw_val

    if is_atom:
        link = explicit_alt_link or default_alt_link or fallback_href_link or atom_text_link or ""
    else:
        link = rss_text_link or explicit_alt_link or default_alt_link or fallback_href_link or ""
    if not link:
        return None

    title = _strip_html_and_collapse(title_raw) or link

    summary_order = ("summary", "content") if is_atom else ("description", "encoded")
    summary_text = ""
    for key in summary_order:
        if key in summary_parts:
            cleaned = _strip_html_and_collapse(summary_parts[key])
            if cleaned:
                summary_text = cleaned
                break

    if len(summary_text) > 400:
        summary_excerpt = summary_text[:397].rstrip() + "..."
    else:
        summary_excerpt = summary_text

    published_iso = pub_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    if summary_excerpt:
        raw_context = (
            f"Source: {feed_name} | Published: {published_iso}\n"
            f"Summary: {summary_excerpt}"
        )
    else:
        raw_context = f"Source: {feed_name} | Published: {published_iso}"

    link_hash = hashlib.sha1(link.encode("utf-8")).hexdigest()[:12]
    source_id = f"rss_{feed_slug}_{link_hash}"

    return (
        pub_dt,
        {
            "source_id": source_id,
            "category": feed_category,
            "title": title,
            "url": link,
            "raw_context": raw_context,
            "event_start_date": None,
        },
    )


def _parse_feed_bytes(
    raw_bytes: bytes,
    cutoff_dt: datetime,
    feed_slug: str,
    feed_name: str,
    feed_category: str,
) -> List[Tuple[datetime, Dict[str, Any]]]:
    """Stream-parse RSS 2.0 or Atom XML bytes and return up to RSS_PER_FEED_CAP newest items."""
    if raw_bytes.startswith(b"\xef\xbb\xbf"):
        raw_bytes = raw_bytes[3:]
    raw_bytes = raw_bytes.lstrip()
    if not raw_bytes:
        raise ValueError("Empty feed response")

    root_checked = False
    is_atom = False
    target_tag = "item"
    dated_items: List[Tuple[datetime, Dict[str, Any]]] = []
    seen_ids: Set[str] = set()

    for event, elem in ET.iterparse(io.BytesIO(raw_bytes), events=("start", "end")):
        if not root_checked and event == "start":
            root_local = _xml_local_name(elem.tag).lower()
            if root_local == "feed":
                is_atom = True
                target_tag = "entry"
            elif root_local in ("rss", "rdf"):
                is_atom = False
                target_tag = "item"
            else:
                raise ValueError(f"Unsupported feed root element <{elem.tag}>")
            root_checked = True
            continue

        if event == "end" and _xml_local_name(elem.tag).lower() == target_tag:
            extracted = _extract_feed_entry(
                elem=elem,
                is_atom=is_atom,
                cutoff_dt=cutoff_dt,
                feed_slug=feed_slug,
                feed_name=feed_name,
                feed_category=feed_category,
            )
            elem.clear()
            if extracted is not None:
                source_id = extracted[1]["source_id"]
                if source_id not in seen_ids:
                    seen_ids.add(source_id)
                    dated_items.append(extracted)

    dated_items.sort(key=lambda pair: pair[0], reverse=True)
    return dated_items[:RSS_PER_FEED_CAP]


def fetch_rss_feeds() -> List[Dict[str, Any]]:
    """
    Fetch recent items (last 36 hours) from configured primary-source RSS/Atom feeds.
    Keeps at most 5 newest items per feed and at most 30 newest items overall.
    """
    SOURCE_ERRORS.pop("rss", None)
    cutoff_dt = datetime.now(timezone.utc) - timedelta(hours=36)
    all_dated_items: List[Tuple[datetime, Dict[str, Any]]] = []
    feed_errors: List[str] = []
    succeeded_feeds = 0

    for feed in RSS_FEEDS:
        slug = feed["slug"]
        name = feed["name"]
        url = feed["url"]
        category = feed["category"]
        try:
            raw_bytes = _download_feed_bytes(url)
            feed_items = _parse_feed_bytes(
                raw_bytes=raw_bytes,
                cutoff_dt=cutoff_dt,
                feed_slug=slug,
                feed_name=name,
                feed_category=category,
            )
            succeeded_feeds += 1
            all_dated_items.extend(feed_items)
            logger.info("RSS [%s]: Fetched %d items in last 36h.", name, len(feed_items))
        except Exception as e:
            feed_errors.append(f"{name}: {e}")
            logger.error("Failed to fetch RSS feed %s (%s): %s", name, slug, e)

    if feed_errors:
        SOURCE_ERRORS["rss"] = "; ".join(feed_errors)

    all_dated_items.sort(key=lambda pair: pair[0], reverse=True)
    items = [item for _, item in all_dated_items[:RSS_TOTAL_CAP]]

    logger.info(
        "RSS: Fetched %d items from %d/%d feeds in last 36h.",
        len(items),
        succeeded_feeds,
        len(RSS_FEEDS),
    )
    return items


# ---------------------------------------------------------------------------
# Deduplication & Database Operations
# ---------------------------------------------------------------------------

def get_existing_source_ids(supabase_client: Client) -> Set[str]:
    """Query existing source_id values from public.seen_sources and public.news_items to prevent reprocessing."""
    existing: Set[str] = set()
    page_size = 1000

    # 1. Query seen_sources table (tracks all fetched candidates including rejected items)
    try:
        start = 0
        while True:
            resp = (
                supabase_client.table("seen_sources")
                .select("source_id")
                .range(start, start + page_size - 1)
                .execute()
            )
            rows = resp.data or []
            for row in rows:
                if "source_id" in row:
                    existing.add(row["source_id"])
            if len(rows) < page_size:
                break
            start += page_size
        logger.info(f"Retrieved {len(existing)} existing source_ids from public.seen_sources.")
    except Exception as e:
        logger.warning(f"Could not retrieve source_ids from public.seen_sources: {e}")

    # 2. Query news_items table as secondary safety
    try:
        news_count = 0
        start = 0
        while True:
            resp = (
                supabase_client.table("news_items")
                .select("source_id")
                .range(start, start + page_size - 1)
                .execute()
            )
            rows = resp.data or []
            for row in rows:
                if "source_id" in row:
                    existing.add(row["source_id"])
                    news_count += 1
            if len(rows) < page_size:
                break
            start += page_size
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
    global LAST_GEMINI_MODEL
    LAST_GEMINI_MODEL = None
    last_error: Optional[Exception] = None
    for idx, model_name in enumerate(MODEL_FALLBACK_CHAIN):
        is_gemini_3 = model_name.startswith("gemini-3.")
        config_kwargs: Dict[str, Any] = {
            "response_mime_type": "application/json",
            "response_schema": response_schema,
        }
        if is_gemini_3:
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="low")
        else:
            # google-genai 3.x defaults to API version v1, where gemini-2.5 rejects
            # JSON mode ("JSON mode is not enabled for api version v1"). Pin the
            # 2.5 fallback to v1beta so the last model in the chain actually works.
            config_kwargs["http_options"] = types.HttpOptions(api_version="v1beta")

        config = types.GenerateContentConfig(**config_kwargs)

        try:
            logger.info("Attempting LLM call with model '%s'...", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            raw_text = (response.text or "").strip()
            if not raw_text:
                raise ValueError(f"Model '{model_name}' returned an empty response.")
            if idx > 0:
                logger.info(
                    "[LLM] Fallback succeeded! Completed request with '%s' (fallback #%d).",
                    model_name, idx
                )
            else:
                logger.info("[LLM] Primary '%s' succeeded.", model_name)
            LAST_GEMINI_MODEL = model_name
            return raw_text
        except Exception as e:
            # Cascade through the ENTIRE fallback chain on ANY error (not just
            # transient 429/503). A model-not-found / invalid-argument /
            # unsupported-config error on an early model must NOT kill the run
            # when a known-good model (e.g. gemini-2.5-flash) is still listed.
            last_error = e
            err_msg = str(e).lower()
            is_transient = any(
                keyword in err_msg
                for keyword in [
                    "429", "resource_exhausted", "quota", "rate limit",
                    "503", "unavailable", "high demand", "overloaded", "server error",
                ]
            )
            is_availability = any(
                keyword in err_msg
                for keyword in [
                    "404", "not found", "not_found", "400", "invalid_argument",
                    "invalid argument", "permission", "permission_denied", "403",
                    "unsupported", "does not exist", "is not supported", "thinking",
                ]
            )
            if idx < len(MODEL_FALLBACK_CHAIN) - 1:
                next_model = MODEL_FALLBACK_CHAIN[idx + 1]
                reason = (
                    "rate-limit/transient" if is_transient
                    else "model-unavailable/config" if is_availability
                    else "empty response" if "empty response" in err_msg
                    else "unexpected error"
                )
                logger.warning(
                    "[LLM] Model '%s' failed (%s) -> falling back to '%s'. Detail: %s",
                    model_name, reason, next_model, e,
                )
                continue
            logger.error("[LLM] Fallback chain exhausted; last model '%s' failed: %s", model_name, e)
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
    to select at most 5 normal items plus every breaking item (at most 8 total).
    """
    if not unseen_items:
        return []

    client = genai.Client(api_key=gemini_api_key)

    prompt = f"""You are the intelligence curator for a personal daily CyberSec & Tech digest web application.
The target audience is a 2nd-year Computer Science student specializing in Cybersecurity, Cloud Security, CTFs, and AI/Developer Tools.

Below is a feed of raw candidate items fetched today from CISA KEV, OpenRouter (free models), Hacker News front-page stories (any topic), official status pages (Anthropic, OpenAI, GitHub, Cloudflare, Google Cloud), official vendor blogs and release notes, security news sites (BleepingComputer, The Hacker News, Krebs) and ThaiCERT advisories, and CTFtime.

YOUR OBJECTIVES:
1. Select at most 5 normal (is_breaking=false) highest-impact items, PLUS every breaking (is_breaking=true) item, up to 8 items TOTAL for the day.
   - BREAKING ITEMS (is_breaking=true): Set is_breaking=true ONLY for:
     (a) major global outages affecting widely used cloud/AI/developer infrastructure,
     (b) actively exploited mass-impact vulnerabilities, or
     (c) a flagship model or product launch from a major AI vendor.
     Breaking items MUST always be included and must never be dropped to fit within the 5 normal-item limit.
   - Prioritize actively exploited zero-days / critical vulnerabilities, major service outages, flagship AI launches, genuinely useful free AI models/APIs, high-signal cloud/developer tools news, and major upcoming CTFs.
   - Filter out low-value items, minor library patches, marketing hype, off-topic Hacker News stories irrelevant to CS/tech/security/AI, and spam.
   - If only 1-3 items are genuinely high quality, return only those. Return at most 5 normal items plus breaking items, capped at 8 items total.

2. CATEGORY DIVERSITY & BALANCE:
   - Select AT MOST 2 non-breaking 'CVE_SECURITY' (CISA KEV) items per run. Do NOT allow CISA KEV catalog batch updates to crowd out other categories.
   - Ensure a balanced spread across available high-signal items in 'DEV_CLOUD', 'AI_FREE', and 'CTF_COMPETITION'.

3. CONSOLIDATE RELATED RELEASES (VENDOR & PRODUCT DEDUPLICATION):
   - If multiple CVEs affect the same vendor/product (e.g., multiple AhsayCBS or Ivanti CVEs released in the same catalog batch), pick ONLY the single most impactful entry and mention the related CVE IDs or variants inside its tldr rather than creating separate cards.
   - If a vendor releases multiple AI model variants simultaneously (e.g., multiple Poolside Laguna variants or multiple Google Gemma 4 sizes), select ONLY the single most relevant variant for developers, and mention the other variants/sizes concisely within its tldr.
   - Several sources may report the SAME story (e.g., a Hacker News link, a security news article, and an official vendor blog post or advisory covering one launch or vulnerability). Pick ONLY the single most primary source (the vendor's own post or official advisory) and mention the other sources concisely inside its tldr only if useful.

4. For each selected item:
   - source_id: MUST PRESERVE the exact source_id from input without modification.
   - url: MUST PRESERVE the exact source url from input (never alter or fabricate links).
   - category: MUST be exactly one of: 'AI_FREE', 'CVE_SECURITY', 'CTF_COMPETITION', 'DEV_CLOUD'.
   - is_breaking: boolean; true ONLY for major global outages, actively exploited mass-impact vulnerabilities, or a flagship model/product launch from a major AI vendor; false otherwise.
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
    seen_source_ids: Set[str] = set()
    unique_items: List[CuratedNewsItem] = []
    for item in parsed.curated_items:
        if item.source_id in seen_source_ids:
            continue
        seen_source_ids.add(item.source_id)
        unique_items.append(item)

    breaking_items = [item for item in unique_items if item.is_breaking]
    normal_items = [item for item in unique_items if not item.is_breaking][:5]
    curated = (breaking_items + normal_items)[:8]
    breaking_kept = sum(1 for item in curated if item.is_breaking)
    logger.info("Gemini selected %d high-impact items (%d breaking).", len(curated), breaking_kept)
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
            "is_breaking": item.is_breaking,
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
    try:
        resp = supabase_client.table("news_items").upsert(payload, on_conflict="source_id").execute()
    except Exception as e:
        err_text = str(e)
        if "is_breaking" in err_text.lower() or "pgrst204" in err_text.lower():
            logger.warning(
                "Column 'is_breaking' not found in public.news_items (run supabase_phase11_breaking.sql); "
                "retrying upsert without 'is_breaking'."
            )
            fallback_payload = [
                {k: v for k, v in row.items() if k != "is_breaking"}
                for row in payload
            ]
            resp = supabase_client.table("news_items").upsert(fallback_payload, on_conflict="source_id").execute()
        else:
            raise
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
# Run Report Formatting & GitHub Actions Summary
# ---------------------------------------------------------------------------

def format_run_report_markdown(report: Dict[str, Any]) -> str:
    """Render the pipeline run report as Markdown for GITHUB_STEP_SUMMARY."""
    source_counts: Dict[str, Any] = report.get("source_counts") or {}
    failed_sources: List[str] = list(report.get("failed_sources") or [])
    failed_set = set(failed_sources)

    lines: List[str] = [
        "## Daily Digest Run Report",
        "",
        "| Source | Candidates | Status |",
        "| --- | --- | --- |",
    ]
    for source in SOURCE_ORDER:
        count = source_counts.get(source)
        count_display = "n/a" if count is None else str(count)
        if source in failed_set:
            source_status = "error"
        elif count == "skipped":
            source_status = "skipped"
        elif count is None:
            source_status = "not run"
        else:
            source_status = "ok"
        lines.append(f"| {source} | {count_display} | {source_status} |")

    unseen_count = report.get("unseen_count")
    unseen_display = "n/a" if unseen_count is None else str(unseen_count)
    gemini_model = report.get("gemini_model") or "none"
    curated_count = report.get("curated_count", 0)
    breaking_count = report.get("breaking_count", 0)
    failed_display = ", ".join(failed_sources) if failed_sources else "none"
    run_status = report.get("status") or "unknown"

    lines.extend([
        "",
        f"- Status: {run_status}",
        f"- Failed sources: {failed_display}",
        f"- Unseen candidates: {unseen_display}",
        f"- Gemini model: {gemini_model}",
        f"- Curated items: {curated_count} ({breaking_count} breaking)",
        "",
        "### Curated Titles",
        "",
    ])

    curated_titles: List[str] = list(report.get("curated_titles") or [])
    if curated_titles:
        for title in curated_titles:
            clean_title = " ".join(str(title).split())
            lines.append(f"- {clean_title}")
    else:
        lines.append("- None")

    return "\n".join(lines) + "\n"


def write_github_step_summary(report: Dict[str, Any]) -> None:
    """Append the Markdown run report to GITHUB_STEP_SUMMARY when set."""
    summary_path = (os.getenv("GITHUB_STEP_SUMMARY") or "").strip()
    if not summary_path:
        return

    markdown = format_run_report_markdown(report)
    try:
        needs_separator = os.path.exists(summary_path) and os.path.getsize(summary_path) > 0
        with open(summary_path, "a", encoding="utf-8") as summary_file:
            if needs_separator:
                summary_file.write("\n")
            summary_file.write(markdown)
    except OSError as e:
        logger.warning("Failed to write run report to GITHUB_STEP_SUMMARY: %s", e)


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------

def main() -> None:
    global LAST_GEMINI_MODEL

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

    if args.dry_run and args.backfill_th:
        logger.error("--dry-run cannot be combined with --backfill-th.")
        sys.exit(2)

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
    gemini_api_key = (os.getenv("GEMINI_API_KEY") or "").strip() or None

    if not args.dry_run or args.backfill_th:
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

    # Check if backfill mode requested
    if args.backfill_th:
        supabase_client: Client = create_client(supabase_url, supabase_key)
        backfill_thai_translations(supabase_client, gemini_api_key)
        return

    SOURCE_ERRORS.clear()
    LAST_GEMINI_MODEL = None

    report: Dict[str, Any] = {
        "source_counts": {source: None for source in SOURCE_ORDER},
        "failed_sources": [],
        "unseen_count": None,
        "gemini_model": None,
        "curated_count": 0,
        "breaking_count": 0,
        "curated_titles": [],
        "status": "running",
    }

    try:
        # 1. Fetch from all 6 sources
        logger.info("=== Starting Data Collection ===")
        cisa_items = fetch_cisa_kev()
        report["source_counts"]["cisa_kev"] = len(cisa_items)

        openrouter_items = fetch_openrouter_free_models()
        report["source_counts"]["openrouter"] = len(openrouter_items)

        hn_items = fetch_hacker_news()
        report["source_counts"]["hacker_news"] = len(hn_items)

        status_items = fetch_status_incidents()
        report["source_counts"]["status_pages"] = len(status_items)

        ctftime_skipped = not args.force_ctf and datetime.now(timezone.utc).weekday() not in (0, 4)
        ctftime_items = fetch_ctftime(force_ctf=args.force_ctf)
        report["source_counts"]["ctftime"] = "skipped" if ctftime_skipped else len(ctftime_items)

        rss_items = fetch_rss_feeds()
        report["source_counts"]["rss"] = len(rss_items)

        candidates: List[Dict[str, Any]] = [
            *cisa_items,
            *openrouter_items,
            *hn_items,
            *status_items,
            *ctftime_items,
            *rss_items,
        ]

        logger.info("=== Total Candidate Items Collected: %d ===", len(candidates))

        if args.dry_run:
            report["status"] = "dry-run"
            ctftime_display = "skipped" if ctftime_skipped else str(len(ctftime_items))
            print("\n--- DRY RUN SOURCE COUNTS ---")
            print(
                f"cisa_kev: {len(cisa_items)} | openrouter: {len(openrouter_items)} "
                f"| hacker_news: {len(hn_items)} | status_pages: {len(status_items)} "
                f"| ctftime: {ctftime_display} | rss: {len(rss_items)}"
            )
            print("\n--- DRY RUN CANDIDATE SUMMARY ---")
            for i, item in enumerate(candidates, 1):
                print(f"[{i}] [{item['category']}] {item['title']}")
                print(f"    Source ID: {item['source_id']}")
                print(f"    URL: {item['url']}")
                if item.get("event_start_date"):
                    print(f"    Event Start: {item['event_start_date']}")
            print(f"\nDry run complete. Found {len(candidates)} candidate items.")
            return

        if not candidates:
            report["status"] = "failed (all sources returned zero candidates)"
            logger.error("All news sources returned zero candidates or failed. Aborting run.")
            sys.exit(1)

        # Initialize Supabase client (only needed outside --dry-run)
        supabase_client: Client = create_client(supabase_url, supabase_key)

        # 2. Query deduplication state
        existing_ids = get_existing_source_ids(supabase_client)

        # 3. Filter unseen items
        unseen_items = [item for item in candidates if item["source_id"] not in existing_ids]
        report["unseen_count"] = len(unseen_items)
        logger.info(f"Unseen items requiring processing: {len(unseen_items)} (out of {len(candidates)} total)")

        candidate_source_ids = [item["source_id"] for item in candidates if item.get("source_id")]

        if not unseen_items:
            record_seen_sources(supabase_client, candidate_source_ids)
            report["status"] = "ok (no unseen items)"
            logger.info("No new unseen items to curate today. Database is already up to date.")
            return

        # 4. Curate and summarize via Gemini
        curated_items = curate_with_gemini(unseen_items, gemini_api_key=gemini_api_key)
        report["gemini_model"] = LAST_GEMINI_MODEL
        report["curated_count"] = len(curated_items)
        report["breaking_count"] = sum(1 for item in curated_items if item.is_breaking)
        report["curated_titles"] = [
            f"[BREAKING] {item.title}" if item.is_breaking else item.title
            for item in curated_items
        ]

        # 5. Save to Supabase
        save_to_supabase(supabase_client, curated_items)

        # 6. Mark candidates as seen ONLY after curation and save succeeded. If Gemini or
        #    the save fails, the run exits above and these items are retried tomorrow
        #    instead of being silently dropped forever.
        record_seen_sources(supabase_client, candidate_source_ids)
        report["status"] = "ok"
        logger.info("=== Ingestion Pipeline Completed Successfully ===")
    except Exception as exc:
        report["status"] = f"failed ({type(exc).__name__})"
        raise
    finally:
        report["failed_sources"] = [
            source for source in SOURCE_ORDER if source in SOURCE_ERRORS
        ]
        if report["gemini_model"] is None and LAST_GEMINI_MODEL is not None:
            report["gemini_model"] = LAST_GEMINI_MODEL
        write_github_step_summary(report)


if __name__ == "__main__":
    main()
