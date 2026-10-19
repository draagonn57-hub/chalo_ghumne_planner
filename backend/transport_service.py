"""
transport_service.py
Real train (Parse IRCTC API) and flight (SerpAPI) data for Chalo Ghumne.

Rules:
- API keys are read from env vars only; NEVER logged or returned to client.
- No AI / Gemini calls. No estimated or dummy data.
- Two-level cache:
    L1 – in-process dict  (fast, no I/O)
    L2 – MongoDB          (survives restarts)
  Train search: 24 h TTL.  Fare: 48 h TTL.
- In-flight deduplication: identical concurrent requests share one API call.
- Fares fetched only on demand (one class, one call) — never upfront.
- On 429 / credits exhausted: 1-hour backoff, serve stale cache if present.
"""

from __future__ import annotations

import os
import time
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

logger = logging.getLogger("transport")

# ── Config ─────────────────────────────────────────────────────────────────────

# Parse IRCTC (new primary source)
PARSE_KEY      = os.environ.get("PARSE_API_KEY", "")
PARSE_BASE     = os.environ.get("PARSE_IRCTC_BASE_URL", "").rstrip("/")

# SerpAPI flights (unchanged)
SERPAPI_KEY    = os.environ.get("SERPAPI_KEY", "")
SERPAPI_BASE   = "https://serpapi.com/search.json"

# RapidAPI Railway (fallback when Parse is down)
RAPIDAPI_KEY   = os.environ.get("RAPIDAPI_KEY", "")
RAPIDAPI_HOST  = os.environ.get("RAPIDAPI_RAILWAY_HOST", "")
RAPIDAPI_BASE  = "https://irctc-indian-railway-pnr-status.p.rapidapi.com"

REQUEST_TIMEOUT = 45          # seconds — Parse IRCTC scrapes in real time, needs headroom

# Cache TTLs (seconds)
TRAIN_TTL  = 24 * 3600        # 24 hours
FARE_TTL   = 48 * 3600        # 48 hours
FLIGHT_TTL = 5  * 60          # 5 minutes (prices change fast)

# Backoff duration after 429 / credits exhausted
BACKOFF_TTL = 3600            # 1 hour

# ── MongoDB handle (injected at startup) ───────────────────────────────────────
# server.py calls  transport_service.init_db(db)  after Motor connects.
_db = None

def init_db(motor_db) -> None:
    global _db
    _db = motor_db

async def _cache_collection():
    """Return the transport_cache collection, creating TTL index once."""
    col = _db["transport_cache"]
    # MongoDB TTL index deletes documents after expires_at
    await col.create_index("expires_at", expireAfterSeconds=0, background=True)
    return col

# ── In-process (L1) cache ──────────────────────────────────────────────────────
_l1: dict[str, tuple[float, object]] = {}          # key → (stored_at, value)

def _l1_get(key: str, ttl: int) -> Optional[object]:
    entry = _l1.get(key)
    if entry and (time.time() - entry[0]) < ttl:
        return entry[1]
    return None

def _l1_set(key: str, value: object) -> None:
    _l1[key] = (time.time(), value)

# ── In-process backoff state ───────────────────────────────────────────────────
_backoff_until: float = 0.0          # epoch seconds

def _is_backed_off() -> bool:
    return time.time() < _backoff_until

def _set_backoff() -> None:
    global _backoff_until
    _backoff_until = time.time() + BACKOFF_TTL
    logger.warning("Parse IRCTC API: 1-hour backoff started (quota/rate-limit hit).")

# ── In-flight deduplication ────────────────────────────────────────────────────
# Maps cache-key → asyncio.Future whose result is the API response.
_in_flight: dict[str, asyncio.Future] = {}

# ── MongoDB L2 cache helpers ───────────────────────────────────────────────────

async def _l2_get(key: str) -> Optional[object]:
    if _db is None:
        return None
    try:
        col  = await _cache_collection()
        doc  = await col.find_one({"_id": key}, {"_id": 0, "value": 1})
        return doc["value"] if doc else None
    except Exception as exc:
        logger.debug("L2 cache read failed (%s)", type(exc).__name__)
        return None

