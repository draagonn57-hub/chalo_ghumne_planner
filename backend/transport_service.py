"""
transport_service.py
Real train (Railkit SDK via local bridge) and flight (SerpAPI) data.

Architecture:
  Python backend  →  local HTTP  →  railkit-bridge (Node.js)  →  Railkit SDK  →  Indian Railways
  Python backend  →  HTTPS       →  SerpAPI Google Flights

Rules:
- API keys read from env vars only; never logged or returned to client.
- Two-level cache:
    L1 – in-process dict  (fast, no I/O)
    L2 – MongoDB          (survives restarts)
  Train search: 24 h TTL.  Fare: 48 h TTL.
- In-flight deduplication: identical concurrent requests share one fetch.
- On 429 / bridge down: serve stale cache if present.
"""

from __future__ import annotations

import os
import time
import logging
import shutil
import asyncio
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger("transport")

# ── Config ─────────────────────────────────────────────────────────────────────

# Railkit bridge (Node.js micro-service, local only)
RAILKIT_BRIDGE_PORT   = int(os.environ.get("RAILKIT_BRIDGE_PORT", "7421"))
RAILKIT_BRIDGE_BASE   = f"http://127.0.0.1:{RAILKIT_BRIDGE_PORT}"
RAILKIT_API_KEY       = os.environ.get("RAILKIT_API_KEY", "")

# SerpAPI flights
SERPAPI_KEY  = os.environ.get("SERPAPI_KEY", "")
SERPAPI_BASE = "https://serpapi.com/search.json"

BRIDGE_TIMEOUT  = 20          # seconds for bridge calls (local, fast)
FLIGHT_TIMEOUT  = 20          # seconds for SerpAPI

# Cache TTLs
TRAIN_TTL  = 24 * 3600        # 24 h
FARE_TTL   = 48 * 3600        # 48 h
FLIGHT_TTL = 5  * 60          # 5 min

BACKOFF_TTL = 3600            # 1 h after repeated bridge failures

# ── MongoDB handle ─────────────────────────────────────────────────────────────
_db = None

def init_db(motor_db) -> None:
    global _db
    _db = motor_db

async def _cache_collection():
    col = _db["transport_cache"]
    await col.create_index("expires_at", expireAfterSeconds=0, background=True)
    return col

# ── L1 in-process cache ────────────────────────────────────────────────────────
_l1: dict[str, tuple[float, object]] = {}

def _l1_get(key: str, ttl: int) -> Optional[object]:
    entry = _l1.get(key)
    if entry and (time.time() - entry[0]) < ttl:
        return entry[1]
    return None

def _l1_set(key: str, value: object) -> None:
    _l1[key] = (time.time(), value)

# ── L2 MongoDB cache ───────────────────────────────────────────────────────────
async def _l2_get(key: str) -> Optional[object]:
    if _db is None:
        return None
    try:
        col = await _cache_collection()
        doc = await col.find_one({"_id": key}, {"_id": 0, "value": 1})
        return doc["value"] if doc else None
    except Exception as exc:
        logger.debug("L2 cache read failed (%s)", type(exc).__name__)
        return None

async def _l2_set(key: str, value: object, ttl: int) -> None:
    if _db is None:
        return
    try:
        col     = await _cache_collection()
        expires = datetime.now(timezone.utc) + timedelta(seconds=ttl)
        await col.replace_one(
            {"_id": key},
            {"_id": key, "value": value, "expires_at": expires},
            upsert=True,
        )
    except Exception as exc:
        logger.debug("L2 cache write failed (%s)", type(exc).__name__)

async def _cache_get(key: str, ttl: int) -> Optional[object]:
    v = _l1_get(key, ttl)
    if v is not None:
        return v
    v = await _l2_get(key)
    if v is not None:
        _l1_set(key, v)
        return v
    return None

async def _cache_set(key: str, value: object, ttl: int) -> None:
    _l1_set(key, value)
    await _l2_set(key, value, ttl)

# ── In-flight dedup ────────────────────────────────────────────────────────────
_in_flight: dict[str, asyncio.Future] = {}

# ── Backoff ────────────────────────────────────────────────────────────────────
_backoff_until: float = 0.0

def _is_backed_off() -> bool:
    return time.time() < _backoff_until

def _set_backoff() -> None:
    global _backoff_until
    _backoff_until = time.time() + BACKOFF_TTL
    logger.warning("Railkit bridge backoff started (1 h).")

# ── Railkit bridge process management ─────────────────────────────────────────
_bridge_proc: Optional[subprocess.Popen] = None

