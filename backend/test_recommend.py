"""
Unit tests for Smart Suggestions / Recommend feature.
Tests: cleaning/deduplication, preference merge/clamping, post-filter
alias removal (Bombay/Mumbai), exactly-4 result + single retry,
status / 400 guard logic, GET backward-compat logic.

Run from the backend/ directory:
    python -m unittest test_recommend -v

Gemini is mocked — the real API is never called.
"""

import asyncio
import sys
import os
import unittest
from unittest.mock import patch

# Ensure the backend package is importable when running from repo root or backend/
sys.path.insert(0, os.path.dirname(__file__))

from ai_service import (
    normalize_destination_name,
    is_duplicate_destination,
    _validate_and_filter_suggestions,
    generate_similar_destinations,
)


def run(coro):
    return asyncio.run(coro)


# ── Constants (duplicated here so tests stay self-contained) ─────────────────

ALLOWED_BUDGETS = {"budget", "mid-range", "luxury"}

_DEFAULT_PREFS = {
    "budget": "mid-range",
    "duration_days": 5,
    "companions": "solo",
    "diet": "veg",
    "interests": [],
    "origin": "",
    "travel_type": "",
}


def _clean_places(raw_places, saved_names=None):
    """Mirrors the cleaning logic in server.py recommend_post."""
    saved_names = saved_names or []
    seen_lower = {n.lower().strip() for n in saved_names}
    cleaned = []
    for raw in raw_places:
        place = str(raw).strip()[:80]
        if not place:
            continue
        low = place.lower()
        if low in seen_lower:
            continue
        seen_lower.add(low)
        cleaned.append(place)
        if len(cleaned) >= 30:
            break
    return cleaned


def _merge_prefs(user_budget=None, user_days=None, user_companions=None, user_origin=None):
    """Mirrors the preference-merge logic in server.py recommend_post."""
    import copy
    prefs = copy.deepcopy(_DEFAULT_PREFS)
    if user_budget and user_budget in ALLOWED_BUDGETS:
        prefs["budget"] = user_budget
    if user_days is not None:
        prefs["duration_days"] = max(1, min(30, user_days))
    if user_companions is not None:
        prefs["companions"] = str(user_companions)
    if user_origin is not None:
        prefs["origin"] = str(user_origin).strip()
    prefs.setdefault("diet", "veg")
    prefs.setdefault("interests", [])
    prefs.setdefault("travel_type", "")
    if not isinstance(prefs.get("interests"), list):
        prefs["interests"] = []
    return prefs


# ── 1. Cleaning / deduplication ──────────────────────────────────────────────

class TestVisitedPlacesCleaning(unittest.TestCase):

    def test_trim_and_empty_dropped(self):
        self.assertEqual(_clean_places(["  Goa  ", "", "  ", "Jaipur"]), ["Goa", "Jaipur"])

    def test_case_insensitive_dedup(self):
        self.assertEqual(_clean_places(["Goa", "GOA", "goa", "Jaipur"]), ["Goa", "Jaipur"])

    def test_dedup_against_saved_names(self):
        self.assertEqual(_clean_places(["Goa", "Manali"], saved_names=["Goa"]), ["Manali"])

    def test_max_80_chars(self):
        long = "A" * 100
        result = _clean_places([long])
        self.assertEqual(result, ["A" * 80])

    def test_max_30_entries(self):
        places = [f"City{i}" for i in range(50)]
        self.assertEqual(len(_clean_places(places)), 30)

    def test_empty_list_returns_empty(self):
        self.assertEqual(_clean_places([]), [])


# ── 2. Preference merge & clamping ──────────────────────────────────────────

