"""Unit tests for scripts/fetch_news.py using the Python standard library only."""

from contextlib import ExitStack, redirect_stdout
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import fetch_news  # noqa: E402


def _make_response(payload, status_error=None):
    """Build a mock requests.Response returning the provided JSON payload."""
    resp = mock.MagicMock()
    if status_error is not None:
        resp.raise_for_status.side_effect = status_error
    else:
        resp.raise_for_status.return_value = None
    resp.json.return_value = payload
    return resp


def _make_rss_response(body=b"", headers=None, status_error=None, chunks=None):
    """Build a mock streaming requests.Response returning XML bytes."""
    resp = mock.MagicMock()
    if status_error is not None:
        resp.raise_for_status.side_effect = status_error
    else:
        resp.raise_for_status.return_value = None
    resp.headers = dict(headers) if headers is not None else {}
    if chunks is not None:
        resp.iter_content.return_value = iter(chunks)
    else:
        raw = body.encode("utf-8") if isinstance(body, str) else body
        resp.iter_content.return_value = iter([raw] if raw else [])
    return resp


def _make_curated_item_dict(source_id, is_breaking=False, category="DEV_CLOUD"):
    """Build a JSON-serializable dict matching CuratedNewsItem."""
    return {
        "source_id": source_id,
        "category": category,
        "is_breaking": is_breaking,
        "title": f"Title for {source_id}",
        "tldr": f"Concise technical summary for {source_id}.",
        "actionable_value": f"Actionable takeaway for {source_id}.",
        "url": f"https://example.com/{source_id}",
        "event_start_date": None,
        "tldr_th": f"Localized summary for {source_id}.",
        "actionable_value_th": f"Localized takeaway for {source_id}.",
        "tech_terms_th": [
            {"term": "RCE", "meaning": "Remote Code Execution explanation"}
        ],
    }


def _make_curated_item(
    source_id,
    is_breaking=False,
    category=fetch_news.CategoryEnum.DEV_CLOUD,
):
    """Build a validated CuratedNewsItem instance."""
    return fetch_news.CuratedNewsItem(
        source_id=source_id,
        category=category,
        is_breaking=is_breaking,
        title=f"Title for {source_id}",
        tldr=f"Concise technical summary for {source_id}.",
        actionable_value=f"Actionable takeaway for {source_id}.",
        url=f"https://example.com/{source_id}",
        event_start_date=None,
        tldr_th=f"Localized summary for {source_id}.",
        actionable_value_th=f"Localized takeaway for {source_id}.",
        tech_terms_th=[
            fetch_news.TechTerm(term="BGP", meaning="Border Gateway Protocol")
        ],
    )


class TestFetchHackerNews(unittest.TestCase):
    """Tests for fetch_hacker_news."""

    @mock.patch("fetch_news.requests.get")
    def test_sorts_by_points_keeps_top_30_and_builds_source_ids(self, mock_get):
        # 19 and 35 are coprime, giving 35 distinct point values in scrambled order.
        hits = [
            {
                "objectID": str(1000 + i),
                "title": f"Story {i}",
                "url": f"https://example.com/story/{i}",
                "points": ((i * 19) % 35) * 10 + 60,
                "num_comments": i,
                "story_text": "",
            }
            for i in range(35)
        ]
        mock_get.return_value = _make_response({"hits": hits, "nbHits": len(hits)})

        items = fetch_news.fetch_hacker_news()

        expected_top_30 = sorted(hits, key=lambda h: h["points"], reverse=True)[:30]
        self.assertEqual(len(items), 30)
        self.assertEqual(
            [item["source_id"] for item in items],
            [f"hn_{h['objectID']}" for h in expected_top_30],
        )
        self.assertEqual(
            [item["url"] for item in items],
            [h["url"] for h in expected_top_30],
        )

    @mock.patch("fetch_news.requests.get")
    def test_falls_back_to_hn_thread_url_when_url_missing(self, mock_get):
        hits = [
            {"objectID": "101", "title": "Ask HN: Missing URL key", "points": 300},
            {"objectID": "102", "title": "Ask HN: Empty URL", "url": "", "points": 200},
            {
                "objectID": "103",
                "title": "External story",
                "url": "https://example.com/103",
                "points": 100,
            },
        ]
        mock_get.return_value = _make_response({"hits": hits, "nbHits": len(hits)})

        items = fetch_news.fetch_hacker_news()

        self.assertEqual(
            [item["source_id"] for item in items],
            ["hn_101", "hn_102", "hn_103"],
        )
        self.assertEqual(
            [item["url"] for item in items],
            [
                "https://news.ycombinator.com/item?id=101",
                "https://news.ycombinator.com/item?id=102",
                "https://example.com/103",
            ],
        )

    @mock.patch("fetch_news.requests.get")
    def test_logs_warning_when_nb_hits_exceeds_returned_hits(self, mock_get):
        hits = [
            {
                "objectID": "42",
                "title": "High signal security post",
                "url": "https://example.com/42",
                "points": 150,
            }
        ]
        mock_get.return_value = _make_response({"hits": hits, "nbHits": 600})

        with self.assertLogs(fetch_news.logger, level="WARNING") as cm:
            items = fetch_news.fetch_hacker_news()

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["source_id"], "hn_42")
        self.assertTrue(
            any("1 of 600" in msg and "truncated" in msg for msg in cm.output),
            f"Expected truncation warning in logs, got: {cm.output}",
        )

    @mock.patch("fetch_news.requests.get")
    def test_returns_empty_list_and_logs_error_on_exception(self, mock_get):
        mock_get.side_effect = RuntimeError("connection timeout")

        with self.assertLogs(fetch_news.logger, level="ERROR") as cm:
            items = fetch_news.fetch_hacker_news()

        self.assertEqual(items, [])
        self.assertTrue(
            any("Failed to fetch Hacker News" in msg for msg in cm.output),
            f"Expected error log message, got: {cm.output}",
        )

    @mock.patch("fetch_news.requests.get")
    def test_handles_json_nulls_skips_null_object_id_and_keeps_valid_hits(self, mock_get):
        hits = [
            None,
            {"objectID": None, "title": "Null ID story", "points": 999},
            {"objectID": "   ", "title": "Whitespace ID story", "points": 888},
            {
                "objectID": "501",
                "title": None,
                "story_text": None,
                "url": None,
                "points": None,
                "num_comments": None,
            },
            {
                "objectID": "502",
                "title": "Critical RCE vulnerability in OpenSSH",
                "story_text": None,
                "url": "https://example.com/502",
                "points": 200,
                "num_comments": None,
            },
        ]
        mock_get.return_value = _make_response({"hits": hits, "nbHits": len(hits)})

        items = fetch_news.fetch_hacker_news()

        self.assertEqual([item["source_id"] for item in items], ["hn_502", "hn_501"])
        self.assertNotIn("hn_None", [item["source_id"] for item in items])
        self.assertEqual(items[0]["category"], "CVE_SECURITY")
        self.assertEqual(items[1]["category"], "DEV_CLOUD")
        self.assertEqual(items[1]["title"], "")
        self.assertEqual(items[1]["url"], "https://news.ycombinator.com/item?id=501")

    @mock.patch("fetch_news.requests.get")
    def test_category_heuristic_classifies_security_and_dev_cloud(self, mock_get):
        hits = [
            {
                "objectID": "601",
                "title": "New zero-day exploit affects routers",
                "points": 300,
            },
            {
                "objectID": "602",
                "title": "Benchmarking Claude and Gemini LLM tooling",
                "points": 200,
            },
            {
                "objectID": "603",
                "title": "PostgreSQL 18 query planner internals",
                "points": 100,
            },
        ]
        mock_get.return_value = _make_response({"hits": hits, "nbHits": len(hits)})

        items = fetch_news.fetch_hacker_news()

        categories = {item["source_id"]: item["category"] for item in items}
        self.assertEqual(
            categories,
            {
                "hn_601": "CVE_SECURITY",
                "hn_602": "DEV_CLOUD",
                "hn_603": "DEV_CLOUD",
            },
        )


