"""
test_pdf_service.py
Comprehensive test suite for the redesigned PDF service, image service, and PDF endpoints.
"""

import asyncio
import io
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_db")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-jwt-signing-only")

from pdf_service import (
    build_confirmation_pdf,
    build_itinerary_pdf,
    LOGO_PATH,
    _ensure_fonts,
    _support_email,
)
from image_service import (
    extract_photo_queries,
    fetch_itinerary_photos,
    _is_allowed_host,
    _cache_key,
    CACHE_DIR,
)


def _make_dummy_jpeg(width=400, height=300, color=(13, 92, 117)) -> bytes:
    im = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=75)
    return buf.getvalue()


class TestPdfBuilders(unittest.TestCase):
    """Test PDF generation for multiple booking shapes, edge cases, and text assertions."""

    def setUp(self):
        self.dummy_user = {
            "name": "Aarav Mehta",
            "email": "aarav.mehta@example.com",
            "phone": "+91 98765 00000",
        }

    def test_flight_booking_valid_pdf(self):
        booking = {
            "booking_id": "CG-2025-FLIGHT01",
            "destination": {"name": "Goa", "country": "India"},
            "transport_mode": "flight",
            "flight": {
                "airline": "Air India",
                "from": "BOM",
                "to": "GOI",
                "price": "₹6,500",
                "duration": "1h 15m",
            },
            "hotel": {"name": "Taj Exotica", "price_per_night": "₹14,000", "rating": 5},
            "room": {"label": "Sea View Villa"},
            "travelers": {"fullName": "Aarav Mehta", "email": "aarav@example.com", "numTravelers": 2},
            "pricing": {"subtotal": 28000, "taxes": 3360, "discount": 760, "grandTotal": 30600},
        }
        pdf = build_confirmation_pdf(booking, self.dummy_user)
        self.assertTrue(pdf.startswith(b"%PDF-"))
        self.assertGreater(len(pdf), 5000)

    def test_train_booking_valid_pdf(self):
        booking = {
            "booking_id": "CG-2025-TRAIN01",
            "destination": {"name": "Varanasi", "country": "India"},
            "transport_mode": "train",
            "train": {
                "name": "Vande Bharat Express",
                "train_number": "22436",
                "from": "NDLS",
                "to": "BSB",
                "departure_time": "06:00",
                "arrival_time": "14:00",
                "travel_class": "Executive Chair Car (EC)",
                "price": "₹3,400",
            },
            "hotel": {"name": "BrijRama Palace", "price_per_night": "₹18,000"},
            "travelers": {"fullName": "Pooja Verma", "numTravelers": 1},
            "pricing": {"grandTotal": 21400},
        }
        conf = build_confirmation_pdf(booking, self.dummy_user)
        self.assertTrue(conf.startswith(b"%PDF-"))
        itin = build_itinerary_pdf(booking)
        self.assertTrue(itin.startswith(b"%PDF-"))

    def test_old_booking_missing_fields_no_crash(self):
        empty_booking = {"booking_id": "CG-OLD-001"}
        conf = build_confirmation_pdf(empty_booking, {})
        self.assertTrue(conf.startswith(b"%PDF-"))
        itin = build_itinerary_pdf(empty_booking)
        self.assertTrue(itin.startswith(b"%PDF-"))

    def test_14_day_multipage_itinerary(self):
        days = []
        for d in range(1, 15):
            days.append({
                "day": d,
                "title": f"Grand Tour Day {d} Exploration",
                "location": f"Region {d}",
                "morning": {"activity": f"Morning trek to viewpoint {d}", "landmark": f"Point {d}"},
                "afternoon": {"activity": f"Cultural museum visit and local artisans in city {d}", "landmark": f"Museum {d}"},
                "evening": {"activity": f"Traditional cultural show and evening promenade {d}", "landmark": f"Promenade {d}"},
                "food": {"breakfast": "Local buffet", "lunch": "Artisan cafe", "dinner": "Heritage dining"},
                "notes": f"Important day {d} notes and suggestions.",
            })
        booking = {
            "booking_id": "CG-14DAY-01",
            "destination": {"name": "Kerala", "country": "India"},
            "schedule": days,
            "hotels": [{"name": "Kumarakom Lake Resort", "price_per_night": "₹16,000"}],
        }
        pdf = build_itinerary_pdf(booking)
        self.assertTrue(pdf.startswith(b"%PDF-"))
        self.assertGreater(len(pdf), 10000)

    def test_30_travelers_rendering(self):
        travelers_list = [{"name": f"Traveler #{i+1}", "age": 20 + i} for i in range(30)]
        booking = {
            "booking_id": "CG-GROUP-30",
            "destination": {"name": "Manali", "country": "India"},
            "travelers": {
                "fullName": "Group Leader",
                "numTravelers": 30,
                "list": travelers_list,
            },
            "pricing": {"grandTotal": 150000},
        }
        pdf = build_confirmation_pdf(booking, self.dummy_user)
        self.assertTrue(pdf.startswith(b"%PDF-"))

    def test_special_characters_and_script_injection(self):
        booking = {
            "booking_id": "CG-SPECIAL-CHARS",
            "destination": {"name": "<script>alert('xss')</script> Pondichéry & Kerala", "country": "Inde"},
            "notes": "Cost: ₹45,000 → Flight DEL → MAA; Café & Crêpes; élève; — dash.",
            "travelers": {"fullName": "René & François <admin@test.com>"},
            "pricing": {"grandTotal": 45000},
        }
        conf = build_confirmation_pdf(booking, self.dummy_user)
        self.assertTrue(conf.startswith(b"%PDF-"))
        itin = build_itinerary_pdf(booking)
        self.assertTrue(itin.startswith(b"%PDF-"))

    def test_text_contents_uncompressed(self):
        """Disable compression and verify expected texts and absence of 'Voyage' or corrupt symbols."""
        from reportlab import rl_config
        orig_comp = rl_config.pageCompression
        rl_config.pageCompression = 0
        try:
            booking = {
                "booking_id": "CG-TEXT-CHECK-01",
                "destination": {"name": "Shimla", "country": "India"},
                "travelers": {"fullName": "Vikram Malhotra"},
                "pricing": {"grandTotal": 12500, "discount": 760},
                "schedule": [
                    {"day": 1, "title": "Mall Road & Ridge", "morning": {"activity": "Walk"}, "food": {}}
                ],
            }
            conf = build_confirmation_pdf(booking, {"name": "Vikram Malhotra", "email": "vikram@example.com"})
            raw_conf_str = conf.decode("latin-1", errors="ignore")

            # Must contain brand, thank you, support email, rupee, traveler name
            self.assertIn("Chalo Ghumne", raw_conf_str)
            self.assertIn("Vikram Malhotra", raw_conf_str)
            self.assertTrue("Thank you for" in raw_conf_str and "Chalo Ghumne" in raw_conf_str)
            self.assertIn(_support_email(), raw_conf_str)
            # Rupee glyph (mapped to <20B9> in font CMap or direct UTF-8)
            self.assertTrue(b"20B9" in conf or b"20b9" in conf or "₹".encode("utf-8") in conf)

            # Must NOT contain old Voyage brand name
            self.assertNotIn("Voyage", raw_conf_str)

            # Must not contain corrupted footnote glyphs like ¹ next to numbers
            self.assertNotIn("¹", raw_conf_str)
        finally:
            rl_config.pageCompression = orig_comp

    def test_logo_file_exists(self):
        self.assertTrue(LOGO_PATH.exists(), f"Logo file missing at {LOGO_PATH}")


