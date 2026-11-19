"""Unit tests for scripts/generate_practice_cards.py using the Python standard library only."""

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest import mock

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import generate_practice_cards as gpc  # noqa: E402


def _make_cards(lang: str, count: int, topic: str = "Basics") -> list[dict]:
    return [
        {"id": f"{lang}-{i:03d}", "lang": lang, "topic": topic}
        for i in range(1, count + 1)
    ]


def _make_review(
    card_id: str,
    lang: str,
    introduced_at: datetime,
    lapses: int = 0,
    include_fsrs: bool = True,
) -> dict:
    row = {
        "card_id": card_id,
        "lang": lang,
        "introduced_at": introduced_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if include_fsrs:
        row["fsrs"] = {"lapses": lapses}
    return row


class TestPlanRefills(unittest.TestCase):
    """Tests for plan_refills and CLI --force-lang planning."""

    NOW = datetime(2026, 5, 15, 12, 0, 0, tzinfo=timezone.utc)

    def test_only_active_languages_are_planned(self):
        recent = self.NOW - timedelta(days=1)
        cards_by_lang = {
            "python": _make_cards("python", 12),
            "c": _make_cards("c", 2),
            "js": _make_cards("js", 2),
            "java": _make_cards("java", 2),
        }
        reviews = [
            _make_review("c-001", "c", recent),
            _make_review("c-002", "c", recent),
            _make_review("js-001", "js", recent),
            _make_review("java-001", "java", recent),
        ]

        plans = gpc.plan_refills(cards_by_lang, reviews, self.NOW, force_lang=None)
        self.assertEqual([p.lang for p in plans], list(gpc.ACTIVE))
        self.assertEqual([p.lang for p in plans], ["python"])

        with mock.patch.object(gpc, "ACTIVE", ("python", "c")):
            expanded = gpc.plan_refills(cards_by_lang, reviews, self.NOW, force_lang=None)
        self.assertEqual([p.lang for p in expanded], ["python", "c"])

    def test_no_recent_practice_gets_target_zero_and_no_refill(self):
        cards_by_lang = {"python": _make_cards("python", 3)}

        plans_no_reviews = gpc.plan_refills(cards_by_lang, [], self.NOW, force_lang=None)
        self.assertEqual(len(plans_no_reviews), 1)
        plan = plans_no_reviews[0]
        self.assertEqual(plan.lang, "python")
        self.assertEqual(plan.total, 3)
        self.assertEqual(plan.unseen, 3)
        self.assertEqual(plan.pace, 0.0)
        self.assertEqual(plan.target, 0)
        self.assertIsNone(plan.reason)

        stale = self.NOW - timedelta(days=gpc.PACE_WINDOW_DAYS, seconds=1)
        stale_reviews = [_make_review("python-001", "python", stale)]
        plans_stale = gpc.plan_refills(cards_by_lang, stale_reviews, self.NOW, force_lang=None)
        self.assertEqual(len(plans_stale), 1)
        stale_plan = plans_stale[0]
        self.assertEqual(stale_plan.unseen, 2)
        self.assertEqual(stale_plan.pace, 0.0)
        self.assertEqual(stale_plan.target, 0)
        self.assertIsNone(stale_plan.reason)

    def test_below_floor_while_practiced_gets_refill(self):
        recent = self.NOW - timedelta(days=2)
        cards_by_lang = {"python": _make_cards("python", 15)}
        reviews = [_make_review(f"python-{i:03d}", "python", recent) for i in range(1, 8)]

        plans = gpc.plan_refills(cards_by_lang, reviews, self.NOW, force_lang=None)
        self.assertEqual(len(plans), 1)
        plan = plans[0]
        self.assertEqual(plan.total, 15)
        self.assertEqual(plan.unseen, 8)
        self.assertEqual(plan.pace, 0.5)
        self.assertEqual(plan.target, gpc.FLOOR["python"])
        self.assertEqual(
            plan.reason,
            f"8 unseen < {gpc.FLOOR['python']} needed for {gpc.BUFFER_DAYS} days at 0.5/day",
        )

    def test_at_floor_while_practiced_skips_refill(self):
        recent = self.NOW - timedelta(days=2)
        cards_by_lang = {"python": _make_cards("python", 17)}
        reviews = [_make_review(f"python-{i:03d}", "python", recent) for i in range(1, 8)]

        plans = gpc.plan_refills(cards_by_lang, reviews, self.NOW, force_lang=None)
        self.assertEqual(len(plans), 1)
        self.assertEqual(plans[0].unseen, 10)
        self.assertEqual(plans[0].target, 10)
        self.assertIsNone(plans[0].reason)

    def test_high_pace_raises_target_above_floor(self):
        recent = self.NOW - timedelta(days=1)
        cards_by_lang = {"python": _make_cards("python", 26)}
        reviews = [_make_review(f"python-{i:03d}", "python", recent) for i in range(1, 15)]

        plans = gpc.plan_refills(cards_by_lang, reviews, self.NOW, force_lang=None)
        self.assertEqual(len(plans), 1)
        plan = plans[0]
        self.assertEqual(plan.unseen, 12)
        self.assertEqual(plan.pace, 1.0)
        self.assertEqual(plan.target, 14)
        self.assertEqual(
            plan.reason,
            f"12 unseen < 14 needed for {gpc.BUFFER_DAYS} days at 1.0/day",
        )

    def test_force_lang_plans_only_forced_language(self):
        cards_by_lang = {
            "python": _make_cards("python", 20),
            "c": _make_cards("c", 20),
        }
        with mock.patch.object(gpc, "ACTIVE", ("python", "c")):
            plans = gpc.plan_refills(cards_by_lang, [], self.NOW, force_lang="c")

        by_lang = {p.lang: p for p in plans}
        self.assertEqual(set(by_lang.keys()), {"python", "c"})
        self.assertIsNone(by_lang["python"].reason)
        self.assertEqual(by_lang["c"].reason, "forced from workflow input")

    def test_cli_force_lang_plans_only_forced_language_offline(self):
        bundled = {
            "python": [
                {"id": "py-001", "lang": "python", "topic": "Basics"},
                {"id": "py-002", "lang": "python", "topic": "Loops"},
            ],
            "c": [
                {"id": "c-001", "lang": "c", "topic": "Pointers"},
            ],
            "js": [],
            "java": [],
        }
        with mock.patch.object(gpc, "ACTIVE", ("python", "c")), \
             mock.patch.object(gpc, "load_bundled", return_value=bundled), \
             mock.patch.object(gpc, "connect") as mock_connect, \
             mock.patch.object(gpc, "generate_content_with_fallback") as mock_gen, \
             mock.patch.dict(os.environ, {}, clear=True), \
             mock.patch.object(
                 sys, "argv", ["generate_practice_cards.py", "--force-lang", "c", "--offline"]
             ):
            with self.assertLogs(gpc.logger, level="INFO") as cm:
                rc = gpc.main()

        self.assertEqual(rc, 0)
        mock_connect.assert_not_called()
        mock_gen.assert_not_called()
        logs = "\n".join(cm.output)
        self.assertIn("[c] Refilling: forced from workflow input", logs)
        self.assertIn("[c] Dry run: would ask Gemini for 12 cards.", logs)
        self.assertNotIn("[python] Refilling:", logs)


class TestChooseTopics(unittest.TestCase):
    """Tests for choose_topics."""

    NOW = datetime(2026, 5, 15, 12, 0, 0, tzinfo=timezone.utc)

    def test_most_missed_topic_first_then_fewest_cards(self):
        path = ["Basics", "Loops", "Dicts", "Slices"]
        cards = [
            *(_make_cards("py-b", 4, topic="Basics")),
            *(_make_cards("py-l", 4, topic="Loops")),
            *(_make_cards("py-d", 1, topic="Dicts")),
            *(_make_cards("py-s", 3, topic="Slices")),
        ]
        # Basics: 2 lapses / 2 seen = 1.0; Loops: 2 lapses / 1 seen = 2.0 (highest rate).
        reviews_by_id = {
            "py-b-001": _make_review("py-b-001", "python", self.NOW, lapses=1),
            "py-b-002": _make_review("py-b-002", "python", self.NOW, lapses=1),
            "py-l-001": _make_review("py-l-001", "python", self.NOW, lapses=2),
        }

        chosen = gpc.choose_topics(path, cards, reviews_by_id, k=2)
        self.assertEqual(chosen, ["Loops", "Dicts"])

    def test_no_lapses_picks_fewest_cards_breaking_ties_by_path_order(self):
        path = ["Basics", "Loops", "Dicts", "Slices"]
        cards = [
            *(_make_cards("py-b", 3, topic="Basics")),
            *(_make_cards("py-l", 1, topic="Loops")),
            *(_make_cards("py-d", 2, topic="Dicts")),
            *(_make_cards("py-s", 1, topic="Slices")),
        ]

        chosen = gpc.choose_topics(path, cards, {}, k=3)
        self.assertEqual(chosen, ["Loops", "Slices", "Dicts"])

    def test_most_missed_tie_breaks_by_earlier_path_order(self):
        path = ["Basics", "Loops", "Dicts"]
        cards = [
            *(_make_cards("py-b", 3, topic="Basics")),
            *(_make_cards("py-l", 3, topic="Loops")),
            *(_make_cards("py-d", 1, topic="Dicts")),
        ]
        reviews_by_id = {
            "py-b-001": _make_review("py-b-001", "python", self.NOW, lapses=2),
            "py-l-001": _make_review("py-l-001", "python", self.NOW, lapses=2),
        }

        chosen = gpc.choose_topics(path, cards, reviews_by_id, k=2)
        self.assertEqual(chosen, ["Basics", "Dicts"])

    def test_most_missed_with_fewest_cards_is_not_duplicated(self):
        path = ["Basics", "Loops", "Dicts"]
        cards = [
            *(_make_cards("py-b", 1, topic="Basics")),
            *(_make_cards("py-l", 3, topic="Loops")),
            *(_make_cards("py-d", 2, topic="Dicts")),
        ]
        reviews_by_id = {
            "py-b-001": _make_review("py-b-001", "python", self.NOW, lapses=3),
        }

        chosen = gpc.choose_topics(path, cards, reviews_by_id, k=2)
        self.assertEqual(chosen, ["Basics", "Dicts"])

    def test_handles_missing_fsrs_and_k_equals_one(self):
        path = ["Basics", "Loops"]
        cards = [
            {"id": "py-1", "lang": "python", "topic": "Basics"},
            {"id": "py-2", "lang": "python", "topic": "Loops"},
            {"id": "py-3", "lang": "python", "topic": "Loops"},
        ]
        reviews_by_id = {
            "py-1": {"card_id": "py-1", "lang": "python", "fsrs": None},
            "py-2": _make_review("py-2", "python", self.NOW, lapses=1),
        }

        chosen = gpc.choose_topics(path, cards, reviews_by_id, k=1)
        self.assertEqual(chosen, ["Loops"])


class TestNextIds(unittest.TestCase):
    """Tests for next_ids."""

    NOW = datetime(2026, 5, 3, 8, 30, 0, tzinfo=timezone.utc)

    def test_prefix_and_date_format_for_each_language(self):
        expected = {
            "python": ["py-g20260503-01", "py-g20260503-02"],
            "c": ["c-g20260503-01", "c-g20260503-02"],
            "js": ["js-g20260503-01", "js-g20260503-02"],
            "java": ["java-g20260503-01", "java-g20260503-02"],
        }
        for lang, want in expected.items():
            with self.subTest(lang=lang):
                self.assertEqual(gpc.next_ids(lang, self.NOW, set(), 2), want)

    def test_skips_taken_ids_and_does_not_mutate_taken(self):
        taken = {"py-g20260503-01", "py-g20260503-03", "py-g20260503-04"}
        snapshot = set(taken)

        ids = gpc.next_ids("python", self.NOW, taken, 3)

        self.assertEqual(ids, ["py-g20260503-02", "py-g20260503-05", "py-g20260503-06"])
        self.assertTrue(set(ids).isdisjoint(taken))
        self.assertEqual(taken, snapshot)

    def test_continues_past_two_digit_boundary_and_handles_zero(self):
        taken = {f"py-g20260503-{i:02d}" for i in range(1, 10)}
        self.assertEqual(
            gpc.next_ids("python", self.NOW, taken, 2),
            ["py-g20260503-10", "py-g20260503-11"],
        )
        self.assertEqual(gpc.next_ids("python", self.NOW, taken, 0), [])


class TestToCard(unittest.TestCase):
    """Tests for to_card."""

    def test_unknown_topic_falls_back_to_first_requested_topic(self):
        gen = gpc.GeneratedCard(
            kind=gpc.GenKind.OUTPUT,
            topic="Invented Topic",
            prompt="  What does this print?  ",
            explanation="  Adds two ints.  ",
            code="print(1 + 2)",
            choices=["3", "12", "1", "2"],
            answer=0,
        )

        card = gpc.to_card(gen, "python", "py-g20260503-01", ["Slices", "Dicts"])

        self.assertEqual(card["topic"], "Slices")
        self.assertEqual(card["id"], "py-g20260503-01")
        self.assertEqual(card["lang"], "python")
        self.assertEqual(card["kind"], "output")
        self.assertEqual(card["prompt"], "What does this print?")
        self.assertEqual(card["explanation"], "Adds two ints.")
        self.assertTrue(card["generated"])

    def test_known_topic_is_preserved_and_output_fields_cleaned(self):
        gen = gpc.GeneratedCard(
            kind=gpc.GenKind.OUTPUT,
            topic="Dicts",
            prompt="What happens here?",
            explanation="Key lookup raises KeyError.",
            code="```python\n\td = {}\n\tprint(d['x'])  \n```",
            choices=["KeyError  ", "None", "0", "''"],
            answer=0,
            raises="  KeyError  ",
            full=True,
        )

        card = gpc.to_card(gen, "python", "py-g20260503-02", ["Slices", "Dicts"])

        self.assertEqual(card["topic"], "Dicts")
        self.assertEqual(card["code"], "    d = {}\n    print(d['x'])")
        self.assertEqual(card["choices"], ["KeyError", "None", "0", "''"])
        self.assertEqual(card["answer"], 0)
        self.assertEqual(card["raises"], "KeyError")
        self.assertNotIn("full", card)

    def test_bug_and_order_cards_and_c_full_flag(self):
        bug_gen = gpc.GeneratedCard(
            kind=gpc.GenKind.BUG,
            topic="Pointers",
            prompt="Should print 5.",
            explanation="Fix initializer.",
            lines=["\tint x = 4;  ", "printf(\"%d\\n\", x);"],
            bugLine=0,
            fixedLine="\tint x = 5;  ",
            expectOutput="\n5\n",
            full=True,
        )
        bug_card = gpc.to_card(bug_gen, "c", "c-g20260503-01", ["Pointers"])
        self.assertEqual(bug_card["lines"], ["    int x = 4;", "printf(\"%d\\n\", x);"])
        self.assertEqual(bug_card["bugLine"], 0)
        self.assertEqual(bug_card["fixedLine"], "    int x = 5;")
        self.assertEqual(bug_card["expectOutput"], "5")
        self.assertTrue(bug_card["full"])

        order_gen = gpc.GeneratedCard(
            kind=gpc.GenKind.ORDER,
            topic="Loops",
            prompt="Put in order.",
            explanation="Initialize before adding.",
            lines=["x = 1", "x += 2", "print(x)"],
            expectOutput="3\n",
        )
        order_card = gpc.to_card(order_gen, "python", "py-g20260503-03", ["Loops"])
        self.assertEqual(order_card["kind"], "order")
        self.assertEqual(order_card["lines"], ["x = 1", "x += 2", "print(x)"])
        self.assertEqual(order_card["expectOutput"], "3")
        self.assertNotIn("bugLine", order_card)
        self.assertNotIn("fixedLine", order_card)


class TestVet(unittest.TestCase):
    """Tests for vet without running external code."""

    def _valid_output_card(self, code: str = "print(1 + 2)") -> dict:
        return {
            "id": "py-g20260503-01",
            "lang": "python",
            "topic": "Basics",
            "kind": "output",
            "prompt": "What does this print?",
            "explanation": "Integer addition prints 3.",
            "code": code,
            "choices": ["3", "12", "1", "2"],
            "answer": 0,
            "generated": True,
        }

    @mock.patch("generate_practice_cards.verify.check_execution")
    def test_denylist_rejects_before_execution(self, mock_exec):
        card = self._valid_output_card(code="print(open('/etc/hosts'))")
        fingerprints: set[str] = set()

        problems = gpc.vet(card, set(), fingerprints)

        self.assertTrue(any("disallowed construct" in p for p in problems))
        mock_exec.assert_not_called()
        self.assertEqual(fingerprints, set())

    @mock.patch("generate_practice_cards.verify.check_execution")
    def test_duplicate_fingerprint_rejects_before_execution(self, mock_exec):
        card = self._valid_output_card(code="print(1 + 2)")
        fingerprints = {"print(1+2)"}

        problems = gpc.vet(card, set(), fingerprints)

        self.assertIn("duplicates an existing card", problems)
        mock_exec.assert_not_called()

    @mock.patch("generate_practice_cards.verify.check_execution", return_value=[])
    def test_valid_card_passes_and_records_fingerprint(self, mock_exec):
        card = self._valid_output_card(code="print(1 + 2)")
        fingerprints: set[str] = set()

        problems = gpc.vet(card, set(), fingerprints)

        self.assertEqual(problems, [])
        mock_exec.assert_called_once_with(card)
        self.assertIn("print(1+2)", fingerprints)

    @mock.patch(
        "generate_practice_cards.verify.check_execution",
        side_effect=subprocess.TimeoutExpired(cmd="python", timeout=15),
    )
    def test_timeout_during_execution_is_reported(self, mock_exec):
        card = self._valid_output_card(code="print(1 + 2)")
        fingerprints: set[str] = set()

        problems = gpc.vet(card, set(), fingerprints)

        self.assertEqual(problems, ["timed out"])
        mock_exec.assert_called_once_with(card)
        self.assertEqual(fingerprints, set())


if __name__ == "__main__":
    unittest.main()
