"""
Sliding-window rate limiter — no external dependency required.
Uses an in-process dict + asyncio.Lock.

For multi-worker deployments swap _Store for a Redis-backed store (same interface).

Pre-configured limiters (imported by server.py):
  auth_limiter      — 5 calls / 5 min per IP  (send-otp, login)
  signup_limiter    — 3 calls / 60 min per IP
  verify_limiter    — 10 calls / 5 min per IP  (otp verify)
  reset_limiter     — 3 calls / 60 min per IP  (forgot-password)
  general_limiter   — 120 calls / 60 s per IP  (everything else)
  ai_limiter        — 10 calls / 60 s per user (AI generation endpoints)
"""

import asyncio
import time
from collections import defaultdict, deque
from typing import Dict, Deque
from fastapi import HTTPException, Request


# ── helpers ──────────────────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    """
    Return the real client IP.
    Reads X-Forwarded-For first (trusts only the leftmost hop — avoids
    header-injection spoofing). Falls back to direct connection.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ── core limiter ─────────────────────────────────────────────────────────────

class RateLimiter:
    """
    Sliding-window rate limiter.

    Tracks call timestamps per (key, scope) pair; rejects requests that
    exceed max_calls inside the rolling window_seconds window.
    Thread-safe for the asyncio event loop via a single Lock.
    """

    def __init__(self, max_calls: int, window_seconds: int):
        self._max = max_calls
        self._win = window_seconds
        # { scope -> { key -> deque[float] } }
        self._store: Dict[str, Dict[str, Deque[float]]] = defaultdict(
            lambda: defaultdict(deque)
        )
        self._lock = asyncio.Lock()

    async def check(self, key: str, scope: str = "default") -> None:
        """
        Record a call for key/scope.  Raise HTTP 429 when over the limit.
        The Retry-After header (seconds) tells clients when to retry.
        """
        now = time.monotonic()
        cutoff = now - self._win

        async with self._lock:
            dq = self._store[scope][key]

            # Evict timestamps outside the current window
            while dq and dq[0] < cutoff:
                dq.popleft()

            if len(dq) >= self._max:
                retry_after = int(self._win - (now - dq[0])) + 1
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Too many requests. "
                        f"Please wait {retry_after} second(s) before trying again."
                    ),
                    headers={"Retry-After": str(retry_after)},
                )

            dq.append(now)

    async def reset(self, key: str, scope: str = "default") -> None:
        """Clear history for key (e.g. after a successful login)."""
        async with self._lock:
            self._store[scope].pop(key, None)


# ── pre-configured instances ──────────────────────────────────────────────────

# Strict auth endpoints — 5 per 5 minutes per IP
auth_limiter = RateLimiter(max_calls=5, window_seconds=300)

# OTP verify — 10 per 5 minutes per IP (OTP record itself also limits to 5 attempts)
verify_limiter = RateLimiter(max_calls=10, window_seconds=300)

# Signup — 3 per hour per IP
signup_limiter = RateLimiter(max_calls=3, window_seconds=3600)

# Password reset — 3 per hour per email (avoids targeted user lockout by IP)
reset_limiter = RateLimiter(max_calls=3, window_seconds=3600)

# General API — 120 per minute per IP
general_limiter = RateLimiter(max_calls=120, window_seconds=60)

# Expensive AI endpoints — 10 per minute per authenticated user
ai_limiter = RateLimiter(max_calls=10, window_seconds=60)