class TestImageService(unittest.TestCase):
    """Test photo query extraction, host filtering, cache behaviour, and fallbacks."""

    def test_extract_queries(self):
        itinerary = {
            "destination": {"name": "Pondicherry", "image_query": "Pondicherry French Town"},
            "schedule": [
                {
                    "day": 1,
                    "location": "White Town",
                    "morning": {"landmark": "Promenade Beach"},
                    "evening": {"activity": "Auroville Matrimandir tour"},
                }
            ],
            "hotels": [{"name": "Palais de Mahe", "image_query": "Palais de Mahe Pondicherry"}],
        }
        queries = extract_photo_queries(itinerary, max_queries=8)
        self.assertGreaterEqual(len(queries), 3)
        self.assertTrue(any("Pondicherry" in q for q in queries))

    def test_allowed_host_validation(self):
        self.assertTrue(_is_allowed_host("https://images.unsplash.com/photo-12345?w=800"))
        self.assertTrue(_is_allowed_host("https://api.unsplash.com/photos/123/download"))
        self.assertFalse(_is_allowed_host("https://malicious-site.com/photo.jpg"))
        self.assertFalse(_is_allowed_host("http://images.unsplash.com/insecure"))
        self.assertFalse(_is_allowed_host("ftp://images.unsplash.com/file"))

    def test_missing_api_key_returns_empty_fallback(self):
        with patch.dict(os.environ, {"UNSPLASH_ACCESS_KEY": ""}):
            photos = asyncio.run(fetch_itinerary_photos({"destination": "Goa"}))
            self.assertEqual(photos, [])

    def test_mocked_unsplash_fetch_and_cache(self):
        dummy_jpeg = _make_dummy_jpeg(600, 400)
        search_payload = {
            "results": [
                {
                    "id": "test_photo_1",
                    "urls": {"regular": "https://images.unsplash.com/test-photo-regular"},
                    "links": {"download_location": "https://api.unsplash.com/photos/test_photo_1/download"},
                }
            ]
        }

        mock_search_resp = MagicMock()
        mock_search_resp.status_code = 200
        mock_search_resp.json.return_value = search_payload

        mock_img_resp = MagicMock()
        mock_img_resp.status_code = 200
        mock_img_resp.headers = {"content-type": "image/jpeg"}
        mock_img_resp.content = dummy_jpeg

        mock_dl_resp = MagicMock()
        mock_dl_resp.status_code = 200

        call_counts = {"get": 0}

        async def mock_get(url, *args, **kwargs):
            call_counts["get"] += 1
            if "search" in url:
                return mock_search_resp
            elif "images.unsplash.com" in url:
                return mock_img_resp
            return mock_dl_resp

        with patch.dict(os.environ, {"UNSPLASH_ACCESS_KEY": "dummy_key_12345"}):
            with patch("httpx.AsyncClient.get", side_effect=mock_get):
                # 1st build: calls Unsplash API
                data = {"destination": {"name": "UnitTestDestination"}}
                photos = asyncio.run(fetch_itinerary_photos(data, max_photos=1))
                self.assertEqual(len(photos), 1)
                self.assertGreater(call_counts["get"], 0)

                # 2nd build with same query: cache hit, zero API calls
                initial_count = call_counts["get"]
                cached_photos = asyncio.run(fetch_itinerary_photos(data, max_photos=1))
                self.assertEqual(len(cached_photos), 1)
                self.assertEqual(call_counts["get"], initial_count)

    def test_size_guard_stays_under_3mb(self):
        dummy_photos = [_make_dummy_jpeg(800, 600) for _ in range(8)]
        booking = {
            "booking_id": "CG-SIZE-GUARD",
            "destination": {"name": "Pondicherry"},
            "schedule": [{"day": i, "title": f"Day {i}", "morning": {"activity": "Explore"}} for i in range(1, 6)],
        }
        pdf = build_itinerary_pdf(booking, images=dummy_photos)
        self.assertLess(len(pdf), 3 * 1024 * 1024)