def start_bridge() -> None:
    """
    Spawn the Railkit Node.js bridge as a subprocess.
    Called once from server.py at startup.
    """
    global _bridge_proc

    bridge_dir = Path(__file__).parent.parent / "railkit-bridge"
    server_mjs = bridge_dir / "server.mjs"

    if not server_mjs.exists():
        logger.error("railkit-bridge/server.mjs not found at %s — train search disabled", server_mjs)
        return

    if not RAILKIT_API_KEY:
        logger.error("RAILKIT_API_KEY not set — train search disabled")
        return

    env = {**os.environ, "RAILKIT_API_KEY": RAILKIT_API_KEY, "RAILKIT_BRIDGE_PORT": str(RAILKIT_BRIDGE_PORT)}

    try:
        node_exe = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"

        _bridge_proc = subprocess.Popen(
            [node_exe, str(server_mjs)],
            cwd=str(bridge_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        logger.info("Railkit bridge started (PID %s) on port %s", _bridge_proc.pid, RAILKIT_BRIDGE_PORT)
    except FileNotFoundError:
        logger.error("node not found in PATH — Railkit bridge disabled. Install Node.js >= 18.")
    except Exception as exc:
        logger.error("Failed to start Railkit bridge: %s", exc)


def stop_bridge() -> None:
    """Terminate the bridge process on shutdown."""
    if _bridge_proc and _bridge_proc.poll() is None:
        _bridge_proc.terminate()
        logger.info("Railkit bridge terminated.")


async def _wait_for_bridge(timeout: float = 8.0) -> bool:
    """Poll /health until the bridge is ready or timeout expires."""
    deadline = time.time() + timeout
    async with httpx.AsyncClient(timeout=2.0) as client:
        while time.time() < deadline:
            try:
                r = await client.get(f"{RAILKIT_BRIDGE_BASE}/health")
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            await asyncio.sleep(0.4)
    return False


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
    # ── India ─────────────────────────────────────────────────────────────────
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
    "rishikesh":          "DED",
    "goa":                "GOI",
    "panaji":             "GOI",
    "panjim":             "GOI",
    "margao":             "GOI",
    "pondicherry":        "PNY",
    "puducherry":         "PNY",
    "leh":                "IXL",
    "darjeeling":         "IXB",
    "siliguri":           "IXB",
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
    "mcleod ganj":        "DHM",
    "gujarat":            "AMD",
    "shimla":             "SLV",
    "spiti valley":       "IXC",
    "spiti":              "IXC",
    "kasauli":            "IXC",
    "mussoorie":          "DED",
    "nainital":           "IXB",
    "corbett":            "IXB",
    "jim corbett":        "IXB",
    "auli":               "DED",
    "kedarnath":          "DED",
    "badrinath":          "DED",
    "hampi":              "HBX",
    "coorg":              "IXE",
    "kodagu":             "IXE",
    "varkala":            "TRV",
    "alleppey":           "COK",
    "alappuzha":          "COK",
    "kumarakom":          "COK",
    "kovalam":            "TRV",
    "mahabalipuram":      "MAA",
    "mamallapuram":       "MAA",
    "rameswaram":         "IXM",
    "madurai":            "IXM",
    "thanjavur":          "TRJ",
    "trichy":             "TRZ",
    "tiruchirappalli":    "TRZ",
    "tirunelveli":        "TRV",
    "salem":              "MAA",
    "erode":              "CBE",
    "vellore":            "MAA",
    "aurangabad":         "IXU",
    "nashik":             "ISK",
    "kolhapur":           "KLH",
    "solapur":            "SSE",
    "amravati":           "AMI",
    "shirdi":             "SAG",
    "ratnagiri":          "RTC",
    "sindhudurg":         "SDW",
    "alibaug":            "BOM",
    "lonavala":           "PNQ",
    "mahabaleshwar":      "PNQ",
    "panchgani":          "PNQ",
    "rajkot":             "RAJ",
    "bhavnagar":          "BHU",
    "jamnagar":           "JGA",
    "porbandar":          "PBD",
    "dwarka":             "JGA",
    "saputara":           "AMD",
    "diu":                "DIU",
    "daman":              "BOM",
    "silvassa":           "BOM",
    "kutch":              "BHJ",
    "bhuj":               "BHJ",
    "rann of kutch":      "BHJ",
    "bikaner":            "BKB",
    "jaisalmer":          "JSA",
    "kota":               "KTU",
    "mount abu":          "UDR",
    "pushkar":            "AII",
    "ajmer":              "AII",
    "bharatpur":          "AGR",
    "alwar":              "JAI",
    "sawai madhopur":     "JAI",
    "ranthambore":        "JAI",
    "agra":               "AGR",
    "mathura":            "AGR",
    "vrindavan":          "AGR",
    "fatehpur sikri":     "AGR",
    "jhansi":             "GWL",
    "khajuraho":          "HJR",
    "orchha":             "HJR",
    "pachmarhi":          "BHO",
    "kanha":              "JLR",
    "jabalpur":           "JLR",
    "bandhavgarh":        "JLR",
    "pench":              "JLR",
    "panna":              "KHJ",
    "satna":              "TNI",
    "bilaspur":           "PAB",
    "ambikapur":          "RGH",
    "jagdalpur":          "JGB",
    "bodhgaya":           "GAY",
    "gaya":               "GAY",
    "nalanda":            "GAY",
    "rajgir":             "GAY",
    "muzaffarpur":        "MZU",
    "darbhanga":          "DBR",
    "prayagraj":          "IXD",
    "allahabad":          "IXD",
    "kanpur":             "KNU",
    "agra":               "AGR",
    "meerut":             "DEL",
    "noida":              "DEL",
    "gurgaon":            "DEL",
    "gurugram":           "DEL",
    "faridabad":          "DEL",
    "panipat":            "DEL",
    "karnal":             "DEL",
    "kurukshetra":        "IXC",
    "ambala":             "IXC",
    "ludhiana":           "ATQ",
    "jalandhar":          "ATQ",
    "pathankot":          "IXP",
    "dharamsala":         "DHM",
    "kullu":              "KUU",
    "bhuntar":            "KUU",
    "spiti":              "IXC",
    "narkanda":           "SLV",
    "rampur":             "SLV",
    "sangla":             "SLV",
    "kasauli":            "IXC",
    "solan":              "IXC",
    "kalpa":              "SLV",
    "rekong peo":         "SLV",
    "tabo":               "IXC",
    "kaza":               "IXC",
    "lahaul":             "KUU",
    "parvati valley":     "KUU",
    "dibrugarh":          "DIB",
    "jorhat":             "JRH",
    "tezpur":             "TEZ",
    "silchar":            "IXS",
    "imphal":             "IMF",
    "agartala":           "IXA",
    "aizawl":             "AJL",
    "kohima":             "DMU",
    "dimapur":            "DMU",
    "itanagar":           "HGI",
    "pasighat":           "IXT",
    "port blair":         "IXZ",
    "andaman":            "IXZ",
    "nicobar":            "IXZ",
    "andaman and nicobar": "IXZ",
    "lakshadweep":        "AGX",
    "kavaratti":          "AGX",

    # ── Southeast Asia ────────────────────────────────────────────────────────
    "bangkok":            "BKK,DMK",
    "phuket":             "HKT",
    "chiang mai":         "CNX",
    "krabi":              "KBV",
    "koh samui":          "USM",
    "hat yai":            "HDY",
    "udon thani":         "UTH",
    "chiang rai":         "CEI",
    "pattaya":            "BKK,DMK",
    "hua hin":            "HHQ",
    "thailand":           "BKK,DMK",

    "singapore":          "SIN",

    "kuala lumpur":       "KUL",
    "kl":                 "KUL",
    "penang":             "PEN",
    "george town":        "PEN",
    "langkawi":           "LGK",
    "kota kinabalu":      "BKI",
    "kuching":            "KCH",
    "johor bahru":        "JHB",
    "malaysia":           "KUL",

    "bali":               "DPS",
    "denpasar":           "DPS",
    "jakarta":            "CGK,HLP",
    "yogyakarta":         "JOG,YIA",
    "surabaya":           "SUB",
    "lombok":             "LOP",
    "manado":             "MDC",
    "makassar":           "UPG",
    "medan":              "KNO",
    "balikpapan":         "BPN",
    "labuan bajo":        "LBJ",
    "flores":             "LBJ",
    "komodo":             "LBJ",
    "raja ampat":         "SOQ",
    "sorong":             "SOQ",
    "indonesia":          "CGK,HLP",

    "manila":             "MNL",
    "cebu":               "CEB",
    "davao":              "DVO",
    "boracay":            "MPH",
    "palawan":            "PPS",
    "puerto princesa":    "PPS",
    "el nido":            "ENI",
    "philippines":        "MNL",

    "hanoi":              "HAN",
    "ho chi minh city":   "SGN",
    "saigon":             "SGN",
    "da nang":            "DAD",
    "hoi an":             "DAD",
    "hue":                "HUI",
    "nha trang":          "CXR",
    "phu quoc":           "PQC",
    "dalat":              "DLI",
    "vietnam":            "SGN",

    "phnom penh":         "PNH",
    "siem reap":          "SAI",
    "angkor wat":         "SAI",
    "cambodia":           "PNH",

    "vientiane":          "VTE",
    "luang prabang":      "LPQ",
    "laos":               "VTE",

    "yangon":             "RGN",
    "rangoon":            "RGN",
    "mandalay":           "MDL",
    "bagan":              "NYU",
    "myanmar":            "RGN",
    "burma":              "RGN",

    "naypyidaw":          "NYT",

    "colombo":            "CMB",
    "sri lanka":          "CMB",
    "kandy":              "CMB",
    "sigiriya":           "CMB",
    "ella":               "CMB",
    "galle":              "CMB",

    "kathmandu":          "KTM",
    "nepal":              "KTM",
    "pokhara":            "PKR",
    "chitwan":            "BWA",

    "dhaka":              "DAC",
    "chittagong":         "CGP",
    "bangladesh":         "DAC",

    "male":               "MLE",
    "maldives":           "MLE",

    # ── East Asia ─────────────────────────────────────────────────────────────
    "tokyo":              "NRT,HND",
    "osaka":              "KIX,ITM",
    "kyoto":              "KIX,ITM",
    "nagoya":             "NGO",
    "sapporo":            "CTS",
    "fukuoka":            "FUK",
    "hiroshima":          "HIJ",
    "okinawa":            "OKA",
    "nara":               "KIX,ITM",
    "kobe":               "KIX,ITM",
    "sendai":             "SDJ",
    "nagasaki":           "NGS",
    "kagoshima":          "KOJ",
    "kumamoto":           "KMJ",
    "hokkaido":           "CTS",
    "niigata":            "KIJ",
    "kanazawa":           "KMQ",
    "matsuyama":          "MYJ",
    "takamatsu":          "TAK",
    "tokushima":          "TKS",
    "kochi":              "KCZ",
    "japan":              "NRT,HND",

    "beijing":            "PEK,PKX",
    "shanghai":           "PVG,SHA",
    "guangzhou":          "CAN",
    "shenzhen":           "SZX",
    "chengdu":            "CTU",
    "xi'an":              "XIY",
    "xian":               "XIY",
    "hangzhou":           "HGH",
    "chongqing":          "CKG",
    "kunming":            "KMG",
    "guilin":             "KWL",
    "zhangjiajie":        "DYG",
    "lhasa":              "LXA",
    "tibet":              "LXA",
    "wuhan":              "WUH",
    "nanjing":            "NKG",
    "harbin":             "HRB",
    "dalian":             "DLC",
    "qingdao":            "TAO",
    "sanya":              "SYX",
    "hainan":             "SYX",
    "lijiang":            "LJG",
    "dali":               "DLU",
    "jiuzhaigou":         "JZH",
    "huangshan":          "TXN",
    "urumqi":             "URC",
    "xinjiang":           "URC",
    "china":              "PEK,PKX",

    "hong kong":          "HKG",

    "taipei":             "TPE",
    "taichung":           "RMQ",
    "kaohsiung":          "KHH",
    "taiwan":             "TPE",

    "seoul":              "ICN,GMP",
    "busan":              "PUS",
    "jeju":               "CJU",
    "incheon":            "ICN",
    "south korea":        "ICN,GMP",
    "korea":              "ICN,GMP",

    "ulaanbaatar":        "ULN",
    "mongolia":           "ULN",

    # ── South Asia (non-India) ────────────────────────────────────────────────
    "islamabad":          "ISB",
    "lahore":             "LHE",
    "karachi":            "KHI",
    "peshawar":           "PEW",
    "pakistan":           "ISB",

    "kabul":              "KBL",
    "afghanistan":        "KBL",

    "tehran":             "IKA,THR",
    "isfahan":            "IFN",
    "shiraz":             "SYZ",
    "iran":               "IKA,THR",

    # ── Middle East ───────────────────────────────────────────────────────────
    "dubai":              "DXB,DWC",
    "abu dhabi":          "AUH",
    "sharjah":            "SHJ",
    "uae":                "DXB,DWC",
    "united arab emirates": "DXB,DWC",

    "riyadh":             "RUH",
    "jeddah":             "JED",
    "dammam":             "DMM",
    "saudi arabia":       "RUH",

    "doha":               "DOH",
    "qatar":              "DOH",

    "kuwait city":        "KWI",
    "kuwait":             "KWI",

    "muscat":             "MCT",
    "oman":               "MCT",
    "salalah":            "SLL",

    "manama":             "BAH",
    "bahrain":            "BAH",

    "amman":              "AMM",
    "jordan":             "AMM",
    "petra":              "AMM",

    "tel aviv":           "TLV",
    "jerusalem":          "TLV",
    "israel":             "TLV",

    "beirut":             "BEY",
    "lebanon":            "BEY",

    "istanbul":           "IST,SAW",
    "ankara":             "ESB",
    "izmir":              "ADB",
    "antalya":            "AYT",
    "cappadocia":         "NAV,ASR",
    "trabzon":            "TZX",
    "bodrum":             "BJV",
    "turkey":             "IST,SAW",

    # ── Europe ────────────────────────────────────────────────────────────────
    "london":             "LHR,LGW,STN,LTN,LCY",
    "manchester":         "MAN",
    "birmingham":         "BHX",
    "edinburgh":          "EDI",
    "glasgow":            "GLA",
    "bristol":            "BRS",
    "liverpool":          "LPL",
    "newcastle":          "NCL",
    "leeds":              "LBA",
    "belfast":            "BFS,BHD",
    "dublin":             "DUB",
    "cork":               "ORK",
    "uk":                 "LHR,LGW",
    "united kingdom":     "LHR,LGW",
    "england":            "LHR,LGW",
    "ireland":            "DUB",

    "paris":              "CDG,ORY",
    "nice":               "NCE",
    "lyon":               "LYS",
    "marseille":          "MRS",
    "bordeaux":           "BOD",
    "toulouse":           "TLS",
    "strasbourg":         "SXB",
    "france":             "CDG,ORY",

    "berlin":             "BER",
    "munich":             "MUC",
    "frankfurt":          "FRA",
    "hamburg":            "HAM",
    "dusseldorf":         "DUS",
    "cologne":            "CGN",
    "stuttgart":          "STR",
    "nuremberg":          "NUE",
    "germany":            "FRA",
    "deutschland":        "FRA",

    "madrid":             "MAD",
    "barcelona":          "BCN",
    "seville":            "SVQ",
    "valencia":           "VLC",
    "malaga":             "AGP",
    "bilbao":             "BIO",
    "ibiza":              "IBZ",
    "mallorca":           "PMI",
    "palma":              "PMI",
    "tenerife":           "TFN,TFS",
    "gran canaria":       "LPA",
    "spain":              "MAD",

    "rome":               "FCO,CIA",
    "milan":              "MXP,LIN",
    "venice":             "VCE",
    "florence":           "FLR",
    "naples":             "NAP",
    "bologna":            "BLQ",
    "turin":              "TRN",
    "palermo":            "PMO",
    "catania":            "CTA",
    "bari":               "BRI",
    "sardinia":           "CAG",
    "sicily":             "CTA",
    "italy":              "FCO,CIA",

    "amsterdam":          "AMS",
    "netherlands":        "AMS",
    "rotterdam":          "RTM",
    "eindhoven":          "EIN",

    "brussels":           "BRU",
    "belgium":            "BRU",

    "vienna":             "VIE",
    "salzburg":           "SZG",
    "innsbruck":          "INN",
    "austria":            "VIE",

    "zurich":             "ZRH",
    "geneva":             "GVA",
    "bern":               "BRN",
    "basel":              "BSL",
    "switzerland":        "ZRH",

    "lisbon":             "LIS",
    "porto":              "OPO",
    "faro":               "FAO",
    "algarve":            "FAO",
    "madeira":            "FNC",
    "azores":             "PDL",
    "portugal":           "LIS",

    "athens":             "ATH",
    "thessaloniki":       "SKG",
    "santorini":          "JTR",
    "mykonos":            "JMK",
    "crete":              "HER,CHQ",
    "corfu":              "CFU",
    "rhodes":             "RHO",
    "zakynthos":          "ZTH",
    "greece":             "ATH",

    "stockholm":          "ARN,BMA",
    "gothenburg":         "GOT",
    "malmo":              "MMX",
    "sweden":             "ARN,BMA",

    "oslo":               "OSL",
    "bergen":             "BGO",
    "norway":             "OSL",
    "tromsø":             "TOS",
    "tromso":             "TOS",
    "tromso":             "TOS",
    "lofoten":            "SVJ",

    "copenhagen":         "CPH",
    "denmark":            "CPH",
    "aarhus":             "AAR",

    "helsinki":           "HEL",
    "finland":            "HEL",
    "rovaniemi":          "RVN",

    "reykjavik":          "KEF",
    "iceland":            "KEF",

    "warsaw":             "WAW",
    "krakow":             "KRK",
    "gdansk":             "GDN",
    "poland":             "WAW",

    "prague":             "PRG",
    "czech republic":     "PRG",
    "czechia":            "PRG",
    "brno":               "BRQ",

    "budapest":           "BUD",
    "hungary":            "BUD",

    "bucharest":          "OTP",
    "romania":            "OTP",
    "cluj":               "CLJ",

    "sofia":              "SOF",
    "bulgaria":           "SOF",

    "belgrade":           "BEG",
    "serbia":             "BEG",

    "zagreb":             "ZAG",
    "dubrovnik":          "DBV",
    "split":              "SPU",
    "croatia":            "ZAG",

    "sarajevo":           "SJJ",
    "bosnia":             "SJJ",

    "tirana":             "TIA",
    "albania":            "TIA",

    "podgorica":          "TGD",
    "montenegro":         "TGD",

    "skopje":             "SKP",
    "north macedonia":    "SKP",

    "vilnius":            "VNO",
    "lithuania":          "VNO",
    "riga":               "RIX",
    "latvia":             "RIX",
    "tallinn":            "TLL",
    "estonia":            "TLL",

    "moscow":             "SVO,DME,VKO",
    "saint petersburg":   "LED",
    "st petersburg":      "LED",
    "novosibirsk":        "OVB",
    "yekaterinburg":      "SVX",
    "kazan":              "KZN",
    "russia":             "SVO,DME,VKO",

    "kyiv":               "KBP",
    "ukraine":            "KBP",
    "lviv":               "LWO",

    "minsk":              "MSQ",
    "belarus":            "MSQ",

    "chisinau":           "KIV",
    "moldova":            "KIV",

    "tbilisi":            "TBS",
    "georgia":            "TBS",
    "batumi":             "BUS",

    "yerevan":            "EVN",
    "armenia":            "EVN",

    "baku":               "GYD",
    "azerbaijan":         "GYD",

    "nur-sultan":         "NQZ",
    "astana":             "NQZ",
    "almaty":             "ALA",
    "kazakhstan":         "NQZ",

    "tashkent":           "TAS",
    "uzbekistan":         "TAS",
    "samarkand":          "SKD",
    "bukhara":            "BHK",

    "ashgabat":           "ASB",
    "turkmenistan":       "ASB",

    "bishkek":            "FRU",
    "kyrgyzstan":         "FRU",

    "dushanbe":           "DYU",
    "tajikistan":         "DYU",

    # ── Africa ────────────────────────────────────────────────────────────────
    "cairo":              "CAI",
    "egypt":              "CAI",
    "luxor":              "LXR",
    "aswan":              "ASW",
    "sharm el sheikh":    "SSH",
    "hurghada":           "HRG",

    "marrakech":          "RAK",
    "casablanca":         "CMN",
    "fez":                "FEZ",
    "rabat":              "RBA",
    "morocco":            "CMN",

    "tunis":              "TUN",
    "tunisia":            "TUN",
    "djerba":             "DJE",

    "algiers":            "ALG",
    "algeria":            "ALG",

    "tripoli":            "MJI",
    "libya":              "MJI",

    "nairobi":            "NBO",
    "kenya":              "NBO",
    "mombasa":            "MBA",
    "maasai mara":        "NBO",
    "amboseli":           "NBO",

    "dar es salaam":      "DAR",
    "zanzibar":           "ZNZ",
    "kilimanjaro":        "JRO",
    "arusha":             "ARK",
    "serengeti":          "SEU",
    "tanzania":           "DAR",

    "kampala":            "EBB",
    "uganda":             "EBB",
    "entebbe":            "EBB",
    "bwindi":             "ULU",

    "kigali":             "KGL",
    "rwanda":             "KGL",

    "addis ababa":        "ADD",
    "ethiopia":           "ADD",
    "lalibela":           "LLI",
    "gondar":             "GDQ",

    "johannesburg":       "JNB",
    "cape town":          "CPT",
    "durban":             "DUR",
    "kruger":             "MQP",
    "south africa":       "JNB",

    "victoria falls":     "VFA,LVI",
    "livingstone":        "LVI",
    "zambia":             "LUN",
    "lusaka":             "LUN",

    "harare":             "HRE",
    "zimbabwe":           "HRE",

    "gaborone":           "GBE",
    "botswana":           "GBE",
    "okavango":           "MUB",
    "maun":               "MUB",

    "windhoek":           "WDH",
    "namibia":            "WDH",

    "antananarivo":       "TNR",
    "madagascar":         "TNR",
    "nosy be":            "NOS",

    "mauritius":          "MRU",
    "seychelles":         "SEZ",
    "mahe":               "SEZ",
    "reunion":            "RUN",
    "comoros":            "HAH",

    "accra":              "ACC",
    "ghana":              "ACC",

    "lagos":              "LOS",
    "abuja":              "ABV",
    "nigeria":            "LOS",

    "dakar":              "DSS",
    "senegal":            "DSS",

    "abidjan":            "ABJ",
    "ivory coast":        "ABJ",

    "lome":               "LFW",
    "togo":               "LFW",

    "douala":             "DLA",
    "cameroon":           "DLA",

    "kinshasa":           "FIH",
    "drc":                "FIH",

    "luanda":             "LAD",
    "angola":             "LAD",

    # ── North America ─────────────────────────────────────────────────────────
    "new york":           "JFK,EWR,LGA",
    "nyc":                "JFK,EWR,LGA",
    "new york city":      "JFK,EWR,LGA",
    "los angeles":        "LAX",
    "la":                 "LAX",
    "chicago":            "ORD,MDW",
    "miami":              "MIA,FLL",
    "san francisco":      "SFO",
    "las vegas":          "LAS",
    "seattle":            "SEA",
    "boston":             "BOS",
    "washington dc":      "DCA,IAD,BWI",
    "washington":         "DCA,IAD,BWI",
    "dc":                 "DCA,IAD,BWI",
    "atlanta":            "ATL",
    "dallas":             "DFW,DAL",
    "houston":            "IAH,HOU",
    "denver":             "DEN",
    "phoenix":            "PHX",
    "orlando":            "MCO",
    "san diego":          "SAN",
    "minneapolis":        "MSP",
    "detroit":            "DTW",
    "portland":           "PDX",
    "new orleans":        "MSY",
    "nashville":          "BNA",
    "austin":             "AUS",
    "san antonio":        "SAT",
    "charlotte":          "CLT",
    "raleigh":            "RDU",
    "baltimore":          "BWI",
    "salt lake city":     "SLC",
    "kansas city":        "MCI",
    "st louis":           "STL",
    "honolulu":           "HNL",
    "hawaii":             "HNL",
    "maui":               "OGG",
    "anchorage":          "ANC",
    "alaska":             "ANC",
    "usa":                "JFK,EWR",
    "united states":      "JFK,EWR",

    "toronto":            "YYZ",
    "vancouver":          "YVR",
    "montreal":           "YUL",
    "calgary":            "YYC",
    "ottawa":             "YOW",
    "edmonton":           "YEG",
    "winnipeg":           "YWG",
    "quebec city":        "YQB",
    "halifax":            "YHZ",
    "canada":             "YYZ",

    "mexico city":        "MEX",
    "cancun":             "CUN",
    "guadalajara":        "GDL",
    "monterrey":          "MTY",
    "cabo san lucas":     "SJD",
    "puerto vallarta":    "PVR",
    "oaxaca":             "OAX",
    "merida":             "MID",
    "mexico":             "MEX",

    "havana":             "HAV",
    "cuba":               "HAV",

    "panama city":        "PTY",
    "panama":             "PTY",

    "san jose":           "SJO",
    "costa rica":         "SJO",

    "guatemala city":     "GUA",
    "guatemala":          "GUA",

    "tegucigalpa":        "TGU",
    "honduras":           "TGU",

    "managua":            "MGA",
    "nicaragua":          "MGA",

    "san salvador":       "SAL",
    "el salvador":        "SAL",

    "belize city":        "BZE",
    "belize":             "BZE",

    "nassau":             "NAS",
    "bahamas":            "NAS",

    "kingston":           "KIN",
    "jamaica":            "KIN",

    "santo domingo":      "SDQ",
    "dominican republic": "SDQ",
    "punta cana":         "PUJ",

    "san juan":           "SJU",
    "puerto rico":        "SJU",

    "port of spain":      "POS",
    "trinidad":           "POS",

    "barbados":           "BGI",

    # ── South America ─────────────────────────────────────────────────────────
    "sao paulo":          "GRU,CGH",
    "rio de janeiro":     "GIG,SDU",
    "rio":                "GIG,SDU",
    "brasilia":           "BSB",
    "salvador":           "SSA",
    "fortaleza":          "FOR",
    "recife":             "REC",
    "manaus":             "MAO",
    "belo horizonte":     "CNF",
    "curitiba":           "CWB",
    "florianopolis":      "FLN",
    "porto alegre":       "POA",
    "natal":              "NAT",
    "foz do iguacu":      "IGU",
    "iguazu falls":       "IGU,IGR",
    "amazon":             "MAO",
    "brazil":             "GRU,CGH",

    "buenos aires":       "EZE,AEP",
    "cordoba":            "COR",
    "mendoza":            "MDZ",
    "bariloche":          "BRC",
    "ushuaia":            "USH",
    "patagonia":          "USH",
    "argentina":          "EZE,AEP",

    "santiago":           "SCL",
    "chile":              "SCL",
    "atacama":            "CJC",
    "san pedro de atacama": "CJC",
    "torres del paine":   "PUQ",

    "lima":               "LIM",
    "cusco":              "CUZ",
    "machu picchu":       "CUZ",
    "arequipa":           "AQP",
    "iquitos":            "IQT",
    "peru":               "LIM",

    "bogota":             "BOG",
    "medellin":           "MDE,EOH",
    "cartagena":          "CTG",
    "cali":               "CLO",
    "colombia":           "BOG",

    "quito":              "UIO",
    "guayaquil":          "GYE",
    "galapagos":          "GPS",
    "ecuador":            "UIO",

    "caracas":            "CCS",
    "venezuela":          "CCS",

    "la paz":             "LPB",
    "bolivia":            "LPB",
    "sucre":              "SRE",
    "santa cruz":         "VVI",
    "salar de uyuni":     "UYU",

    "asuncion":           "ASU",
    "paraguay":           "ASU",

    "montevideo":         "MVD",
    "uruguay":            "MVD",
    "punta del este":     "MVD",

    "georgetown":         "OGL",
    "guyana":             "OGL",

    "paramaribo":         "PBM",
    "suriname":           "PBM",

    # ── Oceania ───────────────────────────────────────────────────────────────
    "sydney":             "SYD",
    "melbourne":          "MEL,AVV",
    "brisbane":           "BNE",
    "perth":              "PER",
    "adelaide":           "ADL",
    "cairns":             "CNS",
    "gold coast":         "OOL",
    "darwin":             "DRW",
    "hobart":             "HBA",
    "canberra":           "CBR",
    "alice springs":      "ASP",
    "uluru":              "AYQ",
    "ayers rock":         "AYQ",
    "great barrier reef": "CNS",
    "port douglas":       "CNS",
    "whitsundays":        "PPP",
    "tasmania":           "HBA",
    "australia":          "SYD",

    "auckland":           "AKL",
    "queenstown":         "ZQN",
    "christchurch":       "CHC",
    "wellington":         "WLG",
    "rotorua":            "ROT",
    "dunedin":            "DUD",
    "new zealand":        "AKL",

    "nadi":               "NAN",
    "fiji":               "NAN",

    "suva":               "SUV",

    "papeete":            "PPT",
    "bora bora":          "BOB",
    "french polynesia":   "PPT",
    "tahiti":             "PPT",

    "noumea":             "NOU",
    "new caledonia":      "NOU",

    "port vila":          "VLI",
    "vanuatu":            "VLI",

    "honiara":            "HIR",
    "solomon islands":    "HIR",

    "port moresby":       "POM",
    "papua new guinea":   "POM",

    "guam":               "GUM",

    # ── Central Asia / Other ──────────────────────────────────────────────────
    "dhaka":              "DAC",
    "addis ababa":        "ADD",
}

def _normalize_city(city: str) -> str:
    if not city:
        return ""
    primary = city.split(",")[0].strip()
    primary = primary.split("(")[0].strip()
    return primary.lower()

def city_to_station(city: str) -> Optional[str]:
    return CITY_TO_STATION.get(_normalize_city(city))

def city_to_iata(city: str) -> Optional[str]:
    return CITY_TO_IATA.get(_normalize_city(city))

# ── Weekday helper ─────────────────────────────────────────────────────────────

_WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

def _running_days_str_to_dict(running_days: str) -> dict:
    """
    Convert Railkit running_days string '1111110' (Mon-Sun bitmask) to dict.
    '1111111' = runs every day.  Position 0 = Monday.
    """
    keys   = _WEEKDAY_KEYS
    result = {}
    for i, key in enumerate(keys):
        result[key] = (i < len(running_days) and running_days[i] == "1")
    return result

def _runs_on_date(running_days_str: str, date_iso: str) -> bool:
    """Returns True if train runs on the weekday of date_iso."""
    try:
        dt  = datetime.strptime(date_iso, "%Y-%m-%d")
        idx = dt.weekday()   # 0=Monday
        return idx < len(running_days_str) and running_days_str[idx] == "1"
    except Exception:
        return True

# ── Railkit class list — used as default when Railkit doesn't supply them ──────

# Railkit searchTrainBetweenStations doesn't return class lists per-train.
# We map train type to likely classes as a sensible default.
# Fares are fetched on demand so this is just for display.
_TYPE_CLASSES: dict[str, list[str]] = {
    "RAJDHANI":  ["1A", "2A", "3A"],
    "SHATABDI":  ["CC", "EC"],
    "DURONTO":   ["SL", "3A", "2A", "1A"],
    "GARIB":     ["SL", "3A"],
    "SUPERFAST": ["SL", "3A", "2A"],
    "EXPRESS":   ["SL", "3A", "2A"],
    "MAIL":      ["SL", "3A", "2A"],
    "PASSENGER": ["2S", "SL"],
    "LOCAL":     ["2S"],
    "INTERCITY": ["CC", "2S"],
    "VANDE":     ["CC", "EC"],
}

def _default_classes(train_type: str) -> list[str]:
    t = (train_type or "").upper()
    for key, classes in _TYPE_CLASSES.items():
        if key in t:
            return classes
    return ["SL", "3A", "2A"]   # safe default


# ── Train search via Railkit bridge ───────────────────────────────────────────

async def _bridge_get(path: str, params: dict) -> dict:
    """GET from the local Railkit bridge."""
    url = f"{RAILKIT_BRIDGE_BASE}{path}"
    async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT) as client:
        resp = await client.get(url, params=params)
    return resp.json()