async def _l2_set(key: str, value: object, ttl: int) -> None:
    if _db is None:
        return
    try:
        col = await _cache_collection()
        expires = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        await col.replace_one(
            {"_id": key},
            {"_id": key, "value": value, "expires_at": expires},
            upsert=True,
        )
    except Exception as exc:
        logger.debug("L2 cache write failed (%s)", type(exc).__name__)

async def _cache_get(key: str, ttl: int) -> Optional[object]:
    """Check L1 first, then L2."""
    v = _l1_get(key, ttl)
    if v is not None:
        return v
    v = await _l2_get(key)
    if v is not None:
        _l1_set(key, v)          # warm L1
        return v
    return None

async def _cache_set(key: str, value: object, ttl: int) -> None:
    _l1_set(key, value)
    await _l2_set(key, value, ttl)

# ── Parse IRCTC API helper ─────────────────────────────────────────────────────

def _parse_headers() -> dict:
    return {
        "X-API-Key":     PARSE_KEY,
        "Content-Type":  "application/json",
    }

async def _parse_post(endpoint: str, body: dict) -> dict:
    """
    POST to Parse IRCTC with timeout and error handling.
    Returns response dict with _http_status added.
    On timeout, returns 503 to trigger RapidAPI fallback.
    Raises RuntimeError on auth/quota issues.
    """
    url = f"{PARSE_BASE}/{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:  # 10s timeout (was 45s, too long)
            resp = await client.post(url, json=body, headers=_parse_headers())

        if resp.status_code in (429, 402):
            _set_backoff()
            raise RuntimeError("CREDITS_EXHAUSTED")

        return {"_http_status": resp.status_code, **resp.json()}
    
    except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadTimeout) as e:
        # Parse API timeout or connection issue — return 503 to trigger fallback
        logger.warning("Parse API timeout/unavailable (%s): %s", type(e).__name__, str(e)[:100])
        return {"_http_status": 503, "error": "Parse API timeout"}
    
    except Exception as e:
        # Any other error — also trigger fallback
        logger.error("Parse POST error (%s): %s", type(e).__name__, str(e)[:100])
        return {"_http_status": 503, "error": str(e)[:50]}

# ── City lookup tables ─────────────────────────────────────────────────────────

CITY_TO_STATION: dict[str, str] = {
    "mumbai":             "CSMT",
    "bombay":             "CSMT",
    "delhi":              "NDLS",
    "new delhi":          "NDLS",
    "bengaluru":          "SBC",
    "bangalore":          "SBC",
    "chennai":            "MAS",
    "madras":             "MAS",
    "kolkata":            "KOAA",
    "calcutta":           "KOAA",
    "hyderabad":          "HYB",
    "ahmedabad":          "ADI",
    "surat":              "ST",
    "pune":               "PUNE",
    "jaipur":             "JP",
    "lucknow":            "LKO",
    "kanpur":             "CNB",
    "nagpur":             "NGP",
    "patna":              "PNBE",
    "bhopal":             "BPL",
    "indore":             "INDB",
    "vadodara":           "BRC",
    "baroda":             "BRC",
    "agra":               "AGC",
    "varanasi":           "BSB",
    "amritsar":           "ASR",
    "chandigarh":         "CDG",
    "coimbatore":         "CBE",
    "kochi":              "ERS",
    "cochin":             "ERS",
    "thiruvananthapuram": "TVC",
    "trivandrum":         "TVC",
    "madurai":            "MDU",
    "visakhapatnam":      "VSKP",
    "vizag":              "VSKP",
    "guwahati":           "GHY",
    "bhubaneswar":        "BBS",
    "raipur":             "R",
    "ranchi":             "RNC",
    "jodhpur":            "JU",
    "udaipur":            "UDZ",
    "ajmer":              "AII",
    "gwalior":            "GWL",
    "srinagar":           "JAT",
    "jammu":              "JAT",
    "dehradun":           "DDN",
    "haridwar":           "HW",
    "rishikesh":          "RKSH",
    "allahabad":          "PRYJ",
    "prayagraj":          "PRYJ",
    "gorakhpur":          "GKP",
    "meerut":             "MTC",
    "faridabad":          "FDB",
    "gurgaon":            "GGN",
    "gurugram":           "GGN",
    "noida":              "DLI",
    "thane":              "TNA",
    "navi mumbai":        "PNVL",
    "nashik":             "NK",
    "aurangabad":         "AWB",
    "vijayawada":         "BZA",
    "tirupati":           "TPTY",
    "mysuru":             "MYS",
    "mysore":             "MYS",
    "mangaluru":          "MAJN",
    "mangalore":          "MAJN",
    "hubli":              "UBL",
    "dharwad":            "DWR",
    "belgaum":            "BGM",
    "belagavi":           "BGM",
    "shimla":             "SML",
    "kasol":              "PTK",
    "manali":             "PTK",
    "dharamshala":        "PTKC",
    "leh":                "JAT",
    "darjeeling":         "NJP",
    "gangtok":            "NJP",
    "shillong":           "GHY",
    "munnar":             "ERS",
    "ooty":               "CBE",
    "thekkady":           "ERS",
    "goa":                "MAO",
    "panaji":             "MAO",
    "panjim":             "MAO",
    "margao":             "MAO",
    "pondicherry":        "PDY",
    "puducherry":         "PDY",
    "gujarat":            "ADI",
}

