"""Verify Practice cards by running the code for real.

Checks every card in lib/practice/cards/*.json (and is imported by
generate_practice_cards.py to vet generated cards before they are stored):
  - structure (ids, required fields, answer indexes in range, unique choices)
  - "output" cards: the snippet's real stdout must equal the marked answer,
    must NOT equal any wrong choice, and must be identical across two runs
  - "output" cards with `raises`: the program must fail with that error
  - "order" cards with `expectOutput`: the ordered code must print it, and
    no swap of two adjacent lines may also print it (one valid order only)
  - "bug" cards with `fixedLine` + `expectOutput`: replacing the bug line with
    the fix must print expectOutput, and the buggy program must not

Snippets run in a temp dir with a scrubbed environment (no secrets), a
timeout, and, for C, AddressSanitizer + UBSan when available. C and Java
snippets are wrapped in a main() template unless the card sets `full: true`.

Requires python3, node, gcc, and a JDK (java) on PATH; a missing toolchain is
reported and its cards are skipped (use --strict to fail instead).

Usage:
    python scripts/verify_practice_cards.py [--lang python] [--strict]
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
from functools import lru_cache
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

C_SANITIZE = ["-fsanitize=address,undefined", "-fno-sanitize-recover=all"]

# Generated code must not touch files, the network, processes, the environment
# or stdin. This is defense in depth on top of the scrubbed environment.
DENYLIST = {
    "python": ["open(", "import os", "from os", "os.", "subprocess", "socket", "urllib", "requests", "http",
               "environ", "getenv", "eval(", "exec(", "__import__", "importlib", "shutil", "import sys", "sys.",
               "ctypes", "pickle", "input(", "read_text", "write_text", "read_bytes", "write_bytes", "unlink",
               "rmdir", "mkdir", "glob", "iterdir", "threading", "multiprocessing", "random", "time.", "datetime"],
    "c": ["system(", "popen", "fopen", "exec", "fork", "socket", "getenv", "unistd", "<sys/", "scanf", "fgets",
          "gets(", "remove(", "rename(", "rand(", "time(", "pthread", "asm"],
    "js": ["require(", "import ", "process", "fetch(", "child_process", "fs.", "eval(", "Function(",
           "XMLHttpRequest", "Deno", "Bun", "Math.random", "Date", "globalThis", "while (true)"],
    "java": ["Runtime", "ProcessBuilder", "getenv", "java.io", "java.nio", "Files.", "Socket", "URL", "HttpClient",
             "Class.forName", "reflect", "Scanner", "System.in", "Random", "currentTimeMillis", "nanoTime",
             "Thread", "System.exit"],
}

# Phone-screen limits for generated cards.
MAX_CODE_LINES = 18
MAX_LINE_CHARS = 64
MAX_PROMPT_CHARS = 160
MAX_EXPLANATION_CHARS = 480


def normalize(text: str) -> str:
    """Compare output line by line, ignoring trailing whitespace."""
    return "\n".join(line.rstrip() for line in text.strip("\n").split("\n"))


def same_code_line(lang: str, a: str, b: str) -> bool:
    """Indentation only matters in Python; the app's reorder check uses the same rule."""
    return a == b if lang == "python" else a.strip() == b.strip()


def toolchain_ok(lang: str) -> bool:
    needed = {"python": [sys.executable], "js": ["node"], "c": ["gcc"], "java": ["java"]}[lang]
    return all(shutil.which(tool) or Path(tool).exists() for tool in needed)


def scrubbed_env(home: str, seed: int) -> dict[str, str]:
    """Only what the toolchains need: no API keys or tokens reach the snippet."""
    return {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": home,
        "TMPDIR": home,
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "PYTHONHASHSEED": str(seed),
        "ASAN_OPTIONS": "detect_leaks=1",
    }


@lru_cache(maxsize=1)
def c_sanitizers_available() -> bool:
    """Probe once: sanitizer runtimes are missing on some systems."""
    if not shutil.which("gcc"):
        return False
    with tempfile.TemporaryDirectory(prefix="practice-probe-") as tmp:
        src, exe = Path(tmp) / "probe.c", Path(tmp) / "probe"
        src.write_text("int main(void) { return 0; }\n")
        try:
            build = subprocess.run(["gcc", *C_SANITIZE, "-o", str(exe), str(src)], capture_output=True, timeout=TIMEOUT_S)
            if build.returncode != 0:
                return False
            return subprocess.run([str(exe)], capture_output=True, timeout=TIMEOUT_S, env=scrubbed_env(tmp, 0)).returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            return False