async def get_trains(origin_city: str, dest_city: str, date_iso: str) -> dict:
    """
    Returns {"trains": [...], "error": None, "stale": False}

    Train shape:
      name, number, from_station, to_station,
      departure_time, arrival_time, duration, distance,
      runs_on {mon..sun},  train_type,
      classes: [{name, price: None}]   <- price filled by get_fare() on demand
    """
    from_code = city_to_station(origin_city)
    to_code   = city_to_station(dest_city)

    if not from_code:
        return {"trains": [], "error": f"No station code for '{origin_city}'.", "stale": False}
    if not to_code:
        return {"trains": [], "error": f"No station code for '{dest_city}'.", "stale": False}

    cache_key = f"rk:trains:{from_code}:{to_code}"   # Railkit search is not date-specific
    cached    = await _cache_get(cache_key, TRAIN_TTL)
    if cached is not None:
        logger.info("cache hit  trains %s->%s", from_code, to_code)
        return {"trains": _filter_by_date(cached, date_iso)[:6], "error": None, "stale": False}

    if _is_backed_off():
        stale = await _l2_get(cache_key)
        if stale:
            return {"trains": _filter_by_date(stale, date_iso)[:6], "error": None, "stale": True}
        return {"trains": [], "error": "Train search temporarily unavailable. Check IRCTC.", "stale": False}

    # In-flight dedup
    if cache_key in _in_flight:
        logger.info("in-flight dedup trains %s->%s", from_code, to_code)
        raw = await asyncio.shield(_in_flight[cache_key])
        return {"trains": _filter_by_date(raw, date_iso)[:6], "error": None, "stale": False}

    loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    _in_flight[cache_key] = future

    try:
        logger.info("API call   trains %s->%s  (Railkit)", from_code, to_code)
        data = await _bridge_get("/trains", {"from": from_code, "to": to_code})

        if not data.get("success"):
            err = data.get("error", "Unknown error from Railkit bridge")
            logger.warning("Railkit trains failed: %s", err)
            future.set_result([])
            return {"trains": [], "error": "Train search unavailable. Check IRCTC.", "stale": False}

        raw_trains = data.get("data") or []

        # Normalise to our internal shape
        normalised = []
        for t in raw_trains:
            rd_str   = t.get("running_days", "1111111")
            rd_dict  = _running_days_str_to_dict(rd_str)
            ttype    = t.get("type") or ""
            classes  = [{"name": c, "price": None, "price_int": None}
                        for c in _default_classes(ttype)]

            normalised.append({
                "name":           t.get("train_name", ""),
                "number":         str(t.get("train_no", "")),
                "from_station":   t.get("from_stn_code", from_code),
                "to_station":     t.get("to_stn_code", to_code),
                "departure_time": t.get("from_time", ""),
                "arrival_time":   t.get("to_time", ""),
                "duration":       t.get("travel_time", ""),
                "distance":       str(t.get("distance", "")),
                "runs_on":        rd_dict,
                "running_days":   rd_str,
                "train_type":     ttype,
                "halts":          t.get("halts", 0),
                "classes":        classes,
            })

        await _cache_set(cache_key, normalised, TRAIN_TTL)
        future.set_result(normalised)
        return {"trains": _filter_by_date(normalised, date_iso)[:6], "error": None, "stale": False}

    except Exception as exc:
        logger.error("Railkit bridge error (%s): %s", type(exc).__name__, exc)
        future.set_exception(exc)
        # Try stale
        stale = await _l2_get(cache_key)
        if stale:
            return {"trains": _filter_by_date(stale, date_iso)[:6], "error": None, "stale": True}
        return {"trains": [], "error": "Unable to load trains. Please try again.", "stale": False}

    finally:
        _in_flight.pop(cache_key, None)