class TestEndpoints(unittest.TestCase):
    """Test server endpoints for authorization, validation, and PDF downloads."""

    @classmethod
    def setUpClass(cls):
        from server import app
        from starlette.testclient import TestClient
        from auth import create_token
        cls.client = TestClient(app)
        cls.user_id = "user_test_alice"
        cls.other_id = "user_test_bob"
        cls.token_alice = create_token(cls.user_id, role="user")
        cls.token_bob = create_token(cls.other_id, role="user")

    def _make_mock_db(self, booking=None, user=None):
        mock_db = MagicMock()
        mock_db.bookings.find_one = AsyncMock(return_value=booking)
        mock_db.users.find_one = AsyncMock(return_value=user)
        mock_db.itineraries.find_one = AsyncMock(return_value=None)
        mock_db.pdf_image_cache.find_one = AsyncMock(return_value=None)
        mock_db.pdf_image_cache.update_one = AsyncMock(return_value=None)
        return mock_db

    def test_anonymous_get_pdf_401(self):
        resp = self.client.get("/api/bookings/CG-2025-123/pdf/confirmation")
        self.assertEqual(resp.status_code, 401)

    def test_anonymous_post_pdf_401(self):
        resp = self.client.post("/api/itinerary/pdf", json={"destination": "Manali"})
        self.assertEqual(resp.status_code, 401)

    def test_invalid_pdf_kind_returns_400(self):
        mock_db = self._make_mock_db(booking={"user_id": self.user_id})
        with patch("server.db", mock_db):
            resp = self.client.get(
                "/api/bookings/CG-2025-123/pdf/unknown_kind",
                headers={"Authorization": f"Bearer {self.token_alice}"},
            )
            self.assertEqual(resp.status_code, 400)

    def test_non_owner_returns_404(self):
        # Alice owns the booking; Bob requests it -> 404
        mock_db = self._make_mock_db(booking={"booking_id": "CG-123", "user_id": self.user_id})
        with patch("server.db", mock_db):
            resp = self.client.get(
                "/api/bookings/CG-123/pdf/confirmation",
                headers={"Authorization": f"Bearer {self.token_bob}"},
            )
            self.assertEqual(resp.status_code, 404)

    def test_owner_can_download_confirmation_pdf(self):
        booking = {
            "booking_id": "CG-123",
            "user_id": self.user_id,
            "destination": {"name": "Jaipur"},
            "pricing": {"grandTotal": 20000},
        }
        mock_db = self._make_mock_db(
            booking=booking,
            user={"name": "Alice", "email": "alice@test.com"},
        )
        with patch("server.db", mock_db):
            resp = self.client.get(
                "/api/bookings/CG-123/pdf/confirmation",
                headers={"Authorization": f"Bearer {self.token_alice}"},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.headers["content-type"], "application/pdf")
            self.assertIn("attachment", resp.headers["content-disposition"])
            self.assertIn("ChaloGhumne-Confirmation-CG-123.pdf", resp.headers["content-disposition"])
            self.assertTrue(resp.content.startswith(b"%PDF-"))

    def test_post_itinerary_pdf_payload_too_large_413(self):
        giant_payload = {"destination": "A" * 1_200_000}
        resp = self.client.post(
            "/api/itinerary/pdf",
            json=giant_payload,
            headers={"Authorization": f"Bearer {self.token_alice}"},
        )
        self.assertEqual(resp.status_code, 413)

    def test_post_itinerary_pdf_success(self):
        itinerary = {
            "destination": {"name": "Rishikesh"},
            "title": "Rishikesh Adventure",
            "schedule": [
                {"day": 1, "title": "Arrival", "morning": {"activity": "Rafting"}, "food": {}}
            ],
        }
        mock_db = self._make_mock_db()
        with patch("server.db", mock_db):
            resp = self.client.post(
                "/api/itinerary/pdf",
                json=itinerary,
                headers={"Authorization": f"Bearer {self.token_alice}"},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.headers["content-type"], "application/pdf")
            self.assertIn("ChaloGhumne-Itinerary", resp.headers["content-disposition"])
            self.assertTrue(resp.content.startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
