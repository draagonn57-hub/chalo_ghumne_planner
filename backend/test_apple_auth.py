"""
Unit tests for Apple Sign-In Authentication in Chalo Ghumne.
Tests UserModel schema, appleId, authProvider, JWKS token verification,
safe user profile parsing, and /api/auth/apple/callback endpoint behavior.
"""

import os
import json
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import Request

from server import (
    UserModel,
    AppleAuthIn,
    sanitize,
    apple_auth_callback,
)
from auth import create_token, decode_token
from apple_auth import (
    verify_apple_id_token,
    parse_apple_user_profile,
    APPLE_ISSUER,
)


class TestAppleAuthModelAndHelpers(unittest.TestCase):
    def test_user_model_apple_fields(self):
        user = UserModel(
            name="Tim Cook",
            email="tim@apple.com",
            appleId="apple_sub_123456",
            authProvider="apple",
        )
        self.assertIsNone(user.password)
        self.assertIsNone(user.password_hash)
        self.assertEqual(user.appleId, "apple_sub_123456")
        self.assertEqual(user.authProvider, "apple")
        self.assertEqual(user.role, "user")

    def test_apple_auth_in_payload_extraction(self):
        # Via id_token
        p1 = AppleAuthIn(id_token="mock_id_token")
        self.assertEqual(p1.get_token(), "mock_id_token")

        # Via credential
        p2 = AppleAuthIn(credential="mock_credential")
        self.assertEqual(p2.get_token(), "mock_credential")

        # Via token
        p3 = AppleAuthIn(token="mock_token")
        self.assertEqual(p3.get_token(), "mock_token")

    def test_sanitize_preserves_apple_fields(self):
        doc = {
            "_id": "mongo_id_999",
            "id": "uuid-apple-user",
            "name": "Craig Federighi",
            "email": "craig@apple.com",
            "password": "secret_password",
            "password_hash": "$2b$12$hashed",
            "appleId": "apple_sub_789",
            "authProvider": "apple",
        }
        sanitized = sanitize(doc)
        self.assertNotIn("_id", sanitized)
        self.assertNotIn("password", sanitized)
        self.assertNotIn("password_hash", sanitized)
        self.assertEqual(sanitized["appleId"], "apple_sub_789")
        self.assertEqual(sanitized["authProvider"], "apple")

    def test_parse_apple_user_profile(self):
        # Valid JSON string with full name and email (first-time sign in)
        first_time_json = json.dumps({
            "name": {"firstName": "Steve", "lastName": "Wozniak"},
            "email": "woz@apple.com",
        })
        profile = parse_apple_user_profile(first_time_json)
        self.assertEqual(profile["name"], "Steve Wozniak")
        self.assertEqual(profile["email"], "woz@apple.com")
        self.assertEqual(profile["first_name"], "Steve")
        self.assertEqual(profile["last_name"], "Wozniak")

        # Dict input with only firstName
        dict_profile = parse_apple_user_profile({
            "name": {"firstName": "Phil"},
            "email": "phil@apple.com",
        })
        self.assertEqual(dict_profile["name"], "Phil")
        self.assertEqual(dict_profile["email"], "phil@apple.com")

        # Subsequents sign-ins: None or empty payload
        empty_profile = parse_apple_user_profile(None)
        self.assertIsNone(empty_profile["name"])
        self.assertIsNone(empty_profile["email"])

        # Malformed JSON string should not crash
        malformed = parse_apple_user_profile("{invalid-json-content")
        self.assertIsNone(malformed["name"])
        self.assertIsNone(malformed["email"])


class TestAppleTokenVerification(unittest.TestCase):
    def test_test_mode_mock_token_decode(self):
        with patch.dict(os.environ, {"TESTING": "1", "APPLE_CLIENT_ID": "com.test.service"}):
            payload = verify_apple_id_token("mock_apple_jwt_123")
            self.assertEqual(payload["sub"], "apple_mock_apple_jwt_123")
            self.assertEqual(payload["iss"], APPLE_ISSUER)
            self.assertEqual(payload["aud"], "com.test.service")

    @patch("apple_auth.get_apple_jwk_client")
    def test_jwks_verification_with_rsa_claims(self, mock_get_jwk_client):
        # Generate temporary RSA key for test
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
        import jwt

        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
        public_key = private_key.public_key()

        mock_signing_key = MagicMock()
        mock_signing_key.key = public_key

        mock_jwk_client = MagicMock()
        mock_jwk_client.get_signing_key_from_jwt.return_value = mock_signing_key
        mock_get_jwk_client.return_value = mock_jwk_client

        token_payload = {
            "sub": "apple_verified_user_123",
            "email": "traveler@privaterelay.appleid.com",
            "iss": "https://appleid.apple.com",
            "aud": "com.chaloghumne.web.service",
        }
        token = jwt.encode(
            token_payload,
            private_key,
            algorithm="RS256",
            headers={"kid": "test_apple_kid_1"},
        )

        verified = verify_apple_id_token(token, audience="com.chaloghumne.web.service")
        self.assertEqual(verified["sub"], "apple_verified_user_123")
        self.assertEqual(verified["email"], "traveler@privaterelay.appleid.com")
        self.assertEqual(verified["iss"], "https://appleid.apple.com")
        self.assertEqual(verified["aud"], "com.chaloghumne.web.service")