def _filter_by_date(trains: list, date_iso: str) -> list:
    """Keep only trains that run on the weekday of date_iso."""
    return [
        t for t in trains
        if _runs_on_date(t.get("running_days", "1111111"), date_iso)
    ]


# ── Fare (on-demand) ───────────────────────────────────────────────────────────

async def get_fare(
    train_number: str,
    from_station: str,
    to_station: str,
    travel_class: str,
    travel_date: str = "",    # DD-MM-YYYY preferred; YYYY-MM-DD accepted
) -> dict:
    """
    Returns {"fare": 1670, "price": "₹1,670", "error": None, "breakdown": {...}}
          or {"fare": None, "price": None,     "error": "...", "unavailable": False}
    """
    # Normalise date to DD-MM-YYYY (Railkit format)
    dd_mm_yyyy = _to_ddmmyyyy(travel_date)
    if not dd_mm_yyyy:
        # Use today+7 as a sensible fallback for fare lookup
        from datetime import date, timedelta
        fallback = date.today() + timedelta(days=7)
        dd_mm_yyyy = fallback.strftime("%d-%m-%Y")

    cache_key = f"rk:fare:{train_number}:{from_station}:{to_station}:{travel_class}:{dd_mm_yyyy}"
    cached = await _cache_get(cache_key, FARE_TTL)
    if cached is not None:
        logger.info("cache hit  fare %s %s", train_number, travel_class)
        return cached

    if _is_backed_off():
        return {"fare": None, "price": None, "error": "Fare lookup temporarily unavailable.", "unavailable": False}

    if cache_key in _in_flight:
        logger.info("in-flight dedup fare %s %s", train_number, travel_class)
        return await asyncio.shield(_in_flight[cache_key])

    loop: asyncio.AbstractEventLoop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    _in_flight[cache_key] = future

    try:
        logger.info("API call   fare %s %s %s->%s %s  (Railkit)",
                    train_number, travel_class, from_station, to_station, dd_mm_yyyy)

        data = await _bridge_get("/fare", {
            "train": train_number,
            "from":  from_station,
            "to":    to_station,
            "date":  dd_mm_yyyy,
            "class": travel_class,
            "quota": "GN",
        })

        if not data.get("success"):
            err = data.get("error", "Fare not available")
            logger.info("Railkit fare failed for %s %s: %s", train_number, travel_class, err)
            # Treat "No valid Station" / "not found" as unavailable (not a system error)
            unavail = any(kw in err.lower() for kw in ["station", "not found", "invalid"])
            result = {"fare": None, "price": None, "error": None if unavail else err,
                      "unavailable": unavail}
            await _cache_set(cache_key, result, 3600)
            future.set_result(result)
            return result

        d = data.get("data") or {}
        total = d.get("totalFare")
        fare_int = int(total) if total is not None else None

        result = {
            "fare":        fare_int,
            "price":       f"\u20b9{fare_int:,}" if fare_int else None,
            "error":       None,
            "unavailable": False,
            "breakdown": {
                "base":        d.get("baseFare"),
                "reservation": d.get("reservation"),
                "superfast":   d.get("superfast"),
                "catering":    d.get("catering"),
                "gst":         d.get("gst"),
                "dynamic":     d.get("dynamicFare"),
                "tatkal":      d.get("tatkalFare"),
            },
        }
        await _cache_set(cache_key, result, FARE_TTL)
        future.set_result(result)
        return result

    except Exception as exc:
        logger.error("Railkit fare error (%s): %s", type(exc).__name__, exc)
        err_result = {"fare": None, "price": None, "error": "Unable to fetch fare.", "unavailable": False}
        future.set_result(err_result)
        return err_result

    finally:
        _in_flight.pop(cache_key, None)


