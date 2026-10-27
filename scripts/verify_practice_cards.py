"""Verify the Practice card bank by running the code for real.

Checks every card in lib/practice/cards/*.json:
  - structure (ids, required fields, answer indexes in range, unique choices)
  - "output" cards: the snippet's real stdout must equal the marked answer,
    and must NOT equal any of the wrong choices
  - "output" cards with `raises`: the program must fail with that error
  - "order" cards with `expectOutput`: the correctly ordered code must print it

C and Java snippets are wrapped in a main() template unless the card sets
`full: true`. Requires python3, node, gcc, and a JDK (java) on PATH; a missing
toolchain is reported and its cards are skipped (use --strict to fail instead).

Usage:
    python scripts/verify_practice_cards.py [--lang python] [--strict]
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "lib" / "practice" / "cards"
LANGS = ("python", "c", "js", "java")
ID_PREFIX = {"python": "py-", "c": "c-", "js": "js-", "java": "java-"}
TIMEOUT_S = 15

C_TEMPLATE = """#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {{
{body}
    return 0;
}}
"""

JAVA_TEMPLATE = """import java.util.*;

public class Main {{
    public static void main(String[] args) {{
{body}
    }}
}}
"""


def normalize(text: str) -> str:
    """Compare output line by line, ignoring trailing whitespace."""
    return "\n".join(line.rstrip() for line in text.strip("\n").split("\n"))


def toolchain_ok(lang: str) -> bool:
    needed = {"python": [sys.executable], "js": ["node"], "c": ["gcc"], "java": ["java"]}[lang]
    return all(shutil.which(tool) or Path(tool).exists() for tool in needed)


def run(lang: str, code: str, full: bool) -> subprocess.CompletedProcess[str]:
    """Run one snippet in a fresh temp dir and return the completed process."""
    with tempfile.TemporaryDirectory(prefix="practice-") as tmp:
        tmp_path = Path(tmp)
        if lang == "python":
            src = tmp_path / "card.py"
            src.write_text(code)
            cmd = [sys.executable, "-I", str(src)]
        elif lang == "js":
            src = tmp_path / "card.js"
            src.write_text(code)
            cmd = ["node", str(src)]
        elif lang == "c":
            src = tmp_path / "card.c"
            body = code if full else C_TEMPLATE.format(body=textwrap.indent(code, "    "))
            src.write_text(body)
            exe = tmp_path / "card"
            build = subprocess.run(
                ["gcc", "-std=c11", "-O0", "-o", str(exe), str(src), "-lm"],
                capture_output=True,
                text=True,
                timeout=TIMEOUT_S,
            )
            if build.returncode != 0:
                return subprocess.CompletedProcess(build.args, build.returncode, "", "COMPILE ERROR\n" + build.stderr)
            cmd = [str(exe)]
        elif lang == "java":
            src = tmp_path / "Main.java"
            body = code if full else JAVA_TEMPLATE.format(body=textwrap.indent(code, "        "))
            src.write_text(body)
            cmd = ["java", str(src)]
        else:
            raise ValueError(f"unknown language {lang}")
        return subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S, cwd=tmp)


def check_structure(card: dict, seen_ids: set[str]) -> list[str]:
    problems: list[str] = []
    cid = card.get("id", "?")
    for field in ("id", "lang", "topic", "kind", "prompt", "explanation"):
        if not card.get(field):
            problems.append(f"missing {field}")
    lang = card.get("lang")
    if lang not in LANGS:
        problems.append(f"bad lang {lang!r}")
    elif not cid.startswith(ID_PREFIX[lang]):
        problems.append(f"id should start with {ID_PREFIX[lang]!r}")
    if cid in seen_ids:
        problems.append("duplicate id")
    seen_ids.add(cid)

    kind = card.get("kind")
    if kind in ("output", "compare"):
        choices = card.get("choices") or []
        answer = card.get("answer")
        if len(choices) < 2:
            problems.append("needs at least 2 choices")
        if not isinstance(answer, int) or not 0 <= answer < len(choices):
            problems.append("answer index out of range")
        keys = [c["code"] if isinstance(c, dict) else c for c in choices]
        if len(set(keys)) != len(keys):
            problems.append("duplicate choices")
        if kind == "output" and not card.get("code"):
            problems.append("missing code")
        if kind == "compare" and any(not isinstance(c, dict) or "code" not in c for c in choices):
            problems.append("compare choices must be {code, lang}")
    elif kind == "bug":
        lines = card.get("lines") or []
        if len(lines) < 2:
            problems.append("bug card needs at least 2 lines")
        if not isinstance(card.get("bugLine"), int) or not 0 <= card["bugLine"] < len(lines):
            problems.append("bugLine out of range")
    elif kind == "order":
        lines = card.get("lines") or []
        if len(lines) < 3:
            problems.append("order card needs at least 3 lines")
        if len(set(lines)) == 1:
            problems.append("order card lines are all identical")
    else:
        problems.append(f"unknown kind {kind!r}")
    return problems


def check_execution(card: dict) -> list[str]:
    lang, kind = card["lang"], card["kind"]
    if kind == "output":
        proc = run(lang, card["code"], card.get("full", False))
        expected = card["choices"][card["answer"]]
        if card.get("raises"):
            if proc.returncode == 0:
                return [f"expected failure with {card['raises']}, but it ran fine and printed {proc.stdout!r}"]
            if card["raises"] not in proc.stderr:
                return [f"expected {card['raises']} in stderr, got: {proc.stderr.strip()[-300:]}"]
            return []
        if proc.returncode != 0:
            return [f"exited {proc.returncode}: {proc.stderr.strip()[-300:]}"]
        actual = normalize(proc.stdout)
        problems = []
        if actual != normalize(expected):
            problems.append(f"marked answer {expected!r} but real output is {actual!r}")
        for i, choice in enumerate(card["choices"]):
            if i != card["answer"] and normalize(choice) == actual:
                problems.append(f"wrong choice #{i} {choice!r} equals the real output")
        return problems
    if kind == "order" and card.get("expectOutput") is not None:
        proc = run(lang, "\n".join(card["lines"]), card.get("full", False))
        if proc.returncode != 0:
            return [f"ordered solution exited {proc.returncode}: {proc.stderr.strip()[-300:]}"]
        if normalize(proc.stdout) != normalize(card["expectOutput"]):
            return [f"ordered solution printed {normalize(proc.stdout)!r}, expected {card['expectOutput']!r}"]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lang", choices=LANGS, help="only check one language")
    parser.add_argument("--strict", action="store_true", help="fail if a toolchain is missing")
    args = parser.parse_args()

    seen_ids: set[str] = set()
    failures = 0
    executed = 0
    for lang in LANGS:
        path = CARDS_DIR / f"{lang}.json"
        cards = json.loads(path.read_text())
        can_run = toolchain_ok(lang)
        if args.lang and lang != args.lang:
            for card in cards:
                seen_ids.add(card.get("id", "?"))
            continue
        if not can_run:
            print(f"!! {lang}: toolchain not found, skipping execution checks")
            if args.strict:
                failures += 1
        for card in cards:
            problems = check_structure(card, seen_ids)
            if not problems and can_run:
                runnable = card["kind"] == "output" or (card["kind"] == "order" and card.get("expectOutput") is not None)
                if runnable:
                    executed += 1
                    try:
                        problems = check_execution(card)
                    except subprocess.TimeoutExpired:
                        problems = ["timed out"]
            for p in problems:
                print(f"FAIL {card.get('id', '?')}: {p}")
            failures += bool(problems)
        print(f"-- {lang}: {len(cards)} cards checked")

    print(f"\n{executed} snippets executed, {failures} card(s) with problems")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
