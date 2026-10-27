#!/usr/bin/env python3
"""
Refill Practice cards only when a language is running low.

Runs in the daily workflow after news ingestion. For each language (priority
order: Python, C, JS, Java) it compares the learner's unseen cards with their
recent pace. A language gets a new batch only when fewer than ~14 days of
unseen cards are left; otherwise the run spends zero Gemini quota.

Every generated card is vetted by scripts/verify_practice_cards.py before it
is stored: the code is actually compiled and run (scrubbed env, timeout, C with
sanitizers), the marked answer must be the real output, reorder cards must
have exactly one working order, and bug cards must come with a fix that
works. Cards that fail any check are dropped.

Usage:
    python scripts/generate_practice_cards.py                # auto: refill only if low
    python scripts/generate_practice_cards.py --force-lang c # one batch for C now
    python scripts/generate_practice_cards.py --dry-run      # plan only, no Gemini, no writes
    python scripts/generate_practice_cards.py --offline --force-lang python --input-json batch.json
        # vet a saved Gemini response locally without Supabase or Gemini
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field

# Reuse the news pipeline's Gemini fallback chain (and its logging / .env setup).
from fetch_news import generate_content_with_fallback
import verify_practice_cards as verify

logger = logging.getLogger("practice_refill")

PRIORITY = ("python", "c", "js", "java")
LANG_LABEL = {"python": "Python", "c": "C", "js": "JavaScript", "java": "Java"}
# Minimum unseen cards to keep per language once it is being practiced.
FLOOR = {"python": 10, "c": 6, "js": 4, "java": 4}
BUFFER_DAYS = 14
PACE_WINDOW_DAYS = 14
BATCH_SIZE = 12
MAX_BATCHES_PER_RUN = 2
TOPICS_PER_BATCH = 2

HARNESS = {
    "python": "a complete Python 3.11 script that prints with print()",
    "js": "a complete Node.js script (no require/import) that prints with console.log(); print strings or numbers "
          "and use .join(' ') for arrays",
    "c": "statements that go inside int main(void); <stdio.h>, <stdlib.h> and <string.h> are already included and "
         "`return 0;` is added for you. Print with printf. If the program needs its own functions, set full=true and "
         "write the complete program including #include lines and main",
    "java": "statements that go inside main(String[] args) of `public class Main`, with java.util.* already imported. "
            "Print with System.out.println. If it needs other methods, set full=true and write the complete "
            "`public class Main`",
}


# --- Gemini response schema -------------------------------------------------

class GenKind(str, Enum):
    OUTPUT = "output"
    ORDER = "order"
    BUG = "bug"


class GeneratedCard(BaseModel):
    kind: GenKind = Field(description="output, order, or bug")
    topic: str = Field(description="One of the requested topics, spelled exactly")
    prompt: str = Field(description="Short question shown above the exercise")
    explanation: str = Field(description="1-3 plain-English sentences explaining WHY")
    code: Optional[str] = Field(default=None, description="output cards: the program")
    choices: Optional[list[str]] = Field(default=None, description="output cards: 4 exact outputs, one correct")
    answer: Optional[int] = Field(default=None, description="output cards: index of the correct choice")
    raises: Optional[str] = Field(default=None, description="output cards that crash: the error name, also the correct choice")
    lines: Optional[list[str]] = Field(default=None, description="order/bug cards: program lines with indentation")
    bugLine: Optional[int] = Field(default=None, description="bug cards: 0-based index of the buggy line")
    fixedLine: Optional[str] = Field(default=None, description="bug cards: corrected version of the buggy line")
    expectOutput: Optional[str] = Field(default=None, description="order cards: exact output; bug cards: output of the FIXED program")
    full: Optional[bool] = Field(default=None, description="C/Java only: true if the code is a complete program")


class GeneratedBatch(BaseModel):
    cards: list[GeneratedCard] = Field(default_factory=list)


# --- planning ---------------------------------------------------------------

@dataclass
class LangPlan:
    lang: str
    total: int
    unseen: int
    pace: float
    target: int
    reason: Optional[str] = None
    topics: list[str] = field(default_factory=list)


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def topic_path(bundled: list[dict]) -> list[str]:
    """Topics in learning-path order, as they first appear in the starter bank."""
    return list(dict.fromkeys(card["topic"] for card in bundled))


def plan_refills(cards_by_lang: dict[str, list[dict]], reviews: list[dict], now: datetime, force_lang: Optional[str]) -> list[LangPlan]:
    seen = {r["card_id"] for r in reviews}
    since = now - timedelta(days=PACE_WINDOW_DAYS)
    plans = []
    for lang in PRIORITY:
        cards = cards_by_lang.get(lang, [])
        unseen = sum(1 for c in cards if c["id"] not in seen)
        introduced = sum(1 for r in reviews if r.get("lang") == lang and parse_ts(r["introduced_at"]) >= since)
        pace = introduced / PACE_WINDOW_DAYS
        target = max(FLOOR[lang], math.ceil(pace * BUFFER_DAYS)) if introduced else 0
        plan = LangPlan(lang, len(cards), unseen, pace, target)
        if force_lang == lang:
            plan.reason = "forced from workflow input"
        elif introduced and unseen < target:
            plan.reason = f"{unseen} unseen < {target} needed for {BUFFER_DAYS} days at {pace:.1f}/day"
        plans.append(plan)
    return plans


def choose_topics(path: list[str], cards: list[dict], reviews_by_id: dict[str, dict], k: int = TOPICS_PER_BATCH) -> list[str]:
    """The topic missed most often (by lapses per seen card), then the topics with the fewest cards."""
    counts = Counter(c["topic"] for c in cards)
    lapses: Counter[str] = Counter()
    seen: Counter[str] = Counter()
    for card in cards:
        review = reviews_by_id.get(card["id"])
        if review:
            seen[card["topic"]] += 1
            lapses[card["topic"]] += int((review.get("fsrs") or {}).get("lapses", 0))
    chosen: list[str] = []
    struggling = [t for t in path if lapses[t] > 0]
    if struggling:
        chosen.append(max(struggling, key=lambda t: (lapses[t] / max(seen[t], 1), -path.index(t))))
    for topic in sorted(path, key=lambda t: (counts[t], path.index(t))):
        if len(chosen) >= k:
            break
        if topic not in chosen:
            chosen.append(topic)
    return chosen


# --- prompt -----------------------------------------------------------------

def existing_digest(cards: list[dict], topics: list[str], limit: int = 40) -> str:
    """Short fingerprints of existing cards so Gemini avoids repeating them."""
    rows = []
    for card in cards:
        if card["topic"] not in topics:
            continue
        code = card.get("code") or "\n".join(card.get("lines") or []) or " | ".join(c["code"] for c in card.get("choices", []) if isinstance(c, dict))
        first = " / ".join(line.strip() for line in code.split("\n") if line.strip())[:110]
        rows.append(f"- [{card['topic']}] {first}")
    return "\n".join(rows[-limit:]) or "- (none yet)"


def build_prompt(lang: str, topics: list[str], cards: list[dict], n: int) -> str:
    label = LANG_LABEL[lang]
    return f"""You write practice cards for a mobile spaced-repetition app. The learner is a 2nd-year Computer Science