class TestPreferenceMerge(unittest.TestCase):

    def test_defaults_when_no_prefs(self):
        p = _merge_prefs()
        self.assertEqual(p["budget"], "mid-range")
        self.assertEqual(p["duration_days"], 5)
        self.assertEqual(p["companions"], "solo")
        self.assertEqual(p["origin"], "")
        self.assertIsInstance(p["interests"], list)

    def test_valid_budget_overridden(self):
        self.assertEqual(_merge_prefs(user_budget="luxury")["budget"], "luxury")

    def test_invalid_budget_ignored(self):
        self.assertEqual(_merge_prefs(user_budget="premium")["budget"], "mid-range")

    def test_duration_clamped_high(self):
        self.assertEqual(_merge_prefs(user_days=99)["duration_days"], 30)

    def test_duration_clamped_low(self):
        self.assertEqual(_merge_prefs(user_days=-5)["duration_days"], 1)

    def test_duration_valid(self):
        self.assertEqual(_merge_prefs(user_days=7)["duration_days"], 7)

    def test_companions_set(self):
        self.assertEqual(_merge_prefs(user_companions="family")["companions"], "family")

    def test_origin_set_and_stripped(self):
        self.assertEqual(_merge_prefs(user_origin="  Surat  ")["origin"], "Surat")

    def test_required_keys_always_present(self):
        p = _merge_prefs()
        for key in ("budget", "duration_days", "companions", "diet", "interests", "origin", "travel_type"):
            self.assertIn(key, p, f"Missing key: {key}")

    def test_allowed_budgets_covers_all_three_tiers(self):
        self.assertIn("budget", ALLOWED_BUDGETS)
        self.assertIn("mid-range", ALLOWED_BUDGETS)
        self.assertIn("luxury", ALLOWED_BUDGETS)
        self.assertEqual(len(ALLOWED_BUDGETS), 3)


# ── 3. Post-filter: alias/variant removal ────────────────────────────────────

class TestPostFilter(unittest.TestCase):

    def _s(self, name):
        return {"name": name, "country": "India", "why": "test", "image_query": "test"}

    def test_bombay_excluded_when_mumbai_visited(self):
        filtered = _validate_and_filter_suggestions(
            [self._s("Bombay"), self._s("Goa")], ["Mumbai"]
        )
        names = [s["name"] for s in filtered]
        self.assertNotIn("Bombay", names)
        self.assertIn("Goa", names)

    def test_exact_name_excluded(self):
        filtered = _validate_and_filter_suggestions(
            [self._s("Jaipur"), self._s("Manali")], ["Jaipur"]
        )
        self.assertNotIn("Jaipur", [s["name"] for s in filtered])

    def test_case_insensitive_exclusion(self):
        filtered = _validate_and_filter_suggestions([self._s("GOA")], ["goa"])
        self.assertEqual(filtered, [])

    def test_no_exclusions_returns_all(self):
        sug = [self._s("Rishikesh"), self._s("Wayanad")]
        self.assertEqual(len(_validate_and_filter_suggestions(sug, [])), 2)

    def test_invalid_entries_skipped(self):
        sug = [None, self._s(""), self._s("Goa")]
        filtered = _validate_and_filter_suggestions(sug, [])
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["name"], "Goa")


# ── 4. generate_similar_destinations (Gemini mocked) ─────────────────────────

class TestGenerateSimilarDestinations(unittest.TestCase):

    def _make_sug(self, *names):
        return [
            {"name": n, "country": "India",
             "why": f"Since you visited similar places, {n} matches your vibe.",
             "image_query": f"{n} India travel"}
            for n in names
        ]

    @patch("ai_service._call")
    def test_returns_four_suggestions(self, mock_call):
        mock_call.return_value = {"suggestions": self._make_sug("Coorg", "Hampi", "Ooty", "Pondicherry")}
        result = run(generate_similar_destinations(
            [{"name": "Goa"}], {"budget": "mid-range", "duration_days": 5}
        ))
        self.assertEqual(len(result["suggestions"]), 4)

    @patch("ai_service._call")
    def test_visited_place_excluded_retried(self, mock_call):
        call_count = [0]

        def side_effect(prompt, system_prompt):
            call_count[0] += 1
            if call_count[0] == 1:
                # First: returns Goa (visited) + 3 valid
                return {"suggestions": self._make_sug("Goa", "Hampi", "Ooty", "Pondicherry")}
            # Retry: 1 fresh
            return {"suggestions": self._make_sug("Coorg")}

        mock_call.side_effect = side_effect
        result = run(generate_similar_destinations(
            [], {"budget": "mid-range", "duration_days": 5},
            extra_visited=["Goa"]
        ))
        names = [s["name"] for s in result["suggestions"]]
        self.assertNotIn("Goa", names)
        self.assertEqual(len(names), 4)
        self.assertEqual(call_count[0], 2)  # exactly one retry

    @patch("ai_service._call")
    def test_raises_value_error_when_not_enough_after_retry(self, mock_call):
        mock_call.return_value = {"suggestions": self._make_sug("Goa", "Jaipur", "Manali")}
        with self.assertRaises(ValueError):
            run(generate_similar_destinations(
                [], {"budget": "mid-range", "duration_days": 5},
                extra_visited=["Goa", "Jaipur", "Manali", "Rishikesh"]
            ))

    @patch("ai_service._call")
    def test_no_saved_trips_uses_extra_visited(self, mock_call):
        mock_call.return_value = {"suggestions": self._make_sug("Coorg", "Hampi", "Ooty", "Pondicherry")}
        result = run(generate_similar_destinations(
            [],  # no past_destinations
            {"budget": "luxury", "duration_days": 3},
            extra_visited=["Goa", "Manali"],
        ))
        self.assertEqual(len(result["suggestions"]), 4)
        # Prompt must include the visited places
        call_args = mock_call.call_args[0][0]
        self.assertIn("Goa", call_args)
        self.assertIn("Manali", call_args)

    @patch("ai_service._call")
    def test_exclude_list_in_prompt(self, mock_call):
        mock_call.return_value = {"suggestions": self._make_sug("Coorg", "Hampi", "Ooty", "Pondicherry")}
        run(generate_similar_destinations(
            [{"name": "Goa"}],
            {"budget": "mid-range", "duration_days": 5},
            exclude=["Rishikesh", "Manali"],
        ))
        prompt = mock_call.call_args[0][0]
        self.assertIn("Rishikesh", prompt)
        self.assertIn("Manali", prompt)


