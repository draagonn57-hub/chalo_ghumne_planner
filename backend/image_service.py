"""
Image fetching and caching service for Chalo Ghumne PDF generation.

Fetches destination and landmark photos from the Unsplash API to use
as watermarks in generated PDFs.

Security & Safety:
  - API keys read from environment only; never logged or returned.
  - Strict host whitelist: only api.unsplash.com and images.unsplash.com.
  - SSRF protection: never fetches user- or itinerary-supplied URLs.
  - Size guard: max 3 MB per image download.
  - Pillow decompression bomb guard via Image.MAX_IMAGE_PIXELS.
  - Resized to max 900px, JPEG quality ~70 for small PDF size.
  - Timeouts: 5s per request, ~12s total budget.
  - Cache: disk cache under backend/cache/images/ and optional MongoDB collection.
  - Graceful fallback: on any error, missing key, or timeout, returns [] without failing.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from PIL import Image

logger = logging.getLogger(__name__)

# Guard against decompression bomb DOS attacks
Image.MAX_IMAGE_PIXELS = 10_000_000

CACHE_DIR = Path(__file__).parent / "cache" / "images"

ALLOWED_HOSTS = {
    "api.unsplash.com",
    "images.unsplash.com",
}


def _ensure_cache_dir() -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return CACHE_DIR


def _cache_key(query: str) -> str:
    norm = re.sub(r"\s+", " ", query.strip().lower())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def _get_api_key() -> str:
    return os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()


def extract_photo_queries(data: Dict[str, Any], max_queries: int = 8) -> List[str]:
    """Extract distinct landmark / destination search queries from booking or itinerary."""
    if not isinstance(data, dict):
        return []

    # Unwrap if wrapped inside booking
    itin = data.get("itinerary") if "itinerary" in data and isinstance(data["itinerary"], dict) else data

    queries: List[str] = []

    def _add(q: Any):
        if not q:
            return
        s = str(q).strip()
        if len(s) >= 3 and s not in queries:
            queries.append(s)

    # 1. Destination name & query
    dest = itin.get("destination") or data.get("destination") or {}
    if isinstance(dest, dict):
        dest_name = dest.get("name") or ""
        _add(dest.get("image_query"))
        _add(dest_name)
    elif isinstance(dest, str):
        dest_name = dest
        _add(dest)
    else:
        dest_name = data.get("destination_name") or ""
        _add(dest_name)

    # 2. Landmarks list
    landmarks = itin.get("landmarks") or []
    if isinstance(landmarks, list):
        for lm in landmarks:
            if isinstance(lm, dict):
                lm_name = lm.get("name") or ""
                lm_q = lm.get("image_query")
                if lm_q:
                    _add(lm_q)
                elif lm_name and dest_name:
                    _add(f"{lm_name} {dest_name}")
                elif lm_name:
                    _add(lm_name)

    # 3. Schedule / days
    schedule = itin.get("schedule") or []
    if isinstance(schedule, list):
        for day in schedule:
            if not isinstance(day, dict):
                continue
            day_loc = day.get("location")
            if day_loc and dest_name and day_loc != dest_name:
                _add(f"{day_loc} {dest_name}")

            for slot in ("morning", "afternoon", "evening"):
                slot_data = day.get(slot)
                if isinstance(slot_data, dict):
                    lm = slot_data.get("landmark")
                    act = slot_data.get("activity")
                    if lm and dest_name:
                        _add(f"{lm} {dest_name}")
                    elif lm:
                        _add(lm)
                    elif act and dest_name and len(act) < 40:
                        _add(f"{act} {dest_name}")

            food = day.get("food")
            if isinstance(food, dict) and food.get("image_query"):
                _add(food.get("image_query"))

    # 4. Hotels
    hotels = itin.get("hotels") or []
    if isinstance(hotels, list):
        for h in hotels:
            if isinstance(h, dict):
                hq = h.get("image_query") or h.get("name")
                if hq and dest_name:
                    _add(f"{hq} {dest_name}")

    # Fallback if too few
    if dest_name and len(queries) < 4:
        _add(f"{dest_name} travel")
        _add(f"{dest_name} landscape")
        _add(f"{dest_name} tourism")
        _add(f"{dest_name} view")

    return queries[:max_queries]


def _is_allowed_host(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme == "https" and parsed.netloc in ALLOWED_HOSTS
    except Exception:
        return False


def _load_from_disk_cache(key: str) -> Optional[bytes]:
    try:
        fp = CACHE_DIR / f"{key}.jpg"
        if fp.is_file():
            data = fp.read_bytes()
            if len(data) > 100:
                return data
    except Exception as exc:
        logger.debug("Disk cache read error: %s", exc)
    return None


def _save_to_disk_cache(key: str, data: bytes) -> None:
    try:
        _ensure_cache_dir()
        fp = CACHE_DIR / f"{key}.jpg"
        fp.write_bytes(data)
    except Exception as exc:
        logger.debug("Disk cache write error: %s", exc)


def _process_image_bytes(raw: bytes) -> Optional[bytes]:
    """Validate, resize to max 900px, and re-encode as JPEG ~70."""
    if not raw or len(raw) > 3 * 1024 * 1024:
        return None
    try:
        im = Image.open(io.BytesIO(raw))
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail((900, 900), Image.Resampling.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="JPEG", quality=70, optimize=True)
        return out.getvalue()
    except Exception as exc:
        logger.debug("Image processing failed: %s", exc)
        return None


async def _fetch_single_photo(
    client: httpx.AsyncClient,
    query: str,
    api_key: str,
    db: Any = None,
) -> Optional[bytes]:
    """Fetch one photo for a query, using cache first."""
    key = _cache_key(query)

    # 1. Disk cache
    cached = _load_from_disk_cache(key)
    if cached:
        return cached

    # 2. MongoDB cache
    if db is not None:
        try:
            doc = await db.pdf_image_cache.find_one({"key": key})
            if doc and "data" in doc:
                raw_cached = doc["data"]
                _save_to_disk_cache(key, raw_cached)
                return raw_cached
        except Exception as exc:
            logger.debug("Mongo cache lookup failed: %s", exc)

    # 3. Unsplash Search API
    search_url = "https://api.unsplash.com/search/photos"
    headers = {
        "Authorization": f"Client-ID {api_key}",
        "Accept-Version": "v1",
    }
    params = {
        "query": query,
        "per_page": "1",
        "orientation": "landscape",
    }

    try:
        resp = await client.get(search_url, params=params, headers=headers, timeout=5.0)
        if resp.status_code != 200:
            logger.info("Unsplash search returned status %s for query", resp.status_code)
            return None

        data = resp.json()
        results = data.get("results") or []
        if not results:
            return None

        photo = results[0]
        urls = photo.get("urls") or {}
        # Prefer regular (~1080) or small (~400), or raw with w=800
        download_url = urls.get("regular") or urls.get("small") or urls.get("raw")
        if not download_url:
            return None

        # Add w=800 if supported
        if "images.unsplash.com" in download_url and "?" not in download_url:
            download_url = f"{download_url}?w=800&q=80"
        elif "images.unsplash.com" in download_url:
            download_url = f"{download_url}&w=800"

        # SSRF check: MUST be an allowed Unsplash host
        if not _is_allowed_host(download_url):
            logger.warning("Rejected non-Unsplash image download host: %s", urlparse(download_url).netloc)
            return None

        # Download photo bytes
        img_resp = await client.get(download_url, timeout=5.0)
        if img_resp.status_code != 200:
            return None

        content_type = img_resp.headers.get("content-type", "")
        if "image" not in content_type:
            return None

        processed = _process_image_bytes(img_resp.content)
        if not processed:
            return None

        # Ping download_location endpoint per Unsplash API guidelines
        links = photo.get("links") or {}
        dl_loc = links.get("download_location")
        if dl_loc and _is_allowed_host(dl_loc):
            try:
                await client.get(dl_loc, headers=headers, timeout=3.0)
            except Exception:
                pass

        # Save to disk cache
        _save_to_disk_cache(key, processed)

        # Save to Mongo cache if DB available
        if db is not None:
            try:
                import datetime
                await db.pdf_image_cache.update_one(
                    {"key": key},
                    {
                        "$set": {
                            "key": key,
                            "query": query,
                            "data": processed,
                            "created_at": datetime.datetime.now(datetime.timezone.utc),
                        }
                    },
                    upsert=True,
                )
            except Exception as exc:
                logger.debug("Mongo cache save failed: %s", exc)

        return processed

    except Exception as exc:
        logger.info("Unsplash fetch failed for query: %s", type(exc).__name__)
        return None


async def fetch_itinerary_photos(
    data: Dict[str, Any],
    max_photos: int = 8,
    db: Any = None,
) -> List[bytes]:
    """
    Fetch up to max_photos distinct photos for the itinerary or booking.
    Returns list of processed JPEG bytes.
    On any error, missing key, or timeout, gracefully returns [] or whatever photos succeeded.
    """
    api_key = _get_api_key()
    if not api_key:
        return []

    queries = extract_photo_queries(data, max_queries=max_photos)
    if not queries:
        return []

    photos: List[bytes] = []

    try:
        # Strict total budget of 12 seconds
        async with httpx.AsyncClient(follow_redirects=True) as client:
            tasks = [
                _fetch_single_photo(client, q, api_key, db=db)
                for q in queries
            ]
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=12.0,
            )
            for res in results:
                if isinstance(res, bytes) and len(res) > 0:
                    photos.append(res)
    except asyncio.TimeoutError:
        logger.info("Image fetching overall budget timed out (12s limit reached)")
    except Exception as exc:
        logger.info("Image fetching encounter error: %s", type(exc).__name__)

    return photos[:max_photos]