class TestFetchStatusIncidents(unittest.TestCase):
    """Tests for fetch_status_incidents."""

    ANTHROPIC_URL = "https://status.claude.com/api/v2/incidents.json"
    OPENAI_URL = "https://status.openai.com/api/v2/incidents.json"
    GITHUB_URL = "https://www.githubstatus.com/api/v2/incidents.json"
    CLOUDFLARE_URL = "https://www.cloudflarestatus.com/api/v2/incidents.json"
    GCP_URL = "https://status.cloud.google.com/incidents.json"

    def _make_router(self, overrides):
        responses = {
            self.ANTHROPIC_URL: {"incidents": []},
            self.OPENAI_URL: {"incidents": []},
            self.GITHUB_URL: {"incidents": []},
            self.CLOUDFLARE_URL: {"incidents": []},
            self.GCP_URL: [],
        }
        responses.update(overrides)

        def _fake_get(url, *args, **kwargs):
            if url not in responses:
                raise AssertionError(f"Unexpected status URL requested: {url}")
            entry = responses[url]
            if isinstance(entry, Exception):
                raise entry
            return _make_response(entry)

        return _fake_get

    @mock.patch("fetch_news.requests.get")
    def test_statuspage_filters_impact_and_age_and_shortlink_fallback(self, mock_get):
        now = datetime.now(timezone.utc)
        recent_iso = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        old_iso = (now - timedelta(hours=40)).strftime("%Y-%m-%dT%H:%M:%SZ")

        mock_get.side_effect = self._make_router(
            {
                self.ANTHROPIC_URL: {
                    "incidents": [
                        {
                            "id": "a1",
                            "impact": "major",
                            "created_at": recent_iso,
                            "name": "API elevated errors",
                            "shortlink": "https://stspg.io/a1",
                        },
                        {
                            "id": "a2",
                            "impact": "critical",
                            "created_at": recent_iso,
                            "name": "Global outage",
                        },
                        {
                            "id": "a3",
                            "impact": "minor",
                            "created_at": recent_iso,
                            "name": "Minor latency",
                        },
                        {
                            "id": "a4",
                            "impact": "critical",
                            "created_at": old_iso,
                            "name": "Old critical outage",
                        },
                    ]
                },
                self.GITHUB_URL: {
                    "incidents": [
                        {
                            "id": "g1",
                            "impact": "MAJOR",
                            "created_at": recent_iso,
                            "name": "Actions degraded",
                            "shortlink": "",
                        }
                    ]
                },
            }
        )

        items = fetch_news.fetch_status_incidents()

        urls_by_id = {item["source_id"]: item["url"] for item in items}
        self.assertEqual(
            urls_by_id,
            {
                "status_anthropic_a1": "https://stspg.io/a1",
                "status_anthropic_a2": "https://status.claude.com/incidents/a2",
                "status_github_g1": "https://www.githubstatus.com/incidents/g1",
            },
        )
        self.assertTrue(all(item["category"] == "DEV_CLOUD" for item in items))

    @mock.patch("fetch_news.requests.get")
    def test_google_cloud_keeps_only_high_severity_and_builds_full_url(self, mock_get):
        now = datetime.now(timezone.utc)
        recent_iso = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
        old_iso = (now - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ")

        mock_get.side_effect = self._make_router(
            {
                self.GCP_URL: [
                    {
                        "id": "gcp1",
                        "severity": "high",
                        "created": recent_iso,
                        "uri": "incidents/gcp1",
                        "external_desc": "Compute Engine outage",
                    },
                    {
                        "id": "gcp2",
                        "severity": "high",
                        "created": recent_iso,
                        "uri": "/incidents/gcp2",
                        "external_desc": "Cloud Networking disruption",
                    },
                    {
                        "id": "gcp3",
                        "severity": "high",
                        "created": recent_iso,
                        "uri": "",
                        "external_desc": "IAM outage",
                    },
                    {
                        "id": "gcp4",
                        "severity": "medium",
                        "created": recent_iso,
                        "uri": "incidents/gcp4",
                        "external_desc": "Medium impact issue",
                    },
                    {
                        "id": "gcp5",
                        "severity": "low",
                        "created": recent_iso,
                        "uri": "incidents/gcp5",
                        "external_desc": "Low impact issue",
                    },
                    {
                        "id": "gcp6",
                        "severity": "high",
                        "created": old_iso,
                        "uri": "incidents/gcp6",
                        "external_desc": "Old high severity issue",
                    },
                ]
            }
        )

        items = fetch_news.fetch_status_incidents()

        urls_by_id = {item["source_id"]: item["url"] for item in items}
        self.assertEqual(
            urls_by_id,
            {
                "status_google_cloud_gcp1": "https://status.cloud.google.com/incidents/gcp1",
                "status_google_cloud_gcp2": "https://status.cloud.google.com/incidents/gcp2",
                "status_google_cloud_gcp3": "https://status.cloud.google.com/incidents/gcp3",
            },
        )

    @mock.patch("fetch_news.requests.get")
    def test_one_provider_raising_does_not_stop_others(self, mock_get):
        now = datetime.now(timezone.utc)
        recent_iso = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

        mock_get.side_effect = self._make_router(
            {
                self.ANTHROPIC_URL: RuntimeError("Anthropic status unavailable"),
                self.OPENAI_URL: {
                    "incidents": [
                        {
                            "id": "oa1",
                            "impact": "critical",
                            "created_at": recent_iso,
                            "name": "ChatGPT outage",
                        }
                    ]
                },
                self.CLOUDFLARE_URL: RuntimeError("Cloudflare 503"),
                self.GCP_URL: [
                    {
                        "id": "gcp1",
                        "severity": "high",
                        "created": recent_iso,
                        "uri": "incidents/gcp1",
                        "external_desc": "GKE outage",
                    }
                ],
            }
        )

        with self.assertLogs(fetch_news.logger, level="ERROR") as cm:
            items = fetch_news.fetch_status_incidents()

        self.assertEqual(
            [item["source_id"] for item in items],
            ["status_openai_oa1", "status_google_cloud_gcp1"],
        )
        self.assertTrue(any("Anthropic" in msg for msg in cm.output))
        self.assertTrue(any("Cloudflare" in msg for msg in cm.output))


class TestFetchCisaKev(unittest.TestCase):
    """Tests for fetch_cisa_kev."""

    @mock.patch("fetch_news.requests.get")
    def test_7_day_cutoff_source_ids_and_nvd_url(self, mock_get):
        now = datetime.now(timezone.utc)
        recent_date = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        boundary_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        old_date = (now - timedelta(days=8)).strftime("%Y-%m-%d")

        mock_get.return_value = _make_response(
            {
                "vulnerabilities": [
                    {
                        "cveID": "CVE-2026-1001",
                        "dateAdded": recent_date,
                        "vulnerabilityName": "Recent RCE",
                        "vendorProject": "Acme",
                        "product": "Gateway",
                        "shortDescription": "Remote code execution.",
                        "requiredAction": "Apply patches.",
                    },
                    {
                        "cveID": "CVE-2026-1002",
                        "dateAdded": boundary_date,
                        "vulnerabilityName": "Boundary Auth Bypass",
                        "vendorProject": "Acme",
                        "product": "Portal",
                        "shortDescription": "Authentication bypass.",
                        "requiredAction": "Update firmware.",
                    },
                    {
                        "cveID": "CVE-2026-1003",
                        "dateAdded": old_date,
                        "vulnerabilityName": "Old Vulnerability",
                        "vendorProject": "Acme",
                        "product": "Legacy",
                        "shortDescription": "Expired window.",
                        "requiredAction": "Patch.",
                    },
                    {
                        "cveID": "   ",
                        "dateAdded": recent_date,
                        "vulnerabilityName": "Missing CVE ID",
                    },
                ]
            }
        )

        items = fetch_news.fetch_cisa_kev()

        self.assertEqual(
            [item["source_id"] for item in items],
            ["cisa_CVE-2026-1001", "cisa_CVE-2026-1002"],
        )
        self.assertEqual(
            [item["url"] for item in items],
            [
                "https://nvd.nist.gov/vuln/detail/CVE-2026-1001",
                "https://nvd.nist.gov/vuln/detail/CVE-2026-1002",
            ],
        )
        self.assertTrue(all(item["category"] == "CVE_SECURITY" for item in items))

    @mock.patch("fetch_news.requests.get")
    def test_returns_empty_list_and_logs_error_on_exception(self, mock_get):
        mock_get.side_effect = RuntimeError("CISA feed error")

        with self.assertLogs(fetch_news.logger, level="ERROR") as cm:
            items = fetch_news.fetch_cisa_kev()

        self.assertEqual(items, [])
        self.assertTrue(
            any("Failed to fetch CISA KEV catalog" in msg for msg in cm.output)
        )

    @mock.patch("fetch_news.requests.get")
    def test_handles_json_nulls_and_skips_null_cve_id_without_dropping_valid_items(
        self, mock_get
    ):
        recent_date = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        mock_get.return_value = _make_response(
            {
                "vulnerabilities": [
                    None,
                    {
                        "cveID": None,
                        "dateAdded": recent_date,
                        "vulnerabilityName": "Null CVE",
                    },
                    {
                        "cveID": "CVE-2026-2001",
                        "dateAdded": None,
                        "vulnerabilityName": "Null date",
                    },
                    {
                        "cveID": "CVE-2026-2002",
                        "dateAdded": recent_date,
                        "vulnerabilityName": None,
                        "vendorProject": None,
                        "product": None,
                        "shortDescription": None,
                        "requiredAction": None,
                    },
                    {
                        "cveID": "CVE-2026-2003",
                        "dateAdded": recent_date,
                        "vulnerabilityName": "Valid Vuln",
                        "vendorProject": "Acme",
                        "product": "Edge",
                        "shortDescription": "Details.",
                        "requiredAction": "Patch.",
                    },
                ]
            }
        )

        items = fetch_news.fetch_cisa_kev()

        self.assertEqual(
            [item["source_id"] for item in items],
            ["cisa_CVE-2026-2002", "cisa_CVE-2026-2003"],
        )
        self.assertNotIn("cisa_None", [item["source_id"] for item in items])


class TestFetchOpenRouterFreeModels(unittest.TestCase):
    """Tests for fetch_openrouter_free_models."""

    @mock.patch("fetch_news.requests.get")
    def test_handles_json_nulls_and_skips_null_id_without_dropping_valid_models(
        self, mock_get
    ):
        mock_get.return_value = _make_response(
            {
                "data": [
                    None,
                    {"id": None, "name": "Null ID model"},
                    {"id": "vendor/paid-model", "name": "Paid Model"},
                    {
                        "id": "vendor/alpha:free",
                        "name": None,
                        "description": None,
                        "context_length": None,
                        "architecture": None,
                    },
                    {
                        "id": "vendor/beta:free",
                        "name": "Beta Free",
                        "description": "Fast open model",
                        "context_length": 32768,
                        "architecture": {"modality": None},
                    },
                ]
            }
        )

        items = fetch_news.fetch_openrouter_free_models()

        self.assertEqual(
            [item["source_id"] for item in items],
            ["openrouter_vendor/alpha:free", "openrouter_vendor/beta:free"],
        )
        self.assertEqual(items[0]["title"], "Free Model: vendor/alpha:free")
        self.assertIn("Modality: text", items[0]["raw_context"])
        self.assertIn("Modality: text", items[1]["raw_context"])


class TestFetchCtftime(unittest.TestCase):
    """Tests for fetch_ctftime."""

    @mock.patch("fetch_news.requests.get")
    def test_handles_json_nulls_and_skips_null_id_without_dropping_valid_events(
        self, mock_get
    ):
        mock_get.return_value = _make_response(
            [
                None,
                {"id": None, "title": "Null ID CTF"},
                {"id": "  ", "title": "Blank ID CTF"},
                {
                    "id": 1234,
                    "title": None,
                    "start": None,
                    "finish": None,
                    "url": None,
                    "ctftime_url": None,
                    "format": None,
                    "weight": None,
                    "organizers": None,
                    "description": None,
                },
                {
                    "id": 5678,
                    "title": "SecCTF",
                    "start": "2026-11-20T00:00:00+00:00",
                    "finish": "2026-11-22T00:00:00+00:00",
                    "url": "https://secctf.example",
                    "format": "Jeopardy",
                    "weight": 25.0,
                    "organizers": [None, {"name": None}, {"name": "SecTeam"}],
                    "description": "Annual security competition",
                },
            ]
        )

        items = fetch_news.fetch_ctftime(force_ctf=True)

        self.assertEqual(
            [item["source_id"] for item in items],
            ["ctftime_1234", "ctftime_5678"],
        )
        self.assertNotIn("ctftime_None", [item["source_id"] for item in items])
        self.assertEqual(items[0]["url"], "https://ctftime.org/event/1234")
        self.assertIn("Format: Jeopardy | Weight: 0.0", items[0]["raw_context"])
        self.assertIn("Organizers: SecTeam", items[1]["raw_context"])


class TestGetExistingSourceIds(unittest.TestCase):
    """Tests for get_existing_source_ids pagination and error handling."""

    def _make_paginated_table(self, pages):
        """Return a mock table query builder serving pages in order and recording range args."""
        range_calls = []
        table_mock = mock.MagicMock()

        def _range(start, end):
            range_calls.append((start, end))
            exec_mock = mock.MagicMock()
            page_idx = len(range_calls) - 1
            entry = pages[page_idx]
            if isinstance(entry, Exception):
                exec_mock.execute.side_effect = entry
            else:
                exec_mock.execute.return_value = mock.MagicMock(data=entry)
            return exec_mock

        table_mock.select.return_value.range.side_effect = _range
        return table_mock, range_calls

    def test_paginates_seen_sources_and_news_items_past_1000_rows(self):
        seen_pages = [
            [{"source_id": f"seen_{i}"} for i in range(1000)],
            [{"source_id": f"seen_{i}"} for i in range(1000, 2000)],
            [{"source_id": f"seen_{i}"} for i in range(2000, 2250)],
        ]
        news_pages = [
            [{"source_id": f"news_{i}"} for i in range(1000)],
            [{"source_id": f"news_{i}"} for i in range(1000, 1005)],
        ]
        seen_table, seen_ranges = self._make_paginated_table(seen_pages)
        news_table, news_ranges = self._make_paginated_table(news_pages)

        supabase_client = mock.MagicMock()
        supabase_client.table.side_effect = lambda name: (
            seen_table if name == "seen_sources" else news_table
        )

        existing = fetch_news.get_existing_source_ids(supabase_client)

        self.assertEqual(seen_ranges, [(0, 999), (1000, 1999), (2000, 2999)])
        self.assertEqual(news_ranges, [(0, 999), (1000, 1999)])
        self.assertEqual(len(existing), 3255)
        self.assertIn("seen_0", existing)
        self.assertIn("seen_1500", existing)
        self.assertIn("seen_2249", existing)
        self.assertIn("news_0", existing)
        self.assertIn("news_1004", existing)

    def test_exact_1000_row_page_fetches_next_empty_page_and_stops(self):
        seen_pages = [
            [{"source_id": f"seen_{i}"} for i in range(1000)],
            [],
        ]
        news_pages = [[]]
        seen_table, seen_ranges = self._make_paginated_table(seen_pages)
        news_table, news_ranges = self._make_paginated_table(news_pages)

        supabase_client = mock.MagicMock()
        supabase_client.table.side_effect = lambda name: (
            seen_table if name == "seen_sources" else news_table
        )

        existing = fetch_news.get_existing_source_ids(supabase_client)

        self.assertEqual(seen_ranges, [(0, 999), (1000, 1999)])
        self.assertEqual(news_ranges, [(0, 999)])
        self.assertEqual(len(existing), 1000)

    def test_logs_warning_and_continues_when_table_query_fails(self):
        seen_table, _ = self._make_paginated_table([RuntimeError("seen_sources offline")])
        news_table, news_ranges = self._make_paginated_table([[{"source_id": "hn_99"}]])

        supabase_client = mock.MagicMock()
        supabase_client.table.side_effect = lambda name: (
            seen_table if name == "seen_sources" else news_table
        )

        with self.assertLogs(fetch_news.logger, level="WARNING") as cm:
            existing = fetch_news.get_existing_source_ids(supabase_client)

        self.assertEqual(existing, {"hn_99"})
        self.assertEqual(news_ranges, [(0, 999)])
        self.assertTrue(any("seen_sources" in msg for msg in cm.output))


class TestGetRecentPublishedTitles(unittest.TestCase):
    """Tests for get_recent_published_titles."""

    def _make_supabase_mock(self, rows=None, error=None):
        supabase_client = mock.MagicMock()
        table_mock = supabase_client.table.return_value
        select_mock = table_mock.select.return_value
        gte_mock = select_mock.gte.return_value
        order_mock = gte_mock.order.return_value
        limit_mock = order_mock.limit.return_value
        if error is not None:
            limit_mock.execute.side_effect = error
        else:
            limit_mock.execute.return_value = mock.MagicMock(data=rows)
        return supabase_client, table_mock, select_mock, gte_mock, order_mock, limit_mock

    def test_returns_recent_titles_with_expected_query_and_72h_cutoff(self):
        rows = [
            {
                "title": "Google Launches Gemini 4 Neon",
                "created_at": "2026-11-17T10:00:00+00:00",
            },
            {
                "title": "  Java4Shell\n  Critical RCE  ",
                "created_at": "2026-11-16T08:00:00+00:00",
            },
            {
                "title": None,
                "created_at": "2026-11-16T07:00:00+00:00",
            },
            {
                "title": "   ",
                "created_at": "2026-11-16T06:00:00+00:00",
            },
            None,
        ]
        (
            supabase_client,
            table_mock,
            select_mock,
            gte_mock,
            order_mock,
            limit_mock,
        ) = self._make_supabase_mock(rows=rows)

        with mock.patch("fetch_news.datetime", _FixedTuesdayDatetime):
            titles = fetch_news.get_recent_published_titles(supabase_client)

        self.assertEqual(
            titles,
            ["Google Launches Gemini 4 Neon", "Java4Shell Critical RCE"],
        )
        supabase_client.table.assert_called_once_with("news_items")
        table_mock.select.assert_called_once_with("title, created_at")
        select_mock.gte.assert_called_once_with(
            "created_at", "2026-11-14T12:00:00+00:00"
        )
        gte_mock.order.assert_called_once_with("created_at", desc=True)
        order_mock.limit.assert_called_once_with(60)
        limit_mock.execute.assert_called_once_with()

    def test_respects_custom_hours_and_caps_at_60_rows(self):
        rows = [
            {"title": f"Title {i}", "created_at": "2026-11-17T00:00:00+00:00"}
            for i in range(75)
        ]
        supabase_client, _, select_mock, _, _, _ = self._make_supabase_mock(rows=rows)

        with mock.patch("fetch_news.datetime", _FixedTuesdayDatetime):
            titles = fetch_news.get_recent_published_titles(supabase_client, hours=24)

        select_mock.gte.assert_called_once_with(
            "created_at", "2026-11-16T12:00:00+00:00"
        )
        self.assertEqual(len(titles), 60)
        self.assertEqual(titles[0], "Title 0")
        self.assertEqual(titles[-1], "Title 59")

    def test_logs_warning_and_returns_empty_list_on_exception(self):
        supabase_client, _, _, _, _, _ = self._make_supabase_mock(
            error=RuntimeError("Supabase connection refused")
        )

        with self.assertLogs(fetch_news.logger, level="WARNING") as cm:
            titles = fetch_news.get_recent_published_titles(supabase_client)

        self.assertEqual(titles, [])
        self.assertTrue(
            any("recent published titles" in msg.lower() for msg in cm.output),
            f"Expected warning log for recent published titles failure, got: {cm.output}",
        )


class TestGenerateContentWithFallback(unittest.TestCase):
    """Tests for generate_content_with_fallback."""

    def test_empty_and_whitespace_responses_fall_through_to_next_model(self):
        client = mock.MagicMock()
        client.models.generate_content.side_effect = [
            mock.MagicMock(text=""),
            mock.MagicMock(text="   \n\t  "),
            mock.MagicMock(text=None),
            mock.MagicMock(text='  {"curated_items": []}  '),
        ]

        with self.assertLogs(fetch_news.logger, level="WARNING") as cm:
            result = fetch_news.generate_content_with_fallback(
                client, "test prompt", fetch_news.CuratedDigestResponse
            )

        self.assertEqual(result, '{"curated_items": []}')
        self.assertEqual(
            [call.kwargs["model"] for call in client.models.generate_content.call_args_list],
            fetch_news.MODEL_FALLBACK_CHAIN,
        )
        for model_name in fetch_news.MODEL_FALLBACK_CHAIN[:-1]:
            self.assertTrue(
                any(model_name in msg for msg in cm.output),
                f"Expected WARNING log mentioning {model_name}, got: {cm.output}",
            )
        for call in client.models.generate_content.call_args_list[:-1]:
            cfg = call.kwargs["config"]
            self.assertIsNotNone(cfg.thinking_config)
            self.assertIsNone(cfg.http_options)
        last_cfg = client.models.generate_content.call_args_list[-1].kwargs["config"]
        self.assertIsNone(last_cfg.thinking_config)
        self.assertIsNotNone(last_cfg.http_options)
        self.assertEqual(last_cfg.http_options.api_version, "v1beta")

    def test_all_models_returning_empty_text_raises(self):
        client = mock.MagicMock()
        client.models.generate_content.return_value = mock.MagicMock(text="   ")

        with self.assertLogs(fetch_news.logger, level="WARNING") as cm:
            with self.assertRaises(ValueError):
                fetch_news.generate_content_with_fallback(
                    client, "test prompt", fetch_news.CuratedDigestResponse
                )

        self.assertEqual(
            client.models.generate_content.call_count,
            len(fetch_news.MODEL_FALLBACK_CHAIN),
        )
        self.assertTrue(any("exhausted" in msg for msg in cm.output))


class TestCurateWithGemini(unittest.TestCase):
    """Tests for curate_with_gemini cut logic."""

    SAMPLE_UNSEEN = [
        {
            "source_id": "hn_1",
            "category": "DEV_CLOUD",
            "title": "Sample item",
            "url": "https://example.com/1",
            "raw_context": "Sample context",
            "event_start_date": None,
        }
    ]

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_breaking_items_first_and_normal_items_capped_at_5(
        self, mock_client_cls, mock_generate
    ):
        response_items = [
            _make_curated_item_dict("n1", is_breaking=False),
            _make_curated_item_dict("n2", is_breaking=False),
            _make_curated_item_dict("b1", is_breaking=True),
            _make_curated_item_dict("n3", is_breaking=False),
            _make_curated_item_dict("n4", is_breaking=False),
            _make_curated_item_dict("n5", is_breaking=False),
            _make_curated_item_dict("b2", is_breaking=True),
            _make_curated_item_dict("n6", is_breaking=False),
            _make_curated_item_dict("n7", is_breaking=False),
        ]
        mock_generate.return_value = json.dumps({"curated_items": response_items})

        curated = fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN, gemini_api_key="test-gemini-key"
        )

        mock_client_cls.assert_called_once_with(api_key="test-gemini-key")
        mock_generate.assert_called_once()
        self.assertEqual(
            [item.source_id for item in curated],
            ["b1", "b2", "n1", "n2", "n3", "n4", "n5"],
        )
        self.assertTrue(all(item.is_breaking for item in curated[:2]))
        self.assertTrue(all(not item.is_breaking for item in curated[2:]))

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_total_capped_at_8_when_breaking_plus_normal_exceeds_8(
        self, mock_client_cls, mock_generate
    ):
        response_items = [
            *(_make_curated_item_dict(f"n{i}", is_breaking=False) for i in range(1, 7)),
            *(_make_curated_item_dict(f"b{i}", is_breaking=True) for i in range(1, 6)),
        ]
        mock_generate.return_value = json.dumps({"curated_items": response_items})

        curated = fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN, gemini_api_key="test-gemini-key"
        )

        self.assertEqual(len(curated), 8)
        self.assertEqual(
            [item.source_id for item in curated],
            ["b1", "b2", "b3", "b4", "b5", "n1", "n2", "n3"],
        )

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_total_capped_at_8_when_more_than_8_breaking(
        self, mock_client_cls, mock_generate
    ):
        response_items = [
            *(_make_curated_item_dict(f"b{i}", is_breaking=True) for i in range(1, 11)),
            _make_curated_item_dict("n1", is_breaking=False),
            _make_curated_item_dict("n2", is_breaking=False),
        ]
        mock_generate.return_value = json.dumps({"curated_items": response_items})

        curated = fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN, gemini_api_key="test-gemini-key"
        )

        self.assertEqual(len(curated), 8)
        self.assertEqual(
            [item.source_id for item in curated],
            [f"b{i}" for i in range(1, 9)],
        )

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_empty_unseen_items_skips_gemini(self, mock_client_cls, mock_generate):
        curated = fetch_news.curate_with_gemini([], gemini_api_key="test-gemini-key")

        self.assertEqual(curated, [])
        mock_client_cls.assert_not_called()
        mock_generate.assert_not_called()

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_deduplicates_curated_items_by_source_id_keeping_first_before_cut(
        self, mock_client_cls, mock_generate
    ):
        first_n1 = _make_curated_item_dict("n1", is_breaking=False)
        first_n1["title"] = "First n1"
        dup_n1 = _make_curated_item_dict("n1", is_breaking=True)
        dup_n1["title"] = "Duplicate n1"
        first_b1 = _make_curated_item_dict("b1", is_breaking=True)
        first_b1["title"] = "First b1"
        dup_b1 = _make_curated_item_dict("b1", is_breaking=False)
        dup_b1["title"] = "Duplicate b1"

        response_items = [
            first_n1,
            dup_n1,
            first_b1,
            dup_b1,
            _make_curated_item_dict("n2", is_breaking=False),
            _make_curated_item_dict("n3", is_breaking=False),
            _make_curated_item_dict("n4", is_breaking=False),
            _make_curated_item_dict("n5", is_breaking=False),
            _make_curated_item_dict("n6", is_breaking=False),
        ]
        mock_generate.return_value = json.dumps({"curated_items": response_items})

        curated = fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN, gemini_api_key="test-gemini-key"
        )

        self.assertEqual(
            [item.source_id for item in curated],
            ["b1", "n1", "n2", "n3", "n4", "n5"],
        )
        self.assertEqual(curated[0].title, "First b1")
        self.assertTrue(curated[0].is_breaking)
        self.assertEqual(curated[1].title, "First n1")
        self.assertFalse(curated[1].is_breaking)

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_prompt_includes_recent_titles_section_when_titles_provided(
        self, mock_client_cls, mock_generate
    ):
        mock_generate.return_value = json.dumps({"curated_items": []})
        recent = [
            "Google Launches Gemini 4 Neon",
            "Java4Shell Critical RCE",
        ]

        fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN,
            gemini_api_key="test-gemini-key",
            recent_titles=recent,
        )

        mock_generate.assert_called_once()
        prompt = mock_generate.call_args.args[1]
        self.assertIn("ALREADY PUBLISHED IN THE LAST 72 HOURS", prompt)
        self.assertIn("- Google Launches Gemini 4 Neon", prompt)
        self.assertIn("- Java4Shell Critical RCE", prompt)
        self.assertIn("materially new development", prompt)
        self.assertIn("do NOT mark it breaking again", prompt)

    @mock.patch("fetch_news.generate_content_with_fallback")
    @mock.patch("fetch_news.genai.Client")
    def test_prompt_omits_recent_titles_section_when_empty_or_none(
        self, mock_client_cls, mock_generate
    ):
        mock_generate.return_value = json.dumps({"curated_items": []})

        fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN,
            gemini_api_key="test-gemini-key",
        )
        fetch_news.curate_with_gemini(
            self.SAMPLE_UNSEEN,
            gemini_api_key="test-gemini-key",
            recent_titles=[],
        )

        self.assertEqual(mock_generate.call_count, 2)
        for call in mock_generate.call_args_list:
            prompt = call.args[1]
            self.assertNotIn("ALREADY PUBLISHED IN THE LAST 72 HOURS", prompt)