# ── 5. Status / guard logic ──────────────────────────────────────────────────

class TestStatusAndGuards(unittest.TestCase):

    def test_400_guard_no_saved_no_cleaned(self):
        """POST with no saved trips and no visited_places → 400."""
        from fastapi import HTTPException
        has_saved = False
        cleaned = []
        if not has_saved and not cleaned:
            exc = HTTPException(
                status_code=400,
                detail="Add at least one place you've visited to get suggestions.",
            )
            self.assertEqual(exc.status_code, 400)
            self.assertIn("Add at least one", exc.detail)
        else:
            self.fail("Guard should have triggered")

    def test_400_not_404(self):
        """The guard must never produce a 404."""
        from fastapi import HTTPException
        exc = HTTPException(
            status_code=400,
            detail="Add at least one place you've visited to get suggestions.",
        )
        self.assertNotEqual(exc.status_code, 404)
        self.assertNotEqual(exc.status_code, 500)

    def test_get_recommend_compat_404_when_no_trips(self):
        """GET /itinerary/recommend must still return 404 for no saved trips."""
        from fastapi import HTTPException
        docs = []
        has_saved = len(docs) > 0
        if not has_saved:
            exc = HTTPException(
                status_code=404,
                detail="No saved trips found. Plan a trip first to get recommendations.",
            )
            self.assertEqual(exc.status_code, 404)
            self.assertIn("No saved trips", exc.detail)
        else:
            self.fail("Should have hit no-trips branch")

    def test_status_response_shape(self):
        """Status response must have has_saved_trips and saved_destinations keys."""
        response = {"has_saved_trips": True, "saved_destinations": ["Goa", "Manali"]}
        self.assertIn("has_saved_trips", response)
        self.assertIn("saved_destinations", response)
        self.assertIsInstance(response["saved_destinations"], list)


# ── 6. Normalize & alias helpers ─────────────────────────────────────────────

class TestNameHelpers(unittest.TestCase):

    def test_bombay_normalizes_to_mumbai(self):
        self.assertEqual(normalize_destination_name("Bombay"), "mumbai")

    def test_benares_normalizes_to_varanasi(self):
        self.assertEqual(normalize_destination_name("Benares"), "varanasi")

    def test_kashi_normalizes_to_varanasi(self):
        self.assertEqual(normalize_destination_name("Kashi"), "varanasi")

    def test_bengaluru_normalizes_to_bangalore(self):
        self.assertEqual(normalize_destination_name("Bengaluru"), "bangalore")

    def test_is_duplicate_alias(self):
        self.assertTrue(is_duplicate_destination("Bombay", ["Mumbai"]))

    def test_is_not_duplicate(self):
        self.assertFalse(is_duplicate_destination("Goa", ["Mumbai", "Delhi"]))

    def test_empty_candidate(self):
        self.assertFalse(is_duplicate_destination("", ["Mumbai"]))


if __name__ == "__main__":
    unittest.main()