def _to_ddmmyyyy(date_str: str) -> str:
    """Convert YYYY-MM-DD or DD-MM-YYYY to DD-MM-YYYY. Returns '' if unparseable."""
    if not date_str:
        return ""
    if len(date_str) == 10 and date_str[4] == "-":
        # YYYY-MM-DD
        parts = date_str.split("-")
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    if len(date_str) == 10 and date_str[2] == "-":
        return date_str   # already DD-MM-YYYY
    return ""


# ── Flights (SerpAPI — unchanged) ─────────────────────────────────────────────

def _fmt_duration(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h}h {m:02d}m"


async def get_flights(origin_city: str, dest_city: str, date_iso: str) -> dict:
    dep_iata = city_to_iata(origin_city)
    arr_iata = city_to_iata(dest_city)

    if not dep_iata:
        return {"flights": [], "error": f"No airport code for '{origin_city}'."}
    if not arr_iata:
        return {"flights": [], "error": f"No airport code for '{dest_city}'."}

    cache_key = f"flights:{dep_iata}:{arr_iata}:{date_iso}"
    cached    = await _cache_get(cache_key, FLIGHT_TTL)
    if cached is not None:
        logger.info("cache hit  flights %s->%s %s", dep_iata, arr_iata, date_iso)
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
        logger.info("API call   flights %s->%s %s  (SerpAPI)", dep_iata, arr_iata, date_iso)
        async with httpx.AsyncClient(timeout=FLIGHT_TIMEOUT) as client:
            resp = await client.get(SERPAPI_BASE, params=params)
    except Exception as exc:
        logger.error("Flight fetch error (%s)", type(exc).__name__)
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
    for group in raw_groups[:6]:
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
            "price":          f"\u20b9{price_int:,}" if price_int else None,
            "price_int":      price_int,
        })

    result = {"flights": flights, "error": None}
    await _cache_set(cache_key, result, FLIGHT_TTL)
    return result