student who knows the basics of {label} and wants to keep it fresh in a few minutes a day. Write in clear, concise,
professional English.

Write {n} NEW {label} cards about these topics, spread across them: {", ".join(topics)}.
Use the topic names exactly as written. Go one level deeper than the basics: common pitfalls, behaviour that
differs from other languages, and idioms worth remembering.

Card kinds (about half "output", the rest split between "order" and "bug"):
- output: `code` is a short program; `choices` has exactly 4 entries: the EXACT text it prints plus 3 plausible
  wrong outputs that reflect real misconceptions; `answer` is the index of the correct one. If the program crashes,
  put the error name (e.g. ZeroDivisionError, TypeError, ArithmeticException) in `raises` and as the correct choice.
- order: `lines` is a 4-8 line program in the CORRECT order, with indentation. It must have exactly ONE valid order:
  every line should depend on the one before it (no two independent statements that could be swapped).
  `expectOutput` is exactly what it prints.
- bug: `lines` is a runnable program with exactly ONE buggy line; `bugLine` is its 0-based index; `fixedLine` is
  that line corrected (same indentation); `expectOutput` is what the FIXED program prints. The buggy program must
  crash or print something different. `prompt` should describe the symptom, e.g. "This should print 6 but prints 3.
  Which line is wrong?"

Code rules (every card is executed to check it; cards that fail are discarded):
- Code is {HARNESS[lang]}.
- Output must be deterministic: no randomness, dates/times, user input, files, network, environment variables,
  threads, or printing unordered collections (e.g. a Python set of strings).
- No undefined behavior in C; it is compiled with AddressSanitizer and UBSan.
- At most 14 lines; every line at most 60 characters, so it fits a phone screen.
- Educational fundamentals only.