class TestAppleAuthEndpoint(unittest.IsolatedAsyncioTestCase):
    @patch("server.verify_apple_id_token")
    @patch("server.db")
    async def test_apple_auth_new_user_json(self, mock_db, mock_verify):
        mock_verify.return_value = {
            "sub": "apple_unique_sub_1001",
            "email": "alice@privaterelay.appleid.com",
            "iss": "https://appleid.apple.com",
            "aud": "com.chaloghumne.web.service",
        }

        # User does not exist yet in MongoDB
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="mock_id"))

        # Build mock request
        mock_request = MagicMock(spec=Request)
        mock_request.headers = {"content-type": "application/json", "accept": "application/json"}
        mock_request.json = AsyncMock(return_value={
            "id_token": "valid_apple_token",
            "user": json.dumps({"name": {"firstName": "Alice", "lastName": "Wonderland"}}),
        })

        response = await apple_auth_callback(mock_request)

        self.assertIn("token", response)
        self.assertIn("user", response)
        self.assertEqual(response["user"]["email"], "alice@privaterelay.appleid.com")
        self.assertEqual(response["user"]["name"], "Alice Wonderland")
        self.assertEqual(response["user"]["appleId"], "apple_unique_sub_1001")
        self.assertEqual(response["user"]["authProvider"], "apple")

        # Verify decoded JWT
        decoded = decode_token(response["token"])
        self.assertEqual(decoded["sub"], response["user"]["id"])

    @patch("server.verify_apple_id_token")
    @patch("server.db")
    async def test_apple_auth_existing_user_form_urlencoded(self, mock_db, mock_verify):
        mock_verify.return_value = {
            "sub": "apple_sub_existing_2002",
            "email": "existing_apple@gmail.com",
            "iss": "https://appleid.apple.com",
            "aud": "com.chaloghumne.web.service",
        }

        existing_user = {
            "_id": "mongo_obj_apple",
            "id": "existing-apple-uuid",
            "name": "Existing Apple User",
            "email": "existing_apple@gmail.com",
            "appleId": "apple_sub_existing_2002",
            "authProvider": "apple",
            "role": "user",
            "preferences": {},
        }
        mock_db.users.find_one = AsyncMock(return_value=existing_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

        mock_request = MagicMock(spec=Request)
        mock_request.headers = {
            "content-type": "application/x-www-form-urlencoded",
            "accept": "application/json",
        }

        response = await apple_auth_callback(
            request=mock_request,
            id_token="valid_apple_token",
            code="auth_code_xyz",
            user=None, # user is None on subsequent logins
        )

        self.assertIn("token", response)
        self.assertEqual(response["user"]["id"], "existing-apple-uuid")
        self.assertEqual(response["user"]["email"], "existing_apple@gmail.com")

    @patch("server.verify_apple_id_token")
    @patch("server.db")
    async def test_apple_auth_browser_redirect_html_response(self, mock_db, mock_verify):
        mock_verify.return_value = {
            "sub": "apple_sub_browser_3003",
            "email": "browser_user@apple.com",
            "iss": "https://appleid.apple.com",
            "aud": "com.chaloghumne.web.service",
        }

        user_doc = {
            "_id": "mongo_obj_3003",
            "id": "browser-uuid-3003",
            "name": "Browser User",
            "email": "browser_user@apple.com",
            "appleId": "apple_sub_browser_3003",
            "authProvider": "apple",
            "role": "user",
            "preferences": {},
        }
        mock_db.users.find_one = AsyncMock(return_value=user_doc)

        mock_request = MagicMock(spec=Request)
        # Browser navigation GET/POST sends text/html
        mock_request.headers = {
            "content-type": "application/x-www-form-urlencoded",
            "accept": "text/html,application/xhtml+xml",
        }

        response = await apple_auth_callback(
            request=mock_request,
            id_token="valid_apple_token",
        )

        from fastapi.responses import HTMLResponse
        self.assertIsInstance(response, HTMLResponse)
        self.assertEqual(response.status_code, 200)
        self.assertIn("APPLE_AUTH_SUCCESS", response.body.decode())

    async def test_apple_auth_cancellation_error(self):
        mock_request = MagicMock(spec=Request)
        mock_request.headers = {"accept": "application/json"}

        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as cm:
            await apple_auth_callback(
                request=mock_request,
                error="user_cancelled_authorize",
            )
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("user_cancelled_authorize", cm.exception.detail)


if __name__ == "__main__":
    unittest.main()
