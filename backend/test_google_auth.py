"""
Unit tests for Google Identity Services Authentication in Chalo Ghumne.
Tests UserModel schema, password optionality, googleId, authProvider,
and POST /api/auth/google endpoint behavior.
"""

import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from server import UserModel, User, SignupIn, GoogleAuthIn, sanitize, google_auth
from auth import create_token, decode_token


class TestGoogleAuthModel(unittest.TestCase):
    def test_user_model_fields(self):
        # Password should be optional (None by default)
        user = UserModel(
            name="John Doe",
            email="john@example.com",
            googleId="google_123456",
            authProvider="google",
        )
        self.assertIsNone(user.password)
        self.assertIsNone(user.password_hash)
        self.assertEqual(user.googleId, "google_123456")
        self.assertEqual(user.authProvider, "google")
        self.assertEqual(user.role, "user")

    def test_local_user_model_defaults(self):
        user = UserModel(
            name="Jane Doe",
            email="jane@example.com",
            password="securepassword123",
        )
        self.assertEqual(user.authProvider, "local")
        self.assertIsNone(user.googleId)

    def test_signup_in_optional_password(self):
        signup_data = SignupIn(
            name="Test",
            email="test@example.com",
        )
        self.assertIsNone(signup_data.password)

    def test_google_auth_in_payload_extraction(self):
        # Via credential
        payload1 = GoogleAuthIn(credential="mock_cred_token")
        self.assertEqual(payload1.get_token(), "mock_cred_token")

        # Via token
        payload2 = GoogleAuthIn(token="mock_direct_token")
        self.assertEqual(payload2.get_token(), "mock_direct_token")

        # Via id_token
        payload3 = GoogleAuthIn(id_token="mock_id_token")
        self.assertEqual(payload3.get_token(), "mock_id_token")

    def test_sanitize_removes_sensitive_fields(self):
        doc = {
            "_id": "mongo_id_123",
            "id": "uuid-123",
            "name": "Alex",
            "email": "alex@example.com",
            "password": "secret_password",
            "password_hash": "$2b$12$hashed_secret",
            "googleId": "gid_456",
            "authProvider": "google",
        }
        sanitized = sanitize(doc)
        self.assertNotIn("_id", sanitized)
        self.assertNotIn("password", sanitized)
        self.assertNotIn("password_hash", sanitized)
        self.assertEqual(sanitized["googleId"], "gid_456")
        self.assertEqual(sanitized["authProvider"], "google")


class TestGoogleAuthEndpoint(unittest.IsolatedAsyncioTestCase):
    @patch("server.id_token.verify_oauth2_token")
    @patch("server.db")
    async def test_google_auth_new_user_creation(self, mock_db, mock_verify):
        # Mock Google token payload
        mock_verify.return_value = {
            "sub": "google_unique_id_999",
            "email": "traveler@gmail.com",
            "email_verified": True,
            "name": "Happy Traveler",
            "picture": "https://example.com/avatar.jpg",
        }

        # Mock MongoDB: user does not exist yet
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="mock_id"))

        body = GoogleAuthIn(credential="valid_google_jwt_token")
        response = await google_auth(body)

        self.assertIn("token", response)
        self.assertIn("user", response)
        self.assertEqual(response["user"]["email"], "traveler@gmail.com")
        self.assertEqual(response["user"]["name"], "Happy Traveler")
        self.assertEqual(response["user"]["googleId"], "google_unique_id_999")
        self.assertEqual(response["user"]["authProvider"], "google")

        # Verify decoded JWT token
        decoded = decode_token(response["token"])
        self.assertEqual(decoded["sub"], response["user"]["id"])

    @patch("server.id_token.verify_oauth2_token")
    @patch("server.db")
    async def test_google_auth_existing_user_login(self, mock_db, mock_verify):
        # Mock Google token payload
        mock_verify.return_value = {
            "sub": "google_unique_id_888",
            "email": "existing@gmail.com",
            "email_verified": True,
            "name": "Existing User",
            "picture": "https://example.com/pic.jpg",
        }

        # Mock MongoDB: user already exists
        existing_user = {
            "_id": "mongo_obj_id",
            "id": "existing-uuid-123",
            "name": "Existing User",
            "email": "existing@gmail.com",
            "googleId": "google_unique_id_888",
            "authProvider": "google",
            "role": "user",
            "avatar": "https://example.com/pic.jpg",
            "preferences": {},
        }
        mock_db.users.find_one = AsyncMock(return_value=existing_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

        body = GoogleAuthIn(credential="valid_google_jwt_token")
        response = await google_auth(body)

        self.assertIn("token", response)
        self.assertEqual(response["user"]["id"], "existing-uuid-123")
        self.assertEqual(response["user"]["email"], "existing@gmail.com")


if __name__ == "__main__":
    unittest.main()