def run_many(lang: str, code: str, full: bool, seeds: tuple[int, ...] = (1,)) -> list[subprocess.CompletedProcess[str]]:
    """Build once, then run the snippet once per seed in a fresh temp dir."""
    with tempfile.TemporaryDirectory(prefix="practice-") as tmp:
        tmp_path = Path(tmp)
        if lang == "python":
            src = tmp_path / "card.py"
            src.write_text(code)
            cmd = [sys.executable, "-s", "-B", str(src)]
        elif lang == "js":
            src = tmp_path / "card.js"
            src.write_text(code)
            cmd = ["node", str(src)]
        elif lang == "c":
            src = tmp_path / "card.c"
            src.write_text(code if full else C_TEMPLATE.format(body=textwrap.indent(code, "    ")))
            exe = tmp_path / "card"
            flags = C_SANITIZE if c_sanitizers_available() else []
            build = subprocess.run(
                ["gcc", "-std=c11", "-O0", *flags, "-o", str(exe), str(src), "-lm"],
                capture_output=True, text=True, timeout=TIMEOUT_S, env=scrubbed_env(tmp, 0),
            )
            if build.returncode != 0:
                return [subprocess.CompletedProcess(build.args, build.returncode, "", "COMPILE ERROR\n" + build.stderr)]
            cmd = [str(exe)]
        elif lang == "java":
            src = tmp_path / "Main.java"
            src.write_text(code if full else JAVA_TEMPLATE.format(body=textwrap.indent(code, "        ")))
            cmd = ["java", str(src)]
        else:
            raise ValueError(f"unknown language {lang}")
        return [
            subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S, cwd=tmp, env=scrubbed_env(tmp, seed))
            for seed in seeds
        ]


def run(lang: str, code: str, full: bool) -> subprocess.CompletedProcess[str]:
    return run_many(lang, code, full)[0]


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
        keys = [normalize(c["code"] if isinstance(c, dict) else str(c)) for c in choices]
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
        elif card.get("fixedLine") is not None and card["fixedLine"] == lines[card["bugLine"]]:
            problems.append("fixedLine is identical to the bug line")
    elif kind == "order":
        lines = card.get("lines") or []
        if len(lines) < 3:
            problems.append("order card needs at least 3 lines")
        if len(set(lines)) == 1:
            problems.append("order card lines are all identical")
    else:
        problems.append(f"unknown kind {kind!r}")
    return problems


def card_code_lines(card: dict) -> list[str]:
    if card.get("kind") == "output":
        return str(card.get("code", "")).split("\n")
    lines = list(card.get("lines") or [])
    if card.get("kind") == "bug" and card.get("fixedLine"):
        lines.append(card["fixedLine"])
    return lines


def check_generated(card: dict) -> list[str]:
    """Extra rules for model-generated cards: safe to run, fits a phone, verifiable."""
    problems: list[str] = []
    lang, kind = card.get("lang"), card.get("kind")
    code_lines = card_code_lines(card)
    joined = "\n".join(code_lines)
    for needle in DENYLIST.get(lang, []):
        if needle in joined:
            problems.append(f"uses disallowed construct {needle!r}")
            break
    if len(code_lines) > MAX_CODE_LINES:
        problems.append(f"code has {len(code_lines)} lines (max {MAX_CODE_LINES})")
    if any(len(line) > MAX_LINE_CHARS for line in code_lines):
        problems.append(f"a code line is longer than {MAX_LINE_CHARS} characters")
    if len(card.get("prompt", "")) > MAX_PROMPT_CHARS:
        problems.append("prompt too long")
    if len(card.get("explanation", "")) > MAX_EXPLANATION_CHARS:
        problems.append("explanation too long")
    if kind == "output" and not 3 <= len(card.get("choices") or []) <= 4:
        problems.append("output cards need 3-4 choices")
    if kind == "order" and card.get("expectOutput") is None:
        problems.append("generated order cards need expectOutput")
    if kind == "bug" and (card.get("fixedLine") is None or card.get("expectOutput") is None):
        problems.append("generated bug cards need fixedLine and expectOutput")
    if kind == "compare":
        problems.append("compare cards can't be verified by running, so they aren't generated")
    return problems


def tail(proc: subprocess.CompletedProcess[str]) -> str:
    """The most useful line of an error report (sanitizer summary, exception), else the end of stderr."""
    lines = [line.strip() for line in proc.stderr.strip().split("\n") if line.strip()]
    for marker in ("SUMMARY:", "runtime error:", "ERROR:", "error:", "Error", "Exception"):
        hits = [line for line in lines if marker in line]
        if hits:
            return hits[-1][-300:]
    return proc.stderr.strip()[-300:]