class TestSaveToSupabase(unittest.TestCase):
    """Tests for save_to_supabase."""

    def test_payload_includes_is_breaking(self):
        supabase_client = mock.MagicMock()
        upsert_mock = supabase_client.table.return_value.upsert
        upsert_mock.return_value.execute.return_value = mock.MagicMock(
            data=[{"source_id": "hn_1"}]
        )
        item = _make_curated_item("hn_1", is_breaking=True)

        count = fetch_news.save_to_supabase(supabase_client, [item])

        self.assertEqual(count, 1)
        supabase_client.table.assert_called_once_with("news_items")
        upsert_mock.assert_called_once()
        payload = upsert_mock.call_args.args[0]
        self.assertEqual(upsert_mock.call_args.kwargs, {"on_conflict": "source_id"})
        self.assertEqual(len(payload), 1)
        self.assertIn("is_breaking", payload[0])
        self.assertIs(payload[0]["is_breaking"], True)
        self.assertEqual(payload[0]["source_id"], "hn_1")
        self.assertEqual(payload[0]["category"], "DEV_CLOUD")

    def test_retries_once_without_is_breaking_on_pgrst204(self):
        supabase_client = mock.MagicMock()
        upsert_mock = supabase_client.table.return_value.upsert
        upsert_mock.return_value.execute.side_effect = [
            RuntimeError("PGRST204: Could not find column in schema cache"),
            mock.MagicMock(data=[{"source_id": "hn_1"}]),
        ]
        item = _make_curated_item("hn_1", is_breaking=True)

        with self.assertLogs(fetch_news.logger, level="WARNING") as cm:
            count = fetch_news.save_to_supabase(supabase_client, [item])

        self.assertEqual(count, 1)
        self.assertEqual(upsert_mock.call_count, 2)
        first_payload = upsert_mock.call_args_list[0].args[0]
        second_payload = upsert_mock.call_args_list[1].args[0]
        self.assertIn("is_breaking", first_payload[0])
        self.assertNotIn("is_breaking", second_payload[0])
        self.assertEqual(second_payload[0]["source_id"], "hn_1")
        self.assertTrue(any("retrying upsert without 'is_breaking'" in m for m in cm.output))

    def test_reraises_non_pgrst204_error_without_retry(self):
        supabase_client = mock.MagicMock()
        upsert_mock = supabase_client.table.return_value.upsert
        upsert_mock.return_value.execute.side_effect = RuntimeError(
            "500 Internal Server Error"
        )
        item = _make_curated_item("hn_1", is_breaking=False)

        with self.assertRaisesRegex(RuntimeError, "500 Internal Server Error"):
            fetch_news.save_to_supabase(supabase_client, [item])

        self.assertEqual(upsert_mock.call_count, 1)