CITY_TO_IATA: dict[str, str] = {
    "mumbai":             "BOM",
    "bombay":             "BOM",
    "delhi":              "DEL",
    "new delhi":          "DEL",
    "bengaluru":          "BLR",
    "bangalore":          "BLR",
    "chennai":            "MAA",
    "madras":             "MAA",
    "kolkata":            "CCU",
    "calcutta":           "CCU",
    "hyderabad":          "HYD",
    "ahmedabad":          "AMD",
    "surat":              "STV",
    "pune":               "PNQ",
    "jaipur":             "JAI",
    "lucknow":            "LKO",
    "nagpur":             "NAG",
    "patna":              "PAT",
    "bhopal":             "BHO",
    "indore":             "IDR",
    "vadodara":           "BDQ",
    "baroda":             "BDQ",
    "agra":               "AGR",
    "varanasi":           "VNS",
    "amritsar":           "ATQ",
    "chandigarh":         "IXC",
    "coimbatore":         "CJB",
    "kochi":              "COK",
    "cochin":             "COK",
    "thiruvananthapuram": "TRV",
    "trivandrum":         "TRV",
    "madurai":            "IXM",
    "visakhapatnam":      "VTZ",
    "vizag":              "VTZ",
    "guwahati":           "GAU",
    "bhubaneswar":        "BBI",
    "raipur":             "RPR",
    "ranchi":             "IXR",
    "jodhpur":            "JDH",
    "udaipur":            "UDR",
    "ajmer":              "JAI",
    "gwalior":            "GWL",
    "srinagar":           "SXR",
    "jammu":              "IXJ",
    "dehradun":           "DED",
    "haridwar":           "DED",
    "goa":                "GOI",
    "panaji":             "GOI",
    "panjim":             "GOI",
    "margao":             "GOI",
    "pondicherry":        "PNY",
    "puducherry":         "PNY",
    "leh":                "IXL",
    "darjeeling":         "IXB",
    "gangtok":            "IXB",
    "shillong":           "SHL",
    "mysuru":             "MYQ",
    "mysore":             "MYQ",
    "mangaluru":          "IXE",
    "mangalore":          "IXE",
    "hubli":              "HBX",
    "tirupati":           "TIR",
    "vijayawada":         "VGA",
    "kasol":              "ATQ",
    "manali":             "BHO",
    "munnar":             "COK",
    "ooty":               "CJB",
    "thekkady":           "COK",
    "dharamshala":        "DHM",
    "gujarat":            "AMD",
    "shimla":             "SLV",
}

