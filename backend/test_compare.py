"""
Unit tests for Compare feature in Chalo Ghumne AI tour planner.
Tests schema validation, normalization, tie-breaking, error handling, and server limits.
"""

import os
import sys
import unittest

# Make backend modules importable whether run from repo root or backend/
sys.path.insert(0, os.path.dirname(__file__))

from ai_service import (
    validate_compare_result,
    COMPARE_SYSTEM_PROMPT,
)
from server import CompareIn, DestinationChoice, QuestionnaireIn


class TestCompareValidation(unittest.TestCase):
    def setUp(self):
        self.places = ["Rishikesh", "Manali", "Wayanad"]

    def test_system_prompt_contains_required_criteria(self):
        self.assertIn("Estimated total budget", COMPARE_SYSTEM_PROMPT)
        self.assertIn("Match with the user's interests", COMPARE_SYSTEM_PROMPT)
        self.assertIn("Best-season fit and weather", COMPARE_SYSTEM_PROMPT)
        self.assertIn("Famous places and must-do experiences", COMPARE_SYSTEM_PROMPT)
        self.assertIn("Travel time and connectivity", COMPARE_SYSTEM_PROMPT)
        self.assertIn("Safety and ease of travel", COMPARE_SYSTEM_PROMPT)
        self.assertIn("Crowd level and overall value for money", COMPARE_SYSTEM_PROMPT)
        self.assertIn("pick ONE winner", COMPARE_SYSTEM_PROMPT)

    def test_validate_valid_compare_payload(self):
        raw = {
            "winner": "Rishikesh",
            "winner_reason": "Rishikesh offers the highest match for adventure sports within budget.",
            "criteria": [
                {
                    "name": "Estimated total budget",
                    "scores": {"Rishikesh": 9, "Manali": 7, "Wayanad": 8},
                    "notes": {"Rishikesh": "Well within range", "Manali": "Transport higher", "Wayanad": "Moderate stay"},
                },
                {
                    "name": "Match with user interests",
                    "scores": {"Rishikesh": 10, "Manali": 8, "Wayanad": 7},
                    "notes": {"Rishikesh": "World-class rafting", "Manali": "Great trekking", "Wayanad": "Caves & trails"},
                },
            ],
            "overall_scores": {"Rishikesh": 9.5, "Manali": 7.5, "Wayanad": 7.5},
            "why_not_others": {
                "Manali": "Manali has higher transit times and costs from your origin.",
                "Wayanad": "Wayanad is greener but has fewer adventure sport options.",
            },
        }

        res = validate_compare_result(raw, self.places)
        self.assertEqual(res["winner"], "Rishikesh")
        self.assertEqual(len(res["criteria"]), 2)
        self.assertIn("Manali", res["why_not_others"])
        self.assertIn("Wayanad", res["why_not_others"])
        self.assertNotIn("Rishikesh", res["why_not_others"])

    def test_case_insensitive_matching(self):
        raw = {
            "winner": "rishikesh",
            "winner_reason": "Great adventure fit.",
            "criteria": [
                {
                    "name": "Budget",
                    "scores": {"RISHIKESH": 8, "manali": 6, "WAYANAD": 7},
                }
            ],
            "overall_scores": {"rishikesh": 8, "manali": 6, "wayanad": 7},
            "why_not_others": {"manali": "Slightly pricier.", "wayanad": "Farther away."},
        }

        res = validate_compare_result(raw, self.places)
        self.assertEqual(res["winner"], "Rishikesh")
        self.assertIn("Rishikesh", res["overall_scores"])
        self.assertEqual(res["overall_scores"]["Rishikesh"], 8.0)

    def test_parentheses_and_country_suffixes(self):
        raw = {
            "winner": "Manali (India)",
            "winner_reason": "Great mountain fit.",
            "criteria": [
                {
                    "name": "Budget",
                    "scores": {"Rishikesh (India)": 9, "Manali (India)": 8, "Wayanad (India)": 7},
                    "notes": {"Rishikesh (India)": "Good", "Manali (India)": "Good", "Wayanad (India)": "Good"},
                }
            ],
            "overall_scores": {"Rishikesh (India)": 8.4, "Manali (India)": 8.5, "Wayanad (India)": 7.9},
            "why_not_others": {"Rishikesh (India)": "Less trekking.", "Wayanad (India)": "Higher travel time."},
        }

        res = validate_compare_result(raw, self.places)
        self.assertEqual(res["winner"], "Manali")
        self.assertEqual(res["criteria"][0]["scores"]["Rishikesh"], 9.0)
        self.assertEqual(res["criteria"][0]["scores"]["Manali"], 8.0)
        self.assertEqual(res["criteria"][0]["scores"]["Wayanad"], 7.0)
        self.assertIn("Rishikesh", res["why_not_others"])

    def test_tie_breaking_picks_single_winner(self):
        raw = {
            "winner": "Manali",
            "winner_reason": "Tie-break on weather fit.",
            "criteria": [
                {
                    "name": "Activities",
                    "scores": {"Rishikesh": 8, "Manali": 8},
                }
            ],
            "overall_scores": {"Rishikesh": 8.0, "Manali": 8.0},
            "why_not_others": {"Rishikesh": "Close second."},
        }

        res = validate_compare_result(raw, ["Rishikesh", "Manali"])
        self.assertIn(res["winner"], ["Rishikesh", "Manali"])
        self.assertNotIn(res["winner"], res["why_not_others"])

    def test_reject_fewer_than_two_places(self):
        raw = {
            "winner": "Goa",
            "winner_reason": "Only place.",
            "criteria": [],
        }
        with self.assertRaises(ValueError):
            validate_compare_result(raw, ["Goa"])

    def test_reject_missing_criteria(self):
        raw = {
            "winner": "Rishikesh",
            "winner_reason": "Good.",
            "criteria": [],
            "overall_scores": {"Rishikesh": 8, "Manali": 7},
        }
        with self.assertRaises(ValueError):
            validate_compare_result(raw, ["Rishikesh", "Manali"])

    def test_server_compare_in_model_limits(self):
        prefs = QuestionnaireIn(
            diet="veg",
            budget="mid-range",
            duration_days=4,
            interests=["nature", "trekking"],
            companions="friends",
            origin="Delhi",
            start_date="November",
        )

        # 2 places: Valid
        body = CompareIn(
            preferences=prefs,
            destinations=[
                DestinationChoice(name="Rishikesh"),
                DestinationChoice(name="Manali"),
            ],
        )
        self.assertEqual(len(body.destinations), 2)

        # 4 places: Valid
        body4 = CompareIn(
            preferences=prefs,
            destinations=[
                DestinationChoice(name="Rishikesh"),
                DestinationChoice(name="Manali"),
                DestinationChoice(name="Wayanad"),
                DestinationChoice(name="Andaman Islands"),
            ],
        )
        self.assertEqual(len(body4.destinations), 4)


if __name__ == "__main__":
    unittest.main()