class TestMain(unittest.TestCase):
    """Tests for main() orchestration order and error handling."""

    SAMPLE_CANDIDATES = [
        {
            "source_id": "hn_123",
            "category": "DEV_CLOUD",
            "title": "Sample candidate",
            "url": "https://example.com/123",
            "raw_context": "Sample context",
            "event_start_date": None,
        }
    ]

    def _enter_main_mocks(self, stack, candidates):
        stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
        stack.enter_context(
            mock.patch.dict(
                os.environ,
                {
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                    "GEMINI_API_KEY": "test-gemini-key",
                },
                clear=True,
            )
        )
        stack.enter_context(mock.patch("fetch_news.fetch_cisa_kev", return_value=[]))
        stack.enter_context(
            mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
        )
        stack.enter_context(
            mock.patch("fetch_news.fetch_hacker_news", return_value=list(candidates))
        )
        stack.enter_context(
            mock.patch("fetch_news.fetch_status_incidents", return_value=[])
        )
        stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
        stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))

        fake_supabase = mock.MagicMock(name="supabase_client")
        stack.enter_context(
            mock.patch("fetch_news.create_client", return_value=fake_supabase)
        )
        mock_existing = stack.enter_context(
            mock.patch("fetch_news.get_existing_source_ids", return_value=set())
        )
        mock_recent = stack.enter_context(
            mock.patch("fetch_news.get_recent_published_titles", return_value=[])
        )
        mock_curate = stack.enter_context(mock.patch("fetch_news.curate_with_gemini"))
        mock_save = stack.enter_context(mock.patch("fetch_news.save_to_supabase"))
        mock_record = stack.enter_context(mock.patch("fetch_news.record_seen_sources"))

        return {
            "supabase": fake_supabase,
            "existing_ids": mock_existing,
            "recent_titles": mock_recent,
            "curate": mock_curate,
            "save": mock_save,
            "record_seen": mock_record,
        }

    def test_curation_error_does_not_call_record_seen_sources(self):
        with ExitStack() as stack:
            mocks = self._enter_main_mocks(stack, self.SAMPLE_CANDIDATES)
            mocks["curate"].side_effect = RuntimeError("Gemini quota exhausted")

            with self.assertRaisesRegex(RuntimeError, "Gemini quota exhausted"):
                fetch_news.main()

            mocks["save"].assert_not_called()
            mocks["record_seen"].assert_not_called()

    def test_success_saves_before_recording_seen_sources(self):
        with ExitStack() as stack:
            mocks = self._enter_main_mocks(stack, self.SAMPLE_CANDIDATES)
            curated_item = _make_curated_item("hn_123")
            mocks["curate"].return_value = [curated_item]

            call_order = []

            def _record_save(client, items):
                call_order.append(("save", client, items))
                return len(items)

            def _record_seen(client, source_ids):
                call_order.append(("record_seen", client, source_ids))

            mocks["save"].side_effect = _record_save
            mocks["record_seen"].side_effect = _record_seen

            fetch_news.main()

            self.assertEqual(
                [entry[0] for entry in call_order],
                ["save", "record_seen"],
            )
            self.assertIs(call_order[0][1], mocks["supabase"])
            self.assertEqual(call_order[0][2], [curated_item])
            self.assertIs(call_order[1][1], mocks["supabase"])
            self.assertEqual(call_order[1][2], ["hn_123"])

    def test_save_error_does_not_call_record_seen_sources(self):
        with ExitStack() as stack:
            mocks = self._enter_main_mocks(stack, self.SAMPLE_CANDIDATES)
            mocks["curate"].return_value = [_make_curated_item("hn_123")]
            mocks["save"].side_effect = RuntimeError("Supabase write error")

            with self.assertRaisesRegex(RuntimeError, "Supabase write error"):
                fetch_news.main()

            mocks["record_seen"].assert_not_called()

    def test_passes_recent_published_titles_to_curate_after_existing_ids(self):
        with ExitStack() as stack:
            mocks = self._enter_main_mocks(stack, self.SAMPLE_CANDIDATES)
            recent = ["Google Launches Gemini 4 Neon", "Java4Shell Critical RCE"]
            curated_item = _make_curated_item("hn_123")
            call_order = []

            def _get_existing(client):
                call_order.append(("get_existing_source_ids", client))
                return set()

            def _get_recent(client):
                call_order.append(("get_recent_published_titles", client))
                return list(recent)

            def _curate(unseen_items, gemini_api_key, recent_titles=None):
                call_order.append(("curate_with_gemini", unseen_items, recent_titles))
                return [curated_item]

            mocks["existing_ids"].side_effect = _get_existing
            mocks["recent_titles"].side_effect = _get_recent
            mocks["curate"].side_effect = _curate

            fetch_news.main()

            self.assertEqual(
                [entry[0] for entry in call_order],
                [
                    "get_existing_source_ids",
                    "get_recent_published_titles",
                    "curate_with_gemini",
                ],
            )
            self.assertIs(call_order[0][1], mocks["supabase"])
            self.assertIs(call_order[1][1], mocks["supabase"])
            self.assertEqual(call_order[2][1], self.SAMPLE_CANDIDATES)
            self.assertEqual(call_order[2][2], recent)
            mocks["curate"].assert_called_once_with(
                self.SAMPLE_CANDIDATES,
                gemini_api_key="test-gemini-key",
                recent_titles=recent,
            )

    def test_dry_run_with_backfill_th_logs_error_and_exits_2_without_creating_clients(self):
        with ExitStack() as stack:
            stack.enter_context(
                mock.patch.object(
                    sys, "argv", ["fetch_news.py", "--dry-run", "--backfill-th"]
                )
            )
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                    },
                    clear=True,
                )
            )
            mock_create_client = stack.enter_context(mock.patch("fetch_news.create_client"))
            mock_backfill = stack.enter_context(
                mock.patch("fetch_news.backfill_thai_translations")
            )
            mock_genai_client = stack.enter_context(mock.patch("fetch_news.genai.Client"))
            mock_fetch_hn = stack.enter_context(mock.patch("fetch_news.fetch_hacker_news"))
            mock_save = stack.enter_context(mock.patch("fetch_news.save_to_supabase"))
            mock_record = stack.enter_context(mock.patch("fetch_news.record_seen_sources"))

            with self.assertLogs(fetch_news.logger, level="ERROR") as cm:
                with self.assertRaises(SystemExit) as exit_ctx:
                    fetch_news.main()

            self.assertEqual(exit_ctx.exception.code, 2)
            self.assertTrue(
                any("--dry-run" in msg and "--backfill-th" in msg for msg in cm.output),
                f"Expected error mentioning both flags, got: {cm.output}",
            )
            mock_create_client.assert_not_called()
            mock_backfill.assert_not_called()
            mock_genai_client.assert_not_called()
            mock_fetch_hn.assert_not_called()
            mock_save.assert_not_called()
            mock_record.assert_not_called()