def _normalize_city(city: str) -> str:
    """
    Normalize a city string for lookup.
    Handles formats like:
      "Surat"
      "Surat, Gujarat"
      "Surat, Gujarat, India"
      "Surat (STV)"
    Extracts just the primary city name.
    """
    if not city:
        return ""
    # Take only the part before the first comma
    primary = city.split(",")[0].strip()
    # Remove parenthetical suffixes like "(STV)"
    primary = primary.split("(")[0].strip()
    return primary.lower()


def city_to_station(city: str) -> Optional[str]:
    return CITY_TO_STATION.get(_normalize_city(city))


def city_to_iata(city: str) -> Optional[str]:
    return CITY_TO_IATA.get(_normalize_city(city))

# ── Weekday helper ─────────────────────────────────────────────────────────────

_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

def _runs_on_date(running_days: dict, date_iso: str) -> bool:
    """
    Returns True if the train runs on the weekday of date_iso (YYYY-MM-DD).
    running_days = {"mon": true/false, "tue": true/false, ...}
    """
    try:
        dt  = datetime.strptime(date_iso, "%Y-%m-%d")
        key = _WEEKDAY_KEYS[dt.weekday()]   # Monday=0
        return bool(running_days.get(key, True))
    except Exception:
        return True     # if we can't parse, don't hide the train

# ── Train search ───────────────────────────────────────────────────────────────

async def _fetch_trains_parse(
    from_code: str,
    to_code: str,
    date_iso: str,
) -> list:
    """
    Fetch trains via Parse IRCTC (primary) or RapidAPI (fallback).
    Handles deduplication: two simultaneous identical requests share one call.
    """
    cache_key = f"trains:{from_code}:{to_code}:{date_iso}"

    # L1 + L2 cache check
    cached = await _cache_get(cache_key, TRAIN_TTL)
    if cached is not None:
        logger.info("cache hit  trains %s→%s %s", from_code, to_code, date_iso)
        return cached

    # In-flight dedup
    if cache_key in _in_flight:
        logger.info("in-flight dedup trains %s→%s %s", from_code, to_code, date_iso)
        return await asyncio.shield(_in_flight[cache_key])

    loop   = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    _in_flight[cache_key] = future

    try:
        logger.info("API call   trains %s→%s %s  (Parse IRCTC)", from_code, to_code, date_iso)
        body = {
            "date":                date_iso,
            "source_station":      from_code,
            "destination_station": to_code,
        }
        data = await _parse_post("search_trains", body)
        http_status = data.pop("_http_status", 200)

        # If Parse times out (503), fallback to RapidAPI
        if http_status == 503:
            logger.warning("Parse API timeout (503) — falling back to RapidAPI")
            trains = await _rapidapi_trains(from_code, to_code, date_iso)
            if trains:
                await _cache_set(cache_key, trains, TRAIN_TTL)
                future.set_result(trains)
                return trains
            # If RapidAPI also fails, return empty
            future.set_result([])
            return []

        if http_status == 429 or http_status == 402:
            _set_backoff()
            future.set_exception(RuntimeError("CREDITS_EXHAUSTED"))
            raise RuntimeError("CREDITS_EXHAUSTED")

        if http_status != 200:
            raise RuntimeError(f"search_trains HTTP {http_status}")

        # Parse response
        inner  = data.get("data") or data
        trains = (inner.get("trains") if isinstance(inner, dict) else None) or []

        await _cache_set(cache_key, trains, TRAIN_TTL)
        future.set_result(trains)
        return trains

    except RuntimeError:
        future.set_exception(RuntimeError("CREDITS_EXHAUSTED"))
        raise

    except Exception as exc:
        future.set_exception(exc)
        raise

    finally:
        _in_flight.pop(cache_key, None)


