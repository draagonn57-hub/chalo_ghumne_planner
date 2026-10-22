"""
JWT + bcrypt authentication helpers.

Security changes (security/app branch):
  * JWT default expiry reduced from 168 h → 24 h; hard-capped at 72 h
  * jti (JWT ID) added to every token — enables per-token revocation
  * Generic 401 message on token failures — no oracle information
  * bcrypt gensalt() cost factor is 12 by default in bcrypt 4.x (unchanged)
  * require_admin returns 403 (not 404) to avoid route-existence leaks
"""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Header
from typing import Optional

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"

# Default 24 h; operator may raise via env var but we cap at 72 h.
_configured = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))
JWT_EXPIRE_HOURS = min(_configured, 72)  # hard cap — never more than 3 days


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (auto-generates a unique salt)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """
    Constant-time bcrypt comparison.
    Returns False on any error so failed-hash-format never leaks info.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str = "user") -> str:
    """
    Issue a signed JWT.

    Payload:
      sub  — user UUID (sourced from DB)
      role — "user" | "admin" (sourced from DB, NEVER from client input)
      jti  — unique token ID (prerequisite for per-token revocation)
      iat  — issued-at timestamp
      exp  — expiry timestamp
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises jwt exceptions on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency — validates the Bearer token and returns
    {"user_id": ..., "role": ..., "jti": ...}.

    Returns HTTP 401 with a GENERIC message on any failure.
    Distinguishing 'expired' from 'invalid' is acceptable (doesn't help attackers)
    but we never reveal algorithm issues, signature details, etc.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        return {
            "user_id": payload["sub"],
            "role": payload.get("role", "user"),
            "jti": payload.get("jti", ""),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again.",
        )
    except Exception:
        # Generic — do NOT leak whether the token is malformed,
        # wrong algorithm, wrong secret, etc.
        raise HTTPException(status_code=401, detail="Authentication required")


async def require_admin(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency — requires a valid JWT AND role == "admin".
    Returns 403 (Forbidden) rather than 404 so the route existence isn't hidden,
    but the real user data is still protected.
    """
    user = await get_current_user(authorization)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return user