class _FixedTuesdayDatetime(datetime):
    """Deterministic Tuesday UTC clock so ctftime is consistently skipped."""

    @classmethod
    def now(cls, tz=None):
        fixed = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
        if tz is None:
            return fixed.replace(tzinfo=None)
        return fixed.astimezone(tz)


class TestRunReportAndExitCodes(unittest.TestCase):
    """Tests for run report tracking, GITHUB_STEP_SUMMARY output, and exit codes."""

    @staticmethod
    def _candidate(source_id, category="DEV_CLOUD"):
        return {
            "source_id": source_id,
            "category": category,
            "title": f"Candidate {source_id}",
            "url": f"https://example.com/{source_id}",
            "raw_context": f"Context for {source_id}",
            "event_start_date": None,
        }

    def test_summary_file_written_with_expected_table_rows_and_titles(self):
        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "super-secret-supabase-key",
                        "GEMINI_API_KEY": "super-secret-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_cisa_kev",
                    return_value=[self._candidate("cisa_CVE-2026-0001", "CVE_SECURITY")],
                )
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_openrouter_free_models",
                    return_value=[
                        self._candidate("openrouter_m1:free", "AI_FREE"),
                        self._candidate("openrouter_m2:free", "AI_FREE"),
                    ],
                )
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_hacker_news",
                    return_value=[self._candidate("hn_9001", "DEV_CLOUD")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))

            fake_supabase = mock.MagicMock(name="supabase_client")
            stack.enter_context(
                mock.patch("fetch_news.create_client", return_value=fake_supabase)
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.get_existing_source_ids",
                    return_value={"openrouter_m2:free"},
                )
            )

            breaking_dict = _make_curated_item_dict(
                "cisa_CVE-2026-0001", is_breaking=True, category="CVE_SECURITY"
            )
            breaking_dict["title"] = "Critical Zero-Day Exploited"
            normal_dict = _make_curated_item_dict(
                "hn_9001", is_breaking=False, category="DEV_CLOUD"
            )
            normal_dict["title"] = "OpenSSH Hardening Guide"

            mock_genai_client = mock.MagicMock()
            mock_genai_client.models.generate_content.side_effect = [
                RuntimeError("429 RESOURCE_EXHAUSTED"),
                mock.MagicMock(
                    text=json.dumps({"curated_items": [breaking_dict, normal_dict]})
                ),
            ]
            stack.enter_context(
                mock.patch("fetch_news.genai.Client", return_value=mock_genai_client)
            )
            mock_save = stack.enter_context(
                mock.patch("fetch_news.save_to_supabase", return_value=2)
            )
            mock_record = stack.enter_context(
                mock.patch("fetch_news.record_seen_sources")
            )

            with self.assertLogs(fetch_news.logger, level="WARNING"):
                fetch_news.main()

            self.assertTrue(summary_path.exists())
            content = summary_path.read_text(encoding="utf-8")
            self.assertIn("| cisa_kev | 1 | ok |", content)
            self.assertIn("| openrouter | 2 | ok |", content)
            self.assertIn("| hacker_news | 1 | ok |", content)
            self.assertIn("| status_pages | 0 | ok |", content)
            self.assertIn("| ctftime | skipped | skipped |", content)
            self.assertIn("| rss | 0 | ok |", content)
            self.assertIn("- Status: ok", content)
            self.assertIn("- Failed sources: none", content)
            self.assertIn("- Unseen candidates: 3", content)
            self.assertIn(
                f"- Gemini model: {fetch_news.MODEL_FALLBACK_CHAIN[1]}", content
            )
            self.assertIn("- Curated items: 2 (1 breaking)", content)
            self.assertIn("- [BREAKING] Critical Zero-Day Exploited", content)
            self.assertIn("- OpenSSH Hardening Guide", content)
            self.assertNotIn("super-secret-supabase-key", content)
            self.assertNotIn("super-secret-gemini-key", content)
            self.assertNotIn("example.supabase.co", content)
            mock_save.assert_called_once()
            mock_record.assert_called_once()

    def test_summary_lists_failing_source_when_fetcher_errors(self):
        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            # Let real fetch_cisa_kev execute and fail on requests.get
            stack.enter_context(
                mock.patch(
                    "fetch_news.requests.get",
                    side_effect=RuntimeError("CISA connection reset"),
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_hacker_news",
                    return_value=[self._candidate("hn_123")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.create_client"))
            stack.enter_context(
                mock.patch("fetch_news.get_existing_source_ids", return_value=set())
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.curate_with_gemini",
                    return_value=[_make_curated_item("hn_123")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.save_to_supabase", return_value=1)
            )
            stack.enter_context(mock.patch("fetch_news.record_seen_sources"))

            with self.assertLogs(fetch_news.logger, level="ERROR"):
                fetch_news.main()

            content = summary_path.read_text(encoding="utf-8")
            self.assertIn("| cisa_kev | 0 | error |", content)
            self.assertIn("| hacker_news | 1 | ok |", content)
            self.assertIn("- Failed sources: cisa_kev", content)
            self.assertIn("- Status: ok", content)

    def test_one_failing_source_still_exits_zero(self):
        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(mock.patch("fetch_news.fetch_cisa_kev", return_value=[]))
            # Let real fetch_openrouter_free_models execute and fail
            stack.enter_context(
                mock.patch(
                    "fetch_news.requests.get",
                    side_effect=RuntimeError("OpenRouter 503"),
                )
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_hacker_news",
                    return_value=[self._candidate("hn_456")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.create_client"))
            stack.enter_context(
                mock.patch("fetch_news.get_existing_source_ids", return_value=set())
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.curate_with_gemini",
                    return_value=[_make_curated_item("hn_456")],
                )
            )
            mock_save = stack.enter_context(
                mock.patch("fetch_news.save_to_supabase", return_value=1)
            )
            mock_record = stack.enter_context(
                mock.patch("fetch_news.record_seen_sources")
            )

            with self.assertLogs(fetch_news.logger, level="ERROR"):
                # Must return normally without raising SystemExit
                fetch_news.main()

            mock_save.assert_called_once()
            mock_record.assert_called_once()
            content = summary_path.read_text(encoding="utf-8")
            self.assertIn("| openrouter | 0 | error |", content)
            self.assertIn("- Failed sources: openrouter", content)
            self.assertIn("- Status: ok", content)

    def test_all_sources_zero_exits_nonzero_after_writing_summary(self):
        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.requests.get",
                    side_effect=RuntimeError("CISA unavailable"),
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_hacker_news", return_value=[])
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))
            mock_create_client = stack.enter_context(
                mock.patch("fetch_news.create_client")
            )
            mock_curate = stack.enter_context(
                mock.patch("fetch_news.curate_with_gemini")
            )
            mock_save = stack.enter_context(mock.patch("fetch_news.save_to_supabase"))
            mock_record = stack.enter_context(
                mock.patch("fetch_news.record_seen_sources")
            )

            with self.assertLogs(fetch_news.logger, level="ERROR"):
                with self.assertRaises(SystemExit) as exit_ctx:
                    fetch_news.main()

            self.assertEqual(exit_ctx.exception.code, 1)
            self.assertTrue(summary_path.exists())
            content = summary_path.read_text(encoding="utf-8")
            self.assertIn("| cisa_kev | 0 | error |", content)
            self.assertIn("| openrouter | 0 | ok |", content)
            self.assertIn("| hacker_news | 0 | ok |", content)
            self.assertIn("| status_pages | 0 | ok |", content)
            self.assertIn("| ctftime | skipped | skipped |", content)
            self.assertIn("| rss | 0 | ok |", content)
            self.assertIn("- Failed sources: cisa_kev", content)
            self.assertIn(
                "- Status: failed (all sources returned zero candidates)", content
            )
            mock_create_client.assert_not_called()
            mock_curate.assert_not_called()
            mock_save.assert_not_called()
            mock_record.assert_not_called()

    def test_summary_still_written_on_curation_failure(self):
        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(mock.patch("fetch_news.fetch_cisa_kev", return_value=[]))
            stack.enter_context(
                mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_hacker_news",
                    return_value=[self._candidate("hn_789")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.create_client"))
            stack.enter_context(
                mock.patch("fetch_news.get_existing_source_ids", return_value=set())
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.curate_with_gemini",
                    side_effect=RuntimeError("API error with secret-token-xyz"),
                )
            )
            mock_record = stack.enter_context(
                mock.patch("fetch_news.record_seen_sources")
            )

            with self.assertRaisesRegex(RuntimeError, "API error"):
                fetch_news.main()

            self.assertTrue(summary_path.exists())
            content = summary_path.read_text(encoding="utf-8")
            self.assertIn("| hacker_news | 1 | ok |", content)
            self.assertIn("- Unseen candidates: 1", content)
            self.assertIn("- Status: failed (RuntimeError)", content)
            self.assertNotIn("secret-token-xyz", content)
            self.assertNotIn("test-service-role-key", content)
            self.assertNotIn("test-gemini-key", content)
            mock_record.assert_not_called()

    def test_summary_appends_to_existing_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            summary_path.write_text("# Existing Step Output\n", encoding="utf-8")

            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(mock.patch("fetch_news.fetch_cisa_kev", return_value=[]))
            stack.enter_context(
                mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.fetch_hacker_news",
                    return_value=[self._candidate("hn_321")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.fetch_rss_feeds", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.create_client"))
            stack.enter_context(
                mock.patch("fetch_news.get_existing_source_ids", return_value=set())
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.curate_with_gemini",
                    return_value=[_make_curated_item("hn_321")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.save_to_supabase", return_value=1)
            )
            stack.enter_context(mock.patch("fetch_news.record_seen_sources"))

            fetch_news.main()

            content = summary_path.read_text(encoding="utf-8")
            self.assertTrue(
                content.startswith("# Existing Step Output\n\n## Daily Digest Run Report\n")
            )

    def test_generate_content_with_fallback_exposes_last_gemini_model(self):
        client = mock.MagicMock()
        client.models.generate_content.return_value = mock.MagicMock(
            text='{"curated_items": []}'
        )
        fetch_news.generate_content_with_fallback(
            client, "prompt", fetch_news.CuratedDigestResponse
        )
        self.assertEqual(
            fetch_news.LAST_GEMINI_MODEL, fetch_news.MODEL_FALLBACK_CHAIN[0]
        )

        client.models.generate_content.side_effect = RuntimeError("503 unavailable")
        with self.assertLogs(fetch_news.logger, level="WARNING"):
            with self.assertRaises(RuntimeError):
                fetch_news.generate_content_with_fallback(
                    client, "prompt", fetch_news.CuratedDigestResponse
                )
        self.assertIsNone(fetch_news.LAST_GEMINI_MODEL)


class TestFetchRssFeeds(unittest.TestCase):
    """Tests for fetch_rss_feeds and RSS integration in main()."""

    @staticmethod
    def _rss_doc(items_xml):
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/" '
            'xmlns:content="http://purl.org/rss/1.0/modules/content/">\n'
            "  <channel>\n"
            "    <title>Test RSS Channel</title>\n"
            f"    {items_xml}\n"
            "  </channel>\n"
            "</rss>\n"
        )

    @staticmethod
    def _atom_doc(entries_xml):
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<feed xmlns="http://www.w3.org/2005/Atom">\n'
            "  <title>Test Atom Feed</title>\n"
            f"  {entries_xml}\n"
            "</feed>\n"
        )

    def test_rss_feeds_config_has_10_feeds_and_db_allowed_categories(self):
        allowed = {"AI_FREE", "CVE_SECURITY", "CTF_COMPETITION", "DEV_CLOUD"}
        self.assertEqual(len(fetch_news.RSS_FEEDS), 10)
        slugs = [f["slug"] for f in fetch_news.RSS_FEEDS]
        self.assertEqual(len(slugs), len(set(slugs)))
        for feed in fetch_news.RSS_FEEDS:
            self.assertTrue(feed["slug"])
            self.assertTrue(feed["name"])
            self.assertTrue(feed["url"].startswith("https://"))
            self.assertIn(feed["category"], allowed)

    @mock.patch("fetch_news.requests.get")
    def test_parses_rss2_and_atom_with_namespaces_dc_date_and_alternate_link(
        self, mock_get
    ):
        now = datetime.now(timezone.utc)
        t1 = format_datetime(now - timedelta(hours=1), usegmt=True)
        t2 = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        t3 = (now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
        t4 = (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")

        rss_xml = self._rss_doc(
            f"""
            <item>
              <title>RSS Standard Entry</title>
              <link>https://vendor.example/rss-1</link>
              <pubDate>{t1}</pubDate>
              <description>Plain RSS summary.</description>
            </item>
            <item>
              <title>RSS Namespaced Entry</title>
              <link>https://vendor.example/rss-2</link>
              <dc:date>{t2}</dc:date>
              <content:encoded><![CDATA[<p>Body from content:encoded.</p>]]></content:encoded>
            </item>
            <item>
              <title>Missing Link Entry</title>
              <pubDate>{t1}</pubDate>
              <description>Should be skipped because link is absent.</description>
            </item>
            <item>
              <title>Bad Date Entry</title>
              <link>https://vendor.example/bad-date</link>
              <pubDate>not-a-valid-date</pubDate>
              <description>Should be skipped because date is unparseable.</description>
            </item>
            """
        )

        atom_xml = self._atom_doc(
            f"""
            <entry>
              <title>Atom Alternate Entry</title>
              <link rel="enclosure" href="https://atom.example/image.png" />
              <link rel="self" href="https://atom.example/self-1" />
              <link rel="alternate" type="text/html" href="https://atom.example/post-1" />
              <published>{t3}</published>
              <summary>Atom summary text.</summary>
            </entry>
            <entry>
              <title>Atom Updated Only Entry</title>
              <link href="https://atom.example/post-2" />
              <updated>{t4}</updated>
              <content type="html">&lt;div&gt;Atom content text.&lt;/div&gt;</content>
            </entry>
            """
        )

        test_feeds = [
            {
                "slug": "vendor_rss",
                "name": "Vendor RSS",
                "url": "https://vendor.example/feed.xml",
                "category": "DEV_CLOUD",
            },
            {
                "slug": "sec_atom",
                "name": "Security Atom",
                "url": "https://atom.example/feed.atom",
                "category": "CVE_SECURITY",
            },
        ]

        responses = {
            "https://vendor.example/feed.xml": _make_rss_response(rss_xml),
            "https://atom.example/feed.atom": _make_rss_response(atom_xml),
        }
        mock_get.side_effect = lambda url, *args, **kwargs: responses[url]

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            with self.assertLogs(fetch_news.logger, level="INFO") as cm:
                items = fetch_news.fetch_rss_feeds()

        self.assertNotIn("rss", fetch_news.SOURCE_ERRORS)
        self.assertEqual(len(items), 4)
        self.assertEqual(
            [item["url"] for item in items],
            [
                "https://vendor.example/rss-1",
                "https://vendor.example/rss-2",
                "https://atom.example/post-1",
                "https://atom.example/post-2",
            ],
        )
        self.assertEqual(items[0]["category"], "DEV_CLOUD")
        self.assertEqual(items[1]["category"], "DEV_CLOUD")
        self.assertEqual(items[2]["category"], "CVE_SECURITY")
        self.assertEqual(items[3]["category"], "CVE_SECURITY")
        self.assertIn("Plain RSS summary.", items[0]["raw_context"])
        self.assertIn("Body from content:encoded.", items[1]["raw_context"])
        self.assertIn("Atom summary text.", items[2]["raw_context"])
        self.assertIn("Atom content text.", items[3]["raw_context"])
        self.assertTrue(all(item["event_start_date"] is None for item in items))

        for call in mock_get.call_args_list:
            self.assertEqual(call.kwargs["timeout"], 15)
            self.assertEqual(
                call.kwargs["headers"]["User-Agent"],
                "SecDigestBot/1.0 (+https://secdigest.vercel.app)",
            )

        self.assertTrue(
            any(
                "RSS: Fetched 4 items from 2/2 feeds in last 36h." in msg
                for msg in cm.output
            ),
            f"Expected summary log line, got: {cm.output}",
        )

    @mock.patch("fetch_news.requests.get")
    def test_filters_items_older_than_36_hours(self, mock_get):
        now = datetime.now(timezone.utc)
        t_1h = format_datetime(now - timedelta(hours=1), usegmt=True)
        t_35h = format_datetime(now - timedelta(hours=35), usegmt=True)
        t_37h = format_datetime(now - timedelta(hours=37), usegmt=True)
        t_72h = (now - timedelta(hours=72)).strftime("%Y-%m-%dT%H:%M:%SZ")

        rss_xml = self._rss_doc(
            f"""
            <item>
              <title>Within 35h</title>
              <link>https://example.com/35h</link>
              <pubDate>{t_35h}</pubDate>
              <description>Still fresh.</description>
            </item>
            <item>
              <title>Too Old 37h</title>
              <link>https://example.com/37h</link>
              <pubDate>{t_37h}</pubDate>
              <description>Expired.</description>
            </item>
            <item>
              <title>Fresh 1h</title>
              <link>https://example.com/1h</link>
              <pubDate>{t_1h}</pubDate>
              <description>Very fresh.</description>
            </item>
            <item>
              <title>Way Old 72h</title>
              <link>https://example.com/72h</link>
              <dc:date>{t_72h}</dc:date>
              <description>Way expired.</description>
            </item>
            """
        )

        test_feeds = [
            {
                "slug": "window_test",
                "name": "Window Test",
                "url": "https://example.com/window.xml",
                "category": "CVE_SECURITY",
            }
        ]
        mock_get.return_value = _make_rss_response(rss_xml)

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            items = fetch_news.fetch_rss_feeds()

        self.assertEqual(
            [item["url"] for item in items],
            ["https://example.com/1h", "https://example.com/35h"],
        )

    @mock.patch("fetch_news.requests.get")
    def test_per_feed_cap_5_and_total_cap_30_newest_first(self, mock_get):
        now = datetime.now(timezone.utc)
        test_feeds = []
        responses = {}
        expected_after_per_feed_cap = []

        # Feed 0 has 7 very recent items (ages 10..70m) in scrambled order; only top 5 must survive.
        feed0_ages = [50, 20, 70, 10, 60, 30, 40]
        feed0_items_xml = []
        for idx, age_min in enumerate(feed0_ages):
            pub_str = format_datetime(now - timedelta(minutes=age_min), usegmt=True)
            link = f"https://feed0.example/post-{age_min}"
            feed0_items_xml.append(
                f"<item><title>Feed0 {idx}</title><link>{link}</link>"
                f"<pubDate>{pub_str}</pubDate><description>Body</description></item>"
            )
            if age_min <= 50:
                expected_after_per_feed_cap.append((age_min, link))

        test_feeds.append(
            {
                "slug": "feed0",
                "name": "Feed 0",
                "url": "https://feed0.example/rss.xml",
                "category": "DEV_CLOUD",
            }
        )
        responses["https://feed0.example/rss.xml"] = _make_rss_response(
            self._rss_doc("\n".join(feed0_items_xml))
        )

        # Feeds 1..7 each have 5 items (35 total) with unique ages 200..600m -> 40 total after per-feed cap.
        for f_idx in range(1, 8):
            url = f"https://feed{f_idx}.example/rss.xml"
            test_feeds.append(
                {
                    "slug": f"feed{f_idx}",
                    "name": f"Feed {f_idx}",
                    "url": url,
                    "category": "CVE_SECURITY",
                }
            )
            xml_parts = []
            for i_idx in range(5):
                age_min = 200 + f_idx * 50 + i_idx * 7
                pub_str = format_datetime(now - timedelta(minutes=age_min), usegmt=True)
                link = f"https://feed{f_idx}.example/post-{age_min}"
                xml_parts.append(
                    f"<item><title>Feed{f_idx} {i_idx}</title><link>{link}</link>"
                    f"<pubDate>{pub_str}</pubDate><description>Body</description></item>"
                )
                expected_after_per_feed_cap.append((age_min, link))
            responses[url] = _make_rss_response(self._rss_doc("\n".join(xml_parts)))

        mock_get.side_effect = lambda url, *args, **kwargs: responses[url]

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            items = fetch_news.fetch_rss_feeds()

        expected_top_30_urls = [
            link for _, link in sorted(expected_after_per_feed_cap, key=lambda p: p[0])[:30]
        ]

        self.assertEqual(len(items), 30)
        self.assertEqual([item["url"] for item in items], expected_top_30_urls)
        feed0_returned = [item for item in items if item["source_id"].startswith("rss_feed0_")]
        self.assertEqual(len(feed0_returned), 5)
        self.assertNotIn("https://feed0.example/post-60", [item["url"] for item in items])
        self.assertNotIn("https://feed0.example/post-70", [item["url"] for item in items])

    @mock.patch("fetch_news.requests.get")
    def test_source_id_is_stable_across_runs_and_matches_sha1_format(self, mock_get):
        now = datetime.now(timezone.utc)
        pub_str = format_datetime(now - timedelta(hours=1), usegmt=True)
        link = "https://openai.com/news/stable-launch-post/"
        rss_xml = self._rss_doc(
            f"""
            <item>
              <title>Stable Launch</title>
              <link>{link}</link>
              <pubDate>{pub_str}</pubDate>
              <description>Details here.</description>
            </item>
            """
        )
        test_feeds = [
            {
                "slug": "openai",
                "name": "OpenAI News",
                "url": "https://openai.com/news/rss.xml",
                "category": "DEV_CLOUD",
            }
        ]
        mock_get.side_effect = lambda *args, **kwargs: _make_rss_response(rss_xml)

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            first_run = fetch_news.fetch_rss_feeds()
            second_run = fetch_news.fetch_rss_feeds()

        expected_id = f"rss_openai_{hashlib.sha1(link.encode('utf-8')).hexdigest()[:12]}"
        self.assertEqual(first_run[0]["source_id"], expected_id)
        self.assertEqual(second_run[0]["source_id"], expected_id)

    @mock.patch("fetch_news.requests.get")
    def test_strips_html_tags_unescapes_entities_collapses_whitespace_and_truncates(
        self, mock_get
    ):
        now = datetime.now(timezone.utc)
        t1 = format_datetime(now - timedelta(hours=1), usegmt=True)
        t2 = format_datetime(now - timedelta(hours=2), usegmt=True)
        long_body = "<p>" + ("word " * 150) + "</p>"

        rss_xml = self._rss_doc(
            f"""
            <item>
              <title><![CDATA[Zero-Day &amp; <b>RCE</b> Advisory]]></title>
              <link>https://sec.example/html-item</link>
              <pubDate>{t1}</pubDate>
              <description><![CDATA[
                <script>alert('xss')</script>
                <style>.hidden {{ display: none; }}</style>
                <!-- internal note -->
                <p>First &amp; <b>bold</b><br/>Line&nbsp;&nbsp;&nbsp;two &quot;quoted&quot; &lt;tag&gt;.</p>
              ]]></description>
            </item>
            <item>
              <title>Long Summary Item</title>
              <link>https://sec.example/long-item</link>
              <pubDate>{t2}</pubDate>
              <description><![CDATA[{long_body}]]></description>
            </item>
            """
        )
        test_feeds = [
            {
                "slug": "sec_blog",
                "name": "Sec Blog",
                "url": "https://sec.example/feed.xml",
                "category": "CVE_SECURITY",
            }
        ]
        mock_get.return_value = _make_rss_response(rss_xml)

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            items = fetch_news.fetch_rss_feeds()

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["title"], "Zero-Day & RCE Advisory")
        ctx0 = items[0]["raw_context"]
        self.assertIn('First & bold Line two "quoted" <tag>.', ctx0)
        self.assertNotIn("<p>", ctx0)
        self.assertNotIn("<b>", ctx0)
        self.assertNotIn("alert('xss')", ctx0)
        self.assertNotIn(".hidden", ctx0)
        self.assertNotIn("internal note", ctx0)

        summary_line = items[1]["raw_context"].split("Summary: ", 1)[1]
        self.assertLessEqual(len(summary_line), 400)
        self.assertTrue(summary_line.endswith("..."))

    @mock.patch("fetch_news.requests.get")
    def test_malformed_feed_logs_error_sets_source_errors_and_others_still_return(
        self, mock_get
    ):
        now = datetime.now(timezone.utc)
        t1 = format_datetime(now - timedelta(hours=1), usegmt=True)
        valid_xml = self._rss_doc(
            f"""
            <item>
              <title>Good Feed Item</title>
              <link>https://good.example/post-1</link>
              <pubDate>{t1}</pubDate>
              <description>Valid summary.</description>
            </item>
            """
        )

        test_feeds = [
            {
                "slug": "broken_xml",
                "name": "Broken XML Feed",
                "url": "https://broken.example/feed.xml",
                "category": "DEV_CLOUD",
            },
            {
                "slug": "timeout_feed",
                "name": "Timeout Feed",
                "url": "https://timeout.example/feed.xml",
                "category": "CVE_SECURITY",
            },
            {
                "slug": "good_feed",
                "name": "Good Feed",
                "url": "https://good.example/feed.xml",
                "category": "CVE_SECURITY",
            },
        ]

        def _fake_get(url, *args, **kwargs):
            if url == "https://broken.example/feed.xml":
                return _make_rss_response(b"<rss><channel><item><title>unclosed")
            if url == "https://timeout.example/feed.xml":
                raise RuntimeError("read timed out")
            return _make_rss_response(valid_xml)

        mock_get.side_effect = _fake_get

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            with self.assertLogs(fetch_news.logger, level="ERROR") as cm:
                items = fetch_news.fetch_rss_feeds()

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["url"], "https://good.example/post-1")
        self.assertTrue(any("Broken XML Feed" in msg for msg in cm.output))
        self.assertTrue(any("Timeout Feed" in msg for msg in cm.output))
        self.assertIn("rss", fetch_news.SOURCE_ERRORS)
        self.assertIn("Broken XML Feed", fetch_news.SOURCE_ERRORS["rss"])
        self.assertIn("Timeout Feed", fetch_news.SOURCE_ERRORS["rss"])

    @mock.patch("fetch_news.requests.get")
    def test_rejects_oversized_response_by_header_and_stream_size(self, mock_get):
        now = datetime.now(timezone.utc)
        t1 = format_datetime(now - timedelta(hours=1), usegmt=True)
        valid_xml = self._rss_doc(
            f"""
            <item>
              <title>Small Valid Item</title>
              <link>https://small.example/post-1</link>
              <pubDate>{t1}</pubDate>
              <description>Small feed body.</description>
            </item>
            """
        )

        test_feeds = [
            {
                "slug": "huge_header",
                "name": "Huge Header Feed",
                "url": "https://huge-header.example/feed.xml",
                "category": "DEV_CLOUD",
            },
            {
                "slug": "huge_stream",
                "name": "Huge Stream Feed",
                "url": "https://huge-stream.example/feed.xml",
                "category": "DEV_CLOUD",
            },
            {
                "slug": "small_feed",
                "name": "Small Feed",
                "url": "https://small.example/feed.xml",
                "category": "DEV_CLOUD",
            },
        ]

        header_resp = _make_rss_response(
            b"<rss/>",
            headers={"Content-Length": str(fetch_news.RSS_MAX_BYTES + 1024)},
        )
        stream_resp = _make_rss_response(
            chunks=[b"a" * (1024 * 1024) for _ in range(6)],
            headers={},
        )
        small_resp = _make_rss_response(valid_xml)

        responses = {
            "https://huge-header.example/feed.xml": header_resp,
            "https://huge-stream.example/feed.xml": stream_resp,
            "https://small.example/feed.xml": small_resp,
        }
        mock_get.side_effect = lambda url, *args, **kwargs: responses[url]

        with mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds):
            with self.assertLogs(fetch_news.logger, level="ERROR") as cm:
                items = fetch_news.fetch_rss_feeds()

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["url"], "https://small.example/post-1")
        header_resp.iter_content.assert_not_called()
        header_resp.close.assert_called_once()
        stream_resp.close.assert_called_once()
        self.assertTrue(any("Huge Header Feed" in msg for msg in cm.output))
        self.assertTrue(any("Huge Stream Feed" in msg for msg in cm.output))
        self.assertIn("rss", fetch_news.SOURCE_ERRORS)
        self.assertIn("Huge Header Feed", fetch_news.SOURCE_ERRORS["rss"])
        self.assertIn("Huge Stream Feed", fetch_news.SOURCE_ERRORS["rss"])

    def test_dry_run_counts_line_contains_rss(self):
        rss_candidates = [
            {
                "source_id": "rss_openai_0123456789ab",
                "category": "DEV_CLOUD",
                "title": "OpenAI Release",
                "url": "https://openai.com/news/release",
                "raw_context": "Source: OpenAI News",
                "event_start_date": None,
            },
            {
                "source_id": "rss_krebs_fedcba987654",
                "category": "CVE_SECURITY",
                "title": "Krebs Investigation",
                "url": "https://krebsonsecurity.com/2026/11/post/",
                "raw_context": "Source: Krebs on Security",
                "event_start_date": None,
            },
        ]
        stdout_buf = io.StringIO()
        with ExitStack() as stack:
            stack.enter_context(
                mock.patch.object(sys, "argv", ["fetch_news.py", "--dry-run"])
            )
            stack.enter_context(mock.patch.dict(os.environ, {}, clear=True))
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(mock.patch("fetch_news.fetch_cisa_kev", return_value=[]))
            stack.enter_context(
                mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_hacker_news", return_value=[])
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(
                mock.patch("fetch_news.fetch_rss_feeds", return_value=rss_candidates)
            )
            mock_create_client = stack.enter_context(
                mock.patch("fetch_news.create_client")
            )
            mock_curate = stack.enter_context(
                mock.patch("fetch_news.curate_with_gemini")
            )

            with redirect_stdout(stdout_buf):
                fetch_news.main()

            mock_create_client.assert_not_called()
            mock_curate.assert_not_called()

        output = stdout_buf.getvalue()
        self.assertIn("--- DRY RUN SOURCE COUNTS ---", output)
        counts_section = output.split("--- DRY RUN SOURCE COUNTS ---", 1)[1]
        counts_line = counts_section.strip().splitlines()[0]
        self.assertIn("rss: 2", counts_line)

    def test_summary_records_rss_error_and_keeps_valid_rss_candidates(self):
        now = _FixedTuesdayDatetime.now(timezone.utc)
        t1 = format_datetime(now - timedelta(hours=1), usegmt=True)
        valid_xml = self._rss_doc(
            f"""
            <item>
              <title>AWS Bulletin</title>
              <link>https://aws.amazon.com/security/bulletin-1</link>
              <pubDate>{t1}</pubDate>
              <description>Security advisory.</description>
            </item>
            """
        )
        test_feeds = [
            {
                "slug": "aws_security",
                "name": "AWS Security Bulletins",
                "url": "https://aws.amazon.com/security/security-bulletins/rss/feed/",
                "category": "CVE_SECURITY",
            },
            {
                "slug": "broken",
                "name": "Broken Feed",
                "url": "https://broken.example/feed/",
                "category": "DEV_CLOUD",
            },
        ]

        def _fake_get(url, *args, **kwargs):
            if url == "https://broken.example/feed/":
                return _make_rss_response(b"<rss><broken")
            return _make_rss_response(valid_xml)

        with tempfile.TemporaryDirectory() as tmp_dir, ExitStack() as stack:
            summary_path = Path(tmp_dir) / "step_summary.md"
            stack.enter_context(mock.patch.object(sys, "argv", ["fetch_news.py"]))
            stack.enter_context(
                mock.patch.dict(
                    os.environ,
                    {
                        "SUPABASE_URL": "https://example.supabase.co",
                        "SUPABASE_SERVICE_ROLE_KEY": "test-service-role-key",
                        "GEMINI_API_KEY": "test-gemini-key",
                        "GITHUB_STEP_SUMMARY": str(summary_path),
                    },
                    clear=True,
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.datetime", _FixedTuesdayDatetime)
            )
            stack.enter_context(mock.patch.object(fetch_news, "RSS_FEEDS", test_feeds))
            stack.enter_context(
                mock.patch("fetch_news.requests.get", side_effect=_fake_get)
            )
            stack.enter_context(mock.patch("fetch_news.fetch_cisa_kev", return_value=[]))
            stack.enter_context(
                mock.patch("fetch_news.fetch_openrouter_free_models", return_value=[])
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_hacker_news", return_value=[])
            )
            stack.enter_context(
                mock.patch("fetch_news.fetch_status_incidents", return_value=[])
            )
            stack.enter_context(mock.patch("fetch_news.fetch_ctftime", return_value=[]))
            stack.enter_context(mock.patch("fetch_news.create_client"))
            stack.enter_context(
                mock.patch("fetch_news.get_existing_source_ids", return_value=set())
            )
            stack.enter_context(
                mock.patch(
                    "fetch_news.curate_with_gemini",
                    return_value=[_make_curated_item("rss_aws_security_000000000000")],
                )
            )
            stack.enter_context(
                mock.patch("fetch_news.save_to_supabase", return_value=1)
            )
            stack.enter_context(mock.patch("fetch_news.record_seen_sources"))

            with self.assertLogs(fetch_news.logger, level="ERROR"):
                fetch_news.main()

            content = summary_path.read_text(encoding="utf-8")
            self.assertIn("| rss | 1 | error |", content)
            self.assertIn("- Failed sources: rss", content)
            self.assertIn("- Status: ok", content)


if __name__ == "__main__":
    unittest.main()