async def _rapidapi_trains(from_code: str, to_code: str, date_iso: str) -> list:
    """Fallback train search via RapidAPI when Parse is down."""
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
    }
    
    # RapidAPI endpoint format: /between/{from}/{to}?date=DD-MM-YYYY
    date_parts = date_iso.split("-")  # YYYY-MM-DD
    date_formatted = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]}"  # DD-MM-YYYY
    
    url = f"{RAPIDAPI_BASE}/between/{from_code}/{to_code}?date={date_formatted}"
    
    try:
        logger.info("RapidAPI fallback   trains %s→%s %s", from_code, to_code, date_iso)
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, headers=headers)
        
        if resp.status_code != 200:
            logger.warning("RapidAPI HTTP %d", resp.status_code)
            return []
        
        body = resp.json()
        if not body.get("success"):
            logger.warning("RapidAPI success=false")
            return []
        
        # RapidAPI format: {"data": {"trains": [...]}}
        trains_raw = (body.get("data") or {}).get("trains", [])
        
        result = []
        for t in trains_raw:
            # Map RapidAPI field names to our normalized format
            running_str = t.get("running_days", "1111111")  # e.g., "1111111" = all days
            running_days = {
                "mon": running_str[0] == "1",
                "tue": running_str[1] == "1",
                "wed": running_str[2] == "1",
                "thu": running_str[3] == "1",
                "fri": running_str[4] == "1",
                "sat": running_str[5] == "1",
                "sun": running_str[6] == "1",
            } if len(running_str) == 7 else {"mon": True, "tue": True, "wed": True, "thu": True, "fri": True, "sat": True, "sun": True}
            
            result.append({
                "train_name": t.get("train_name", ""),
                "train_number": t.get("train_no", ""),
                "from_station": from_code,
                "to_station": to_code,
                "departure_time": t.get("from_time", ""),
                "arrival_time": t.get("to_time", ""),
                "duration": t.get("travel_time", ""),
                "distance": "",
                "available_classes": [],
                "running_days": running_days,
            })
        
        logger.info("RapidAPI found %d trains", len(result))
        return result
        
    except Exception as e:
        logger.error("RapidAPI fallback error: %s", e)
        return []



async def get_trains(
    origin_city: str,
    dest_city: str,
    date_iso: str,
) -> dict:
    """
    Returns {"trains": [...], "error": None, "stale": False}
    Train shape (no fares — fetched on demand):
      name, number, from_station, to_station,
      departure_time, arrival_time, duration, distance,
      runs_on {mon..sun},
      classes: [{name}]   ← price/price_int added later by get_fare()
    """
    from_code = city_to_station(origin_city)
    to_code   = city_to_station(dest_city)

    if not from_code:
        return {"trains": [], "error": f"No station code found for '{origin_city}'.", "stale": False}
    if not to_code:
        return {"trains": [], "error": f"No station code found for '{dest_city}'.", "stale": False}

    stale = False

    if _is_backed_off():
        # Serve stale cache if available
        cache_key = f"trains:{from_code}:{to_code}:{date_iso}"
        cached = await _l2_get(cache_key)     # ignore TTL — serve anything
        if cached:
            stale = True
            raw_trains = cached
            logger.info("serving stale cache during backoff  trains %s→%s", from_code, to_code)
        else:
            return {
                "trains": [],
                "error":  "Train data is temporarily unavailable. Check trains on IRCTC.",
                "irctc_link": "https://www.irctc.co.in",
                "stale":  False,
            }
    else:
        try:
            raw_trains = await _fetch_trains_parse(from_code, to_code, date_iso)
        except RuntimeError as e:
            # Credits exhausted — try stale
            cache_key = f"trains:{from_code}:{to_code}:{date_iso}"
            cached    = await _l2_get(cache_key)
            if cached:
                stale      = True
                raw_trains = cached
                logger.info("serving stale cache after credits error  trains %s→%s", from_code, to_code)
            else:
                return {
                    "trains": [],
                    "error":  "Train data is temporarily unavailable. Check trains on IRCTC.",
                    "irctc_link": "https://www.irctc.co.in",
                    "stale":  False,
                }
        except Exception as exc:
            logger.error("Train fetch error (%s) — masked", type(exc).__name__)
            return {"trains": [], "error": "Unable to load trains. Please try again.", "stale": False}

    if not raw_trains:
        return {"trains": [], "error": None, "stale": False}

    # Normalise and filter by running day
    result_trains = []
    for t in raw_trains:
        running_days = t.get("running_days") or {}
        if not _runs_on_date(running_days, date_iso):
            continue

        # Parse IRCTC field names
        number       = str(t.get("train_number") or "")
        name         = t.get("train_name") or number
        dep          = t.get("departure_time") or ""
        arr          = t.get("arrival_time") or ""
        dur          = t.get("duration") or ""
        from_stn     = t.get("from_station") or from_code
        to_stn       = t.get("to_station") or to_code
        distance     = t.get("distance") or ""
        avl_cls_raw  = t.get("available_classes") or []

        # Normalise class list to strings
        if avl_cls_raw and isinstance(avl_cls_raw[0], dict):
            avl_cls = [c.get("class_code") or c.get("name") or "" for c in avl_cls_raw]
        else:
            avl_cls = [str(c) for c in avl_cls_raw]
        avl_cls = [c for c in avl_cls if c]

        # Classes start with no price; fare fetched on chip click
        classes = [{"name": c, "price": None, "price_int": None} for c in avl_cls]

        result_trains.append({
            "name":           name,
            "number":         number,
            "from_station":   from_stn,
            "to_station":     to_stn,
            "departure_time": dep,
            "arrival_time":   arr,
            "duration":       dur,
            "distance":       distance,
            "runs_on":        running_days,
            "classes":        classes,
            "fare_quota_exceeded": False,
        })

    return {"trains": result_trains[:5], "error": None, "stale": stale}