`prompt`: a short question such as "What does this print?". `explanation`: 1-3 sentences on WHY, mentioning how
another language differs when that helps.

Existing cards on these topics (do NOT repeat them):
{existing_digest(cards, topics)}
"""


# --- vetting ----------------------------------------------------------------

def clean_code(text: str) -> str:
    text = re.sub(r"^```[a-zA-Z]*\n|\n?```$", "", text.strip("\n"))
    lines = [line.replace("\t", "    ").rstrip() for line in text.split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def to_card(gen: GeneratedCard, lang: str, card_id: str, topics: list[str]) -> dict[str, Any]:
    card: dict[str, Any] = {
        "id": card_id,
        "lang": lang,
        "topic": gen.topic if gen.topic in topics else topics[0],
        "kind": gen.kind.value,
        "prompt": gen.prompt.strip(),
        "explanation": gen.explanation.strip(),
        "generated": True,
    }
    if gen.kind == GenKind.OUTPUT:
        card["code"] = clean_code(gen.code or "")
        card["choices"] = [c.rstrip() for c in (gen.choices or [])]
        card["answer"] = gen.answer if gen.answer is not None else -1
        if gen.raises:
            card["raises"] = gen.raises.strip()
    else:
        card["lines"] = clean_code("\n".join(gen.lines or [])).split("\n")
        if gen.expectOutput is not None:
            card["expectOutput"] = gen.expectOutput.strip("\n")
        if gen.kind == GenKind.BUG:
            card["bugLine"] = gen.bugLine if gen.bugLine is not None else -1
            if gen.fixedLine:
                card["fixedLine"] = gen.fixedLine.replace("\t", "    ").rstrip()
    if gen.full and lang in ("c", "java"):
        card["full"] = True
    return card


def fingerprint(card: dict) -> str:
    code = card.get("code") or "\n".join(card.get("lines") or [])
    return re.sub(r"\s+", "", code)


def vet(card: dict, seen_ids: set[str], fingerprints: set[str]) -> list[str]:
    """Static checks first (including the denylist), and only then run the code."""
    problems = verify.check_structure(card, seen_ids) + verify.check_generated(card)
    fp = fingerprint(card)
    if fp in fingerprints:
        problems.append("duplicates an existing card")
    if problems:
        return problems
    try:
        problems = verify.check_execution(card)
    except subprocess.TimeoutExpired:
        problems = ["timed out"]
    if not problems:
        fingerprints.add(fp)
    return problems


def next_ids(lang: str, now: datetime, taken: set[str], n: int) -> list[str]:
    prefix = f"{verify.ID_PREFIX[lang]}g{now:%Y%m%d}-"
    ids, i = [], 1
    while len(ids) < n:
        candidate = f"{prefix}{i:02d}"
        if candidate not in taken:
            ids.append(candidate)
        i += 1
    return ids


# --- Supabase I/O -----------------------------------------------------------

def is_missing_table(error: Exception) -> bool:
    text = str(error)
    return any(s in text for s in ("PGRST205", "42P01", "Could not find the table", "does not exist"))


def select_all(client: Any, table: str, columns: str) -> list[dict]:
    """Page through a table (PostgREST returns at most 1000 rows per request)."""
    rows: list[dict] = []
    start = 0
    while True:
        batch = client.table(table).select(columns).range(start, start + 999).execute().data or []
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        start += 1000


def load_bundled() -> dict[str, list[dict]]:
    return {lang: json.loads((verify.CARDS_DIR / f"{lang}.json").read_text()) for lang in PRIORITY}


def connect() -> Any:
    from supabase import create_client

    raw_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    url = raw_url.strip().rstrip("/") if raw_url else None
    if url and url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")].rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (writing cards needs the service role key).")
    return create_client(url, key)


# --- main -------------------------------------------------------------------

def main() -> int:
    env_force = (os.getenv("PRACTICE_FORCE_LANG") or "").strip().lower()
    parser = argparse.ArgumentParser(description="Refill Practice cards when running low")
    parser.add_argument("--force-lang", choices=PRIORITY, default=env_force if env_force in PRIORITY else None,
                        help="generate one batch for this language even if it is not low (env: PRACTICE_FORCE_LANG)")
    parser.add_argument("--dry-run", action="store_true", help="show the plan (and vet --input-json) without calling Gemini or writing")
    parser.add_argument("--offline", action="store_true", help="skip Supabase: no review history, no writes (implies --dry-run)")
    parser.add_argument("--input-json", type=Path, help="use a saved Gemini response instead of calling Gemini")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    args = parser.parse_args()
    dry_run = args.dry_run or args.offline
    now = datetime.now(timezone.utc)

    bundled = load_bundled()
    client = None
    generated_rows: list[dict] = []
    reviews: list[dict] = []
    cards_table_ok = True
    if not args.offline:
        client = connect()
        try:
            generated_rows = select_all(client, "practice_cards", "id,lang,topic,kind,card,active")
        except Exception as e:  # noqa: BLE001 - surfaced as a clear log line
            if not is_missing_table(e):
                raise
            cards_table_ok = False
            logger.warning("public.practice_cards not found. Run supabase_phase10_practice_cards.sql to enable refills.")
        try:
            reviews = select_all(client, "practice_reviews", "card_id,lang,introduced_at,fsrs")
        except Exception as e:  # noqa: BLE001
            if not is_missing_table(e):
                raise
            logger.warning("public.practice_reviews not found (phase 9 migration not run); assuming no practice yet.")

    cards_by_lang = {
        lang: bundled[lang] + [r["card"] for r in generated_rows if r["lang"] == lang and r.get("active", True)]
        for lang in PRIORITY
    }
    reviews_by_id = {r["card_id"]: r for r in reviews}
    taken_ids = {c["id"] for cards in bundled.values() for c in cards} | {r["id"] for r in generated_rows}

    plans = plan_refills(cards_by_lang, reviews, now, args.force_lang)
    for p in plans:
        need = f"keep >= {p.target}" if p.target else f"not practiced in {PACE_WINDOW_DAYS} days"
        logger.info("[%s] %d cards, %d unseen, pace %.1f/day, %s -> %s",
                    p.lang, p.total, p.unseen, p.pace, need, p.reason or "enough, skipping")
    selected = sorted((p for p in plans if p.reason), key=lambda p: (p.reason != "forced from workflow input", PRIORITY.index(p.lang)))
    selected = selected[:MAX_BATCHES_PER_RUN]
    if not selected:
        logger.info("Every language has enough unseen cards. No Gemini calls today.")
        return 0
    if not cards_table_ok and not dry_run:
        logger.error("Refill needed but public.practice_cards is missing. Run supabase_phase10_practice_cards.sql.")
        return 1
    if args.input_json:
        selected = selected[:1]

    gemini_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    total_saved = 0
    for plan in selected:
        lang = plan.lang
        plan.topics = choose_topics(topic_path(bundled[lang]), cards_by_lang[lang], reviews_by_id)
        logger.info("[%s] Refilling: %s. Topics: %s", lang, plan.reason, ", ".join(plan.topics))

        if args.input_json:
            raw = args.input_json.read_text()
        elif dry_run:
            logger.info("[%s] Dry run: would ask Gemini for %d cards.", lang, args.batch_size)
            continue
        else:
            if not gemini_key:
                logger.error("GEMINI_API_KEY is not set.")
                return 1
            from google import genai

            prompt = build_prompt(lang, plan.topics, cards_by_lang[lang], args.batch_size)
            raw = generate_content_with_fallback(genai.Client(api_key=gemini_key), prompt, GeneratedBatch)
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        batch = GeneratedBatch.model_validate_json(raw)

        fingerprints = {fingerprint(c) for c in cards_by_lang[lang]}
        ids = next_ids(lang, now, taken_ids, len(batch.cards))
        accepted: list[dict] = []
        for gen, card_id in zip(batch.cards, ids):
            card = to_card(gen, lang, card_id, plan.topics)
            problems = vet(card, set(taken_ids), fingerprints)
            if problems:
                logger.info("  reject %s (%s): %s", card_id, card["kind"], "; ".join(problems))
            else:
                logger.info("  accept %s (%s, %s)", card_id, card["kind"], card["topic"])
                accepted.append(card)
                taken_ids.add(card_id)
        logger.info("[%s] %d of %d generated cards passed verification.", lang, len(accepted), len(batch.cards))

        if accepted and not dry_run and client is not None:
            client.table("practice_cards").insert([
                {"id": c["id"], "lang": lang, "topic": c["topic"], "kind": c["kind"], "card": c, "verified_at": now.isoformat()}
                for c in accepted
            ]).execute()
            total_saved += len(accepted)

    logger.info("=== Practice refill done: %d new card(s) saved ===", total_saved)
    return 0


if __name__ == "__main__":
    sys.exit(main())