def check_execution(card: dict) -> list[str]:
    lang, kind, full = card["lang"], card["kind"], card.get("full", False)
    if kind == "output":
        procs = run_many(lang, card["code"], full, seeds=(1, 2))
        proc = procs[0]
        expected = card["choices"][card["answer"]]
        if card.get("raises"):
            if proc.returncode == 0:
                return [f"expected failure with {card['raises']}, but it ran fine and printed {proc.stdout!r}"]
            if card["raises"] not in proc.stderr:
                return [f"expected {card['raises']} in stderr, got: {tail(proc)}"]
            return []
        if proc.returncode != 0:
            return [f"exited {proc.returncode}: {tail(proc)}"]
        actual = normalize(proc.stdout)
        if len(procs) > 1 and normalize(procs[1].stdout) != actual:
            return ["output differs between runs (nondeterministic)"]
        problems = []
        if actual != normalize(expected):
            problems.append(f"marked answer {expected!r} but real output is {actual!r}")
        for i, choice in enumerate(card["choices"]):
            if i != card["answer"] and normalize(choice) == actual:
                problems.append(f"wrong choice #{i} {choice!r} equals the real output")
        return problems

    if kind == "order" and card.get("expectOutput") is not None:
        lines, want = card["lines"], normalize(card["expectOutput"])
        proc = run(lang, "\n".join(lines), full)
        if proc.returncode != 0:
            return [f"ordered solution exited {proc.returncode}: {tail(proc)}"]
        if normalize(proc.stdout) != want:
            return [f"ordered solution printed {normalize(proc.stdout)!r}, expected {card['expectOutput']!r}"]
        for i in range(len(lines) - 1):
            if same_code_line(lang, lines[i], lines[i + 1]):
                continue
            swapped = lines[:i] + [lines[i + 1], lines[i]] + lines[i + 2:]
            alt = run(lang, "\n".join(swapped), full)
            if alt.returncode == 0 and normalize(alt.stdout) == want:
                return [f"lines {i + 1} and {i + 2} can be swapped and still work (more than one valid order)"]
        return []

    if kind == "bug" and card.get("fixedLine") is not None and card.get("expectOutput") is not None:
        lines, want = card["lines"], normalize(card["expectOutput"])
        fixed = list(lines)
        fixed[card["bugLine"]] = card["fixedLine"]
        good = run(lang, "\n".join(fixed), full)
        if good.returncode != 0:
            return [f"fixed program exited {good.returncode}: {tail(good)}"]
        if normalize(good.stdout) != want:
            return [f"fixed program printed {normalize(good.stdout)!r}, expected {card['expectOutput']!r}"]
        bad = run(lang, "\n".join(lines), full)
        if bad.returncode == 0 and normalize(bad.stdout) == want:
            return ["the 'buggy' program already prints the expected output"]
    return []


def is_runnable(card: dict) -> bool:
    kind = card.get("kind")
    return (
        kind == "output"
        or (kind == "order" and card.get("expectOutput") is not None)
        or (kind == "bug" and card.get("fixedLine") is not None and card.get("expectOutput") is not None)
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lang", choices=LANGS, help="only check one language")
    parser.add_argument("--strict", action="store_true", help="fail if a toolchain is missing")
    args = parser.parse_args()

    if toolchain_ok("c") and not c_sanitizers_available():
        print("!! gcc sanitizers unavailable; C snippets run without ASan/UBSan")

    seen_ids: set[str] = set()
    failures = 0
    executed = 0
    for lang in LANGS:
        cards = json.loads((CARDS_DIR / f"{lang}.json").read_text())
        if args.lang and lang != args.lang:
            for card in cards:
                seen_ids.add(card.get("id", "?"))
            continue
        can_run = toolchain_ok(lang)
        if not can_run:
            print(f"!! {lang}: toolchain not found, skipping execution checks")
            if args.strict:
                failures += 1
        for card in cards:
            problems = check_structure(card, seen_ids)
            if not problems and can_run and is_runnable(card):
                executed += 1
                try:
                    problems = check_execution(card)
                except subprocess.TimeoutExpired:
                    problems = ["timed out"]
            for p in problems:
                print(f"FAIL {card.get('id', '?')}: {p}")
            failures += bool(problems)
        print(f"-- {lang}: {len(cards)} cards checked")

    print(f"\n{executed} cards executed, {failures} card(s) with problems")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