# ── Fare (on-demand, one class at a time) ──────────────────────────────────────

async def get_fare(
    train_number: str,
    from_station: str,
    to_station: str,
    travel_class: str,
) -> dict:
    """
    Returns {"fare": 650, "price": "₹650", "error": None}
         or {"fare": None, "price": None,  "error": "..."}
    Called only when the user clicks a class chip.
    """
    cache_key = f"fare:{train_number}:{from_station}:{to_station}:{travel_class}"

    cached = await _cache_get(cache_key, FARE_TTL)
    if cached is not None:
        logger.info("cache hit  fare %s %s", train_number, travel_class)
        return cached

    if _is_backed_off():
        return {"fare": None, "price": None, "error": "Fare lookup temporarily unavailable."}

    # In-flight dedup
    if cache_key in _in_flight:
        logger.info("in-flight dedup fare %s %s", train_number, travel_class)
        return await asyncio.shield(_in_flight[cache_key])

    loop   = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    _in_flight[cache_key] = future

    try:
        logger.info("API call   fare %s %s %s→%s  (Parse IRCTC)", train_number, travel_class, from_station, to_station)
        body = {
            "train_number":        train_number,
            "source_station":      from_station,
            "destination_station": to_station,
            "travel_class":        travel_class,
        }
        data        = await _parse_post("get_fare", body)
        http_status = data.pop("_http_status", 200)

        if http_status == 422:
            # Class not available on this route — not a system error, don't retry
            err_msg = (data.get("error") or {}).get("message", "Class not available on this route.")
            logger.info("Fare 422 for %s %s: %s", train_number, travel_class, err_msg)
            result = {"fare": None, "price": None, "error": None, "unavailable": True}
            # Cache for a short time so repeated clicks don't re-hit the API
            await _cache_set(cache_key, result, 3600)
            future.set_result(result)
            return result

        if http_status != 200:
            raise RuntimeError(f"get_fare HTTP {http_status}")

        # Response: {"fare": {"total_fare": 650, ...}}
        fare_obj = (
            data.get("fare")
            or (data.get("data") or {}).get("fare")
            or {}
        )
        total = (
            fare_obj.get("total_fare")
            or fare_obj.get("totalFare")
            or fare_obj.get("fare")
        )
        fare_int = int(total) if total is not None else None

        result = {
            "fare":        fare_int,
            "price":       f"₹{fare_int:,}" if fare_int else None,
            "error":       None,
            "unavailable": False,
        }
        await _cache_set(cache_key, result, FARE_TTL)
        future.set_result(result)
        return result

    except RuntimeError as e:
        err_result = {"fare": None, "price": None, "error": "Fare lookup temporarily unavailable."}
        future.set_result(err_result)
        return err_result

    except Exception as exc:
        logger.error("Fare fetch error (%s) — masked", type(exc).__name__)
        err_result = {"fare": None, "price": None, "error": "Unable to fetch fare."}
        future.set_result(err_result)
        return err_result

    finally:
        _in_flight.pop(cache_key, None)


