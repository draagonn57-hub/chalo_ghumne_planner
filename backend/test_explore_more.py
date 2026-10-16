"""
Unit tests for Explore More Places feature in Chalo Ghumne.
Tests destination normalization, deduplication, suggestion filtering, and model schema.
"""

import unittest
from backend.ai_service import (
    normalize_destination_name,
    is_duplicate_destination,
    _validate_and_filter_suggestions,
)
from backend.server import QuestionnaireIn


class TestExploreMoreDeduplication(unittest.TestCase):
    def test_normalize_destination_name(self):
        # Case and whitespace normalization
        self.assertEqual(normalize_destination_name("  Goa  "), "goa")
        self.assertEqual(normalize_destination_name("NEW DELHI!"), "new delhi")
        
        # Indian city aliases
        self.assertEqual(normalize_destination_name("Bengaluru"), "bangalore")
        self.assertEqual(normalize_destination_name("Bangalore"), "bangalore")
        self.assertEqual(normalize_destination_name("Puducherry"), "pondicherry")
        self.assertEqual(normalize_destination_name("Pondicherry"), "pondicherry")
        self.assertEqual(normalize_destination_name("Varanasi"), "varanasi")
        self.assertEqual(normalize_destination_name("Banaras"), "varanasi")
        self.assertEqual(normalize_destination_name("Kashi"), "varanasi")
        self.assertEqual(normalize_destination_name("Bombay"), "mumbai")
        self.assertEqual(normalize_destination_name("Mumbai"), "mumbai")
        self.assertEqual(normalize_destination_name("Prayagraj"), "allahabad")
        self.assertEqual(normalize_destination_name("Allahabad"), "allahabad")
        self.assertEqual(normalize_destination_name("Madras"), "chennai")
        self.assertEqual(normalize_destination_name("Chennai"), "chennai")
        self.assertEqual(normalize_destination_name("Calcutta"), "kolkata")
        self.assertEqual(normalize_destination_name("Kolkata"), "kolkata")
        self.assertEqual(normalize_destination_name("Panaji"), "goa")
        self.assertEqual(normalize_destination_name("North Goa"), "goa")
        self.assertEqual(normalize_destination_name("South Goa"), "goa")

    def test_is_duplicate_destination(self):
        excluded = ["Goa", "Jaipur", "Manali", "Kerala", "Bangalore"]

        # Exact matches (case-insensitive)
        self.assertTrue(is_duplicate_destination("Goa", excluded))
        self.assertTrue(is_duplicate_destination("goa", excluded))
        self.assertTrue(is_duplicate_destination("Jaipur", excluded))
        self.assertTrue(is_duplicate_destination("jaipur", excluded))

        # Alias matches
        self.assertTrue(is_duplicate_destination("Bengaluru", excluded))
        self.assertTrue(is_duplicate_destination("Panaji", excluded))
        self.assertTrue(is_duplicate_destination("North Goa", excluded))

        # Substring / variant matches
        self.assertTrue(is_duplicate_destination("Old Manali", excluded))
        self.assertTrue(is_duplicate_destination("Manali Himachal", excluded))

        # Fresh non-duplicate destinations
        self.assertFalse(is_duplicate_destination("Udaipur", excluded))
        self.assertFalse(is_duplicate_destination("Munnar", excluded))
        self.assertFalse(is_duplicate_destination("Rishikesh", excluded))
        self.assertFalse(is_duplicate_destination("Coorg", excluded))
        self.assertFalse(is_duplicate_destination("Shillong", excluded))

    def test_validate_and_filter_suggestions(self):
        raw_items = [
            {"name": "Goa", "country": "India", "why": "Beaches", "image_query": "Goa beach"},
            {"name": "Udaipur", "country": "India", "why": "Lakes", "image_query": "Udaipur lake palace"},
            {"name": "Munnar", "country": "India", "why": "Tea hills", "image_query": "Munnar tea estates"},
            {"name": "Rishikesh", "country": "India", "why": "Adventure", "image_query": "Rishikesh rafting"},
            {"name": "Shillong", "country": "India", "why": "Waterfalls", "image_query": "Shillong hills"},
        ]
        excluded = ["Goa", "Jaipur"]

        validated = _validate_and_filter_suggestions(raw_items, excluded)

        # "Goa" should be filtered out because it is in excluded list
        names = [item["name"] for item in validated]
        self.assertNotIn("Goa", names)
        self.assertIn("Udaipur", names)
        self.assertIn("Munnar", names)
        self.assertIn("Rishikesh", names)
        self.assertIn("Shillong", names)
        self.assertEqual(len(validated), 4)

    def test_filter_batch_duplicates(self):
        raw_with_duplicates = [
            {"name": "Munnar", "country": "India", "why": "Tea hills"},
            {"name": "munnar", "country": "India", "why": "Tea hills"},
            {"name": "Udaipur", "country": "India", "why": "Lakes"},
            {"name": "Rishikesh", "country": "India", "why": "River"},
            {"name": "Ooty", "country": "India", "why": "Mountains"},
        ]
        validated = _validate_and_filter_suggestions(raw_with_duplicates, [])
        names = [item["name"] for item in validated]
        # Only one Munnar should remain
        self.assertEqual(names.count("Munnar"), 1)
        self.assertEqual(len(validated), 4)

    def test_questionnaire_in_model_with_exclude_destinations(self):
        # Without exclude_destinations (backward compatibility)
        data1 = {
            "diet": "veg",
            "budget": "budget",
            "travel_type": "domestic",
            "duration_days": 5,
            "interests": ["Nature", "Adventure"],
            "companions": "solo",
        }
        model1 = QuestionnaireIn(**data1)
        self.assertEqual(model1.exclude_destinations, [])

        # With exclude_destinations
        data2 = {
            **data1,
            "exclude_destinations": ["Goa", "Jaipur", "Manali", "Kerala"],
        }
        model2 = QuestionnaireIn(**data2)
        self.assertEqual(model2.exclude_destinations, ["Goa", "Jaipur", "Manali", "Kerala"])


if __name__ == "__main__":
    unittest.main()