# ── Flight helpers (unchanged) ─────────────────────────────────────────────────

def _fmt_duration(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h}h {m:02d}m"


async def get_flights(
    origin_city: str,
    dest_city: str,
    date_iso: str,
) -> dict:
    dep_iata = city_to_iata(origin_city)
    arr_iata = city_to_iata(dest_city)

    if not dep_iata:
        return {"flights": [], "error": f"No airport code found for '{origin_city}'."}
    if not arr_iata:
        return {"flights": [], "error": f"No airport code found for '{dest_city}'."}

    cache_key = f"flights:{dep_iata}:{arr_iata}:{date_iso}"
    cached    = await _cache_get(cache_key, FLIGHT_TTL)
    if cached is not None:
        logger.info("cache hit  flights %s→%s %s", dep_iata, arr_iata, date_iso)
        return cached

    params = {
        "engine":        "google_flights",
        "departure_id":  dep_iata,
        "arrival_id":    arr_iata,
        "outbound_date": date_iso,
        "currency":      "INR",
        "hl":            "en",
        "type":          "2",
        "api_key":       SERPAPI_KEY,
    }

    try:
        logger.info("API call   flights %s→%s %s  (SerpAPI)", dep_iata, arr_iata, date_iso)
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(SERPAPI_BASE, params=params)
    except Exception as e:
        logger.error("Flight fetch error (%s)", type(e).__name__)
        return {"flights": [], "error": "Unable to load flights. Please try again."}

    if resp.status_code == 429:
        return {"flights": [], "error": "Flight search rate limit reached. Try again shortly."}
    if resp.status_code != 200:
        return {"flights": [], "error": f"Flight search failed (HTTP {resp.status_code})."}

    body       = resp.json()
    raw_groups = body.get("best_flights", []) + body.get("other_flights", [])

    if not raw_groups:
        result = {"flights": [], "error": None}
        await _cache_set(cache_key, result, FLIGHT_TTL)
        return result

    flights = []
    for group in raw_groups[:8]:
        legs = group.get("flights", [])
        if not legs:
            continue

        first_leg = legs[0]
        last_leg  = legs[-1]
        dep_info  = first_leg.get("departure_airport", {})
        arr_info  = last_leg.get("arrival_airport", {})

        dep_time = dep_info.get("time", "")
        arr_time = arr_info.get("time", "")
        dep_time = dep_time.split(" ")[-1][:5] if dep_time else ""
        arr_time = arr_time.split(" ")[-1][:5] if arr_time else ""

        total_min = group.get("total_duration") or sum(l.get("duration", 0) for l in legs)
        num_stops = len(legs) - 1
        stops_str = "Non-stop" if num_stops == 0 else f"{num_stops} stop{'s' if num_stops > 1 else ''}"

        price_raw = group.get("price")
        price_int = int(price_raw) if isinstance(price_raw, (int, float)) else None

        airlines       = list(dict.fromkeys(l.get("airline", "") for l in legs if l.get("airline")))
        airline        = " + ".join(airlines) if airlines else "Unknown"
        flight_numbers = [l.get("flight_number", "") for l in legs if l.get("flight_number")]
        flight_number  = " / ".join(flight_numbers)

        flights.append({
            "airline":        airline,
            "flight_number":  flight_number,
            "airline_logo":   first_leg.get("airline_logo") or group.get("airline_logo"),
            "from":           origin_city.title(),
            "to":             dest_city.title(),
            "from_iata":      dep_iata,
            "to_iata":        arr_iata,
            "departure_time": dep_time,
            "arrival_time":   arr_time,
            "duration":       _fmt_duration(total_min) if total_min else "",
            "stops":          stops_str,
            "price":          f"₹{price_int:,}" if price_int else None,
            "price_int":      price_int,
        })

    result = {"flights": flights, "error": None}
    await _cache_set(cache_key, result, FLIGHT_TTL)
    return result
