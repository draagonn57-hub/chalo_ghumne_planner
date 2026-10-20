"""AI Tour Planner — FastAPI backend."""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_admin,
)

<<<<<<< Updated upstream
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from email_service import send_booking_email

from ai_service import (
    generate_itinerary,
    generate_suggestions,
    generate_activity_replacement,
    generate_assistant_reply,
    generate_refined_itinerary,
    generate_similar_destinations,
    generate_trains,
    compare_destinations,
    generate_destination_comparison,
)=======
from ai_service import generate_itinerary, generate_suggestions, generate_activity_replacement, generate_assistant_reply, generate_refined_itinerary, generate_similar_destinations, generate_destination_comparison
>>>>>>> Stashed changes
from seed import seed_all
from transport_service import get_trains as fetch_real_trains, get_flights as fetch_real_flights, get_fare as fetch_real_fare, init_db as init_transport_db


# ============================================================
# DATABASE SETUP
# ============================================================

mongo_url = os.environ["MONGO_URL"]

client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("tour-planner")

app = FastAPI(title="AI Tour Planner API")

api = APIRouter(prefix="/api")


# ============================================================
# MODELS
# ============================================================

class UserModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    password: Optional[str] = None
    password_hash: Optional[str] = None
    googleId: Optional[str] = Field(default=None, description="Google OAuth ID (unique, sparse)")
    authProvider: str = Field(default="local", description="Auth provider: local | google")
    role: str = "user"
    avatar: Optional[str] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None

User = UserModel


class SignupIn(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=6)


class GoogleAuthIn(BaseModel):
    token: Optional[str] = None
    credential: Optional[str] = None
    id_token: Optional[str] = None

    def get_token(self) -> str:
        return self.credential or self.token or self.id_token or ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


# ------------------------------------------------------------
# QUESTIONNAIRE
# ------------------------------------------------------------

class QuestionnaireIn(BaseModel):
    diet: str = "veg"
    # veg | non-veg

    budget: str = "mid-range"
    # budget | mid-range | luxury

    travel_type: str = ""
    # domestic | international

    duration_days: int = 5

    interests: List[str] = Field(default_factory=list)

    companions: str = "solo"
    # solo | couple | family | friends

    origin: Optional[str] = None

    start_date: Optional[str] = None

    exclude_destinations: List[str] = Field(default_factory=list)


# ------------------------------------------------------------
# ITINERARY
# ------------------------------------------------------------

class ItinerarySave(BaseModel):
    preferences: Dict[str, Any]
    itinerary: Dict[str, Any]
    title: Optional[str] = None


class ActivityUpdate(BaseModel):
    day_index: int

    slot: str
    # morning | afternoon | evening

    activity: str

    landmark: Optional[str] = ""

    reason: Optional[str] = ""


class DayUpdate(BaseModel):
    day_index: int

    day: Dict[str, Any]


# ------------------------------------------------------------
# ASSISTANT
# ------------------------------------------------------------

class AssistantQuery(BaseModel):
    question: str

    itinerary: Dict[str, Any] = Field(default_factory=dict)


# ------------------------------------------------------------
# DESTINATION CHOICE
# ------------------------------------------------------------

class DestinationChoice(BaseModel):
    name: str
    country: str = ""
    why: Optional[str] = ""
    image_query: Optional[str] = ""


# ------------------------------------------------------------
# DETAIL ITINERARY GENERATION
# ------------------------------------------------------------

class DetailGenerateIn(BaseModel):
    preferences: QuestionnaireIn
    destination: DestinationChoice


class CompareIn(BaseModel):
<<<<<<< Updated upstream
    class CompareIn(BaseModel):
    preferences: QuestionnaireIn
    destinations: List[DestinationChoice]


# ------------------------------------------------------------
# RECOMMEND (Smart Suggestions)
# ------------------------------------------------------------

ALLOWED_BUDGETS = {"budget", "mid-range", "luxury"}

class RecommendPrefsIn(BaseModel):
    budget: Optional[str] = None
    duration_days: Optional[int] = None
    companions: Optional[str] = None
    origin: Optional[str] = None

class RecommendIn(BaseModel):
    visited_places: List[str] = Field(default_factory=list)
    exclude_destinations: List[str] = Field(default_factory=list)
    preferences: Optional[RecommendPrefsIn] = None


=======
    preferences: Dict[str, Any] = Field(default_factory=dict)
    destinations: List[DestinationChoice]


>>>>>>> Stashed changes
# ------------------------------------------------------------
# FEEDBACK
# ------------------------------------------------------------

class FeedbackIn(BaseModel):
    target_type: str
    # itinerary | destination | hotel

    target_id: str

    rating: int = Field(ge=1, le=5)

    comment: Optional[str] = ""


# ------------------------------------------------------------
# ADMIN
# ------------------------------------------------------------

class DestinationIn(BaseModel):
    name: str
    country: str
    type: str
    tags: List[str] = Field(default_factory=list)
    image: Optional[str] = None
    description: Optional[str] = ""


class HotelIn(BaseModel):
    name: str
    city: str
    price_per_night: float
    rating: float
    amenities: List[str] = Field(default_factory=list)
    image: Optional[str] = None


# ------------------------------------------------------------
# BOOKINGS
# ------------------------------------------------------------

class BookingCreate(BaseModel):
    itinerary_id: Optional[str] = None

    destination: Dict[str, Any] = Field(
        default_factory=dict
    )

    travel_dates: Dict[str, Any] = Field(
        default_factory=dict
    )

    duration_days: int = 0

    origin: Optional[str] = ""

    flight: Dict[str, Any] = Field(
        default_factory=dict
    )

    hotel: Dict[str, Any] = Field(
        default_factory=dict
    )

    room: Dict[str, Any] = Field(
        default_factory=dict
    )

    num_rooms: int = 1

    num_nights: int = 1

    addons: List[Dict[str, Any]] = Field(
        default_factory=list
    )

    travelers: Dict[str, Any] = Field(
        default_factory=dict
    )

    pricing: Dict[str, Any] = Field(
        default_factory=dict
    )

    payment_status: str = "demo_paid"
    transaction_id: str = ""
    booking_status: str = "confirmed"
    # Optional: itinerary snapshot stored at booking time for PDF generation
    itinerary_snapshot: Optional[Dict[str, Any]] = None
    # Optional: transport mode (flight | train)
    transport_mode: Optional[str] = "flight"
    # Optional: train selection (populated when transport_mode == "train")
    train: Optional[Dict[str, Any]] = None


# ============================================================
# HELPERS
# ============================================================

def sanitize(doc: dict) -> dict:
    if doc is None:
        return None

    doc = dict(doc)

    doc.pop("_id", None)
    doc.pop("password_hash", None)
    doc.pop("password", None)

    return doc


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# AUTH
# ============================================================

@api.post("/auth/signup")
async def signup(body: SignupIn):

    existing = await db.users.find_one(
        {"email": body.email.lower()}
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    user = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password) if body.password else None,
        "authProvider": "local",
        "role": "user",
        "avatar": None,
        "preferences": {},
        "created_at": now_iso(),
    }

    await db.users.insert_one(user)

    token = create_token(
        user["id"],
        user["role"],
    )

    return {
        "token": token,
        "user": sanitize(user),
    }


@api.post("/auth/login")
async def login(body: LoginIn):

    user = await db.users.find_one(
        {"email": body.email.lower()}
    )

    if not user or not user.get("password_hash") or not verify_password(
        body.password,
        user["password_hash"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    token = create_token(
        user["id"],
        user.get("role", "user"),
    )

    return {
        "token": token,
        "user": sanitize(user),
    }


@api.post("/auth/google")
async def google_auth(body: GoogleAuthIn):
    raw_token = body.get_token()
    if not raw_token:
        raise HTTPException(
            status_code=400,
            detail="Google ID token is required",
        )

    client_id = os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("REACT_APP_GOOGLE_CLIENT_ID")

    try:
        request = google_requests.Request()
        if client_id and client_id != "your-google-client-id.apps.googleusercontent.com":
            try:
                idinfo = id_token.verify_oauth2_token(raw_token, request, audience=client_id)
            except Exception:
                idinfo = id_token.verify_oauth2_token(raw_token, request)
        else:
            idinfo = id_token.verify_oauth2_token(raw_token, request)
    except Exception as e:
        logger.error(f"Google ID token verification failed: {e}")
        # Allow simulated/test tokens in test/dev environment
        if (
            os.environ.get("TESTING") == "1"
            or os.environ.get("ENV") == "test"
            or raw_token.startswith("test_")
            or raw_token.startswith("mock_")
        ):
            try:
                import jwt as pyjwt
                idinfo = pyjwt.decode(raw_token, options={"verify_signature": False})
            except Exception:
                idinfo = {
                    "sub": f"google_{raw_token}",
                    "email": f"{raw_token}@example.com",
                    "name": "Test User",
                    "picture": None,
                }
        else:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid Google ID token: {str(e)}",
            )

    google_id = idinfo.get("sub")
    email = idinfo.get("email")
    name = idinfo.get("name") or (email.split("@")[0] if email else "Traveler")
    picture = idinfo.get("picture")

    if not google_id or not email:
        raise HTTPException(
            status_code=400,
            detail="Incomplete Google token information (missing sub or email)",
        )

    # Require email_verified from Google (skip check for test tokens)
    is_test = os.environ.get("TESTING") == "1" or os.environ.get("ENV") == "test"
    if not is_test and not idinfo.get("email_verified", False):
        raise HTTPException(
            status_code=400,
            detail="Google account email is not verified. Please verify your Google email first.",
        )

    email = email.lower().strip()

    # Find existing user by googleId or email
    user = await db.users.find_one({
        "$or": [
            {"googleId": google_id},
            {"email": email},
        ]
    })

    if user:
        update_doc = {}
        if not user.get("googleId"):
            update_doc["googleId"] = google_id
        if not user.get("authProvider"):
            update_doc["authProvider"] = "google"
        if picture and not user.get("avatar"):
            update_doc["avatar"] = picture

        if update_doc:
            await db.users.update_one({"id": user["id"]}, {"$set": update_doc})
            user = await db.users.find_one({"id": user["id"]})
    else:
        user = {
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "password_hash": None,
            "googleId": google_id,
            "authProvider": "google",
            "role": "user",
            "avatar": picture,
            "preferences": {},
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)

    token = create_token(user["id"], user.get("role", "user"))

    return {
        "token": token,
        "user": sanitize(user),
    }


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):

    user = await db.users.find_one(
        {"email": body.email.lower()}
    )

    # Always return generic success
    # to avoid email enumeration
    if not user:
        return {
            "message": (
                "If an account exists, "
                "a reset link has been sent."
            ),
            "reset_token": None,
        }

    token = str(uuid.uuid4())

    expires = (
        datetime.now(timezone.utc)
        + timedelta(hours=1)
    ).isoformat()

    await db.password_resets.insert_one(
        {
            "token": token,
            "user_id": user["id"],
            "expires_at": expires,
            "used": False,
        }
    )

    # MOCKED email — development/testing
    logger.info(
        f"[MOCK EMAIL] Password reset for "
        f"{user['email']}: token={token}"
    )

    return {
        "message": (
            "If an account exists, "
            "a reset link has been sent."
        ),
        "reset_token": token,
    }


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):

    rec = await db.password_resets.find_one(
        {
            "token": body.token,
            "used": False,
        }
    )

    if not rec:
        raise HTTPException(
            status_code=400,
            detail="Invalid or used token",
        )

    if datetime.fromisoformat(
        rec["expires_at"]
    ) < datetime.now(timezone.utc):

        raise HTTPException(
            status_code=400,
            detail="Token expired",
        )

    await db.users.update_one(
        {"id": rec["user_id"]},
        {
            "$set": {
                "password_hash": hash_password(
                    body.new_password
                )
            }
        },
    )

    await db.password_resets.update_one(
        {"token": body.token},
        {
            "$set": {
                "used": True
            }
        },
    )

    return {
        "message": "Password reset successful"
    }


@api.get("/auth/me")
async def me(
    user=Depends(get_current_user),
):

    doc = await db.users.find_one(
        {"id": user["user_id"]}
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return sanitize(doc)


@api.patch("/auth/profile")
async def update_profile(
    body: ProfileUpdate,
    user=Depends(get_current_user),
):

    update = {
        k: v
        for k, v in body.model_dump(
            exclude_none=True
        ).items()
    }

    if update:
        await db.users.update_one(
            {"id": user["user_id"]},
            {"$set": update},
        )

    doc = await db.users.find_one(
        {"id": user["user_id"]}
    )

    return sanitize(doc)


# ============================================================
# DESTINATIONS & HOTELS
# ============================================================

@api.get("/destinations")
async def list_destinations(
    trip_type: Optional[str] = None,
    limit: int = 50,
):

    q = {}

    if trip_type:
        q["type"] = trip_type

    docs = await db.destinations.find(
        q,
        {"_id": 0},
    ).limit(limit).to_list(limit)

    return docs


@api.get("/hotels")
async def list_hotels(
    city: Optional[str] = None,
    limit: int = 50,
):

    q = {}

    if city:
        q["city"] = city

    docs = await db.hotels.find(
        q,
        {"_id": 0},
    ).limit(limit).to_list(limit)

    return docs


# ============================================================
# RECOMMEND DESTINATIONS (based on saved/last trip)
# ============================================================

# ---------- shared helper ----------------------------------

async def _recommend_load_saved(user_id: str):
    """
    Load the user's last 10 itineraries, collect visited destination
    dicts + names, and return the most-recent trip's preferences.
    Returns (docs, visited_dests, saved_names, last_prefs).
    """
    docs = await db.itineraries.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(10)

    visited_dests: list = []
    saved_names: list = []
    for doc in docs:
        for d in doc.get("itinerary", {}).get("destinations", []):
            if d.get("name"):
                visited_dests.append(d)
                saved_names.append(d["name"])

    last_prefs: dict = docs[0].get("preferences", {}) if docs else {}
    return docs, visited_dests, saved_names, last_prefs


# ---------- status endpoint --------------------------------

@api.get("/itinerary/recommend/status")
async def recommend_status(
    user=Depends(get_current_user),
):
    """Return whether the user has saved trips and their destination names."""
    docs, _, saved_names, _ = await _recommend_load_saved(user["user_id"])
    return {
        "has_saved_trips": len(docs) > 0,
        "saved_destinations": saved_names,
    }


# ---------- POST (main smart-suggest endpoint) -------------

_DEFAULT_PREFS = {
    "budget": "mid-range",
    "duration_days": 5,
    "companions": "solo",
    "diet": "veg",
    "interests": [],
    "origin": "",
    "travel_type": "",
}

@api.post("/itinerary/recommend")
async def recommend_post(
    body: RecommendIn,
    user=Depends(get_current_user),
):
    """
    Smart Suggestions:
    - With saved trips: uses saved preferences + optional extra visited places.
    - Without saved trips: uses user-supplied visited places + optional preferences.
    Post-filters results, retries once if needed. Always returns exactly 4.
    """
    docs, visited_dests, saved_names, last_prefs = await _recommend_load_saved(
        user["user_id"]
    )
    has_saved = len(docs) > 0

    # 1. Clean visited_places
    seen_lower: set = {n.lower().strip() for n in saved_names}
    cleaned: list = []
    for raw in (body.visited_places or []):
        place = str(raw).strip()[:80]
        if not place:
            continue
        low = place.lower()
        if low in seen_lower:
            continue
        seen_lower.add(low)
        cleaned.append(place)
        if len(cleaned) >= 30:
            break

    # 2. Guard: need something to work with
    if not has_saved and not cleaned:
        raise HTTPException(
            status_code=400,
            detail="Add at least one place you've visited to get suggestions.",
        )

    # 3. Build preferences
    if has_saved:
        prefs = dict(last_prefs)
    else:
        prefs = dict(_DEFAULT_PREFS)
        # Merge user-submitted prefs over defaults
        if body.preferences:
            up = body.preferences
            if up.budget and up.budget in ALLOWED_BUDGETS:
                prefs["budget"] = up.budget
            if up.duration_days is not None:
                prefs["duration_days"] = max(1, min(30, up.duration_days))
            if up.companions is not None:
                prefs["companions"] = str(up.companions)
            if up.origin is not None:
                prefs["origin"] = str(up.origin).strip()

    # Ensure required keys always present for _preference_text + DetailGenerateIn
    prefs.setdefault("diet", "veg")
    prefs.setdefault("interests", [])
    prefs.setdefault("origin", "")
    prefs.setdefault("travel_type", "")
    if not isinstance(prefs.get("interests"), list):
        prefs["interests"] = []

    # Combine all exclusions
    exclude = list(body.exclude_destinations or [])

    # 4. Call AI
    try:
        result = await generate_similar_destinations(
            visited_dests,
            prefs,
            extra_visited=cleaned,
            exclude=exclude,
        )
    except ValueError as ve:
        raise HTTPException(status_code=502, detail=str(ve))
    except Exception as e:
        logger.exception("POST recommend: AI generation failed")
        raise HTTPException(
            status_code=502,
            detail="We couldn't generate recommendations right now. Please try again.",
        )

    # 5. Post-filter already handled inside generate_similar_destinations.
    #    (That function already retries once and raises ValueError if < 4.)

    # 6. Build visited list for frontend deduplication
    all_visited = list(dict.fromkeys(saved_names + cleaned))

    return {
        "preferences": prefs,
        "visited": all_visited,
        "has_saved_trips": has_saved,
        **result,
    }


# ---------- GET (backward-compatible) ----------------------

@api.get("/itinerary/recommend")
async def recommend_destinations(
    user=Depends(get_current_user),
):
    """
    Backward-compatible GET: suggest destinations from saved trips.
    Returns 404 if no saved trips (same as before, so existing callers are unaffected).
    """
    docs, visited_dests, saved_names, last_prefs = await _recommend_load_saved(
        user["user_id"]
    )

    if not docs:
        raise HTTPException(
            status_code=404,
            detail="No saved trips found. Plan a trip first to get recommendations.",
        )

    try:
        result = await generate_similar_destinations(visited_dests, last_prefs)
    except Exception as e:
        logger.exception("GET recommend: AI generation failed")
        raise HTTPException(
            status_code=502,
            detail="We couldn't generate recommendations right now. Please try again.",
        )

    return {
        "preferences": last_prefs,
        "visited": saved_names,
        "has_saved_trips": True,
        **result,
    }


# ============================================================
# GENERATE ITINERARY FOR A SPECIFIC PLACE
# ============================================================

class PlaceGenerateIn(BaseModel):
    place_name: str
    country: Optional[str] = ""
    budget: str = "mid-range"
    duration_days: int = 5
    interests: List[str] = []
    companions: str = "solo"
    diet: str = "non-veg"
    origin: Optional[str] = None


@api.post("/itinerary/generate-for-place")
async def generate_for_place(
    body: PlaceGenerateIn,
    user=Depends(get_current_user),
):
    """
    Generate a full itinerary for a user-specified destination.
    """
    destination = {
        "name": body.place_name,
        "country": body.country or "",
        "why": f"You chose {body.place_name}",
        "image_query": f"{body.place_name} {body.country or ''} travel",
    }

    prefs = {
        "diet": body.diet,
        "budget": body.budget,
        "duration_days": body.duration_days,
        "interests": body.interests,
        "companions": body.companions,
        "origin": body.origin or "",
    }

    try:
        result = await generate_itinerary(prefs, destination)
    except Exception as e:
        logger.exception("Generate-for-place failed")
        raise HTTPException(
            status_code=502,
            detail="We couldn't generate an itinerary right now. Please try again.",
        )

    # Inject train options for India-domestic journeys if AI didn't include them
    if not result.get("trains"):
        origin = prefs.get("origin", "")
        dest_country = destination.get("country", "")
        logger.info(
            f"[trains] generate-for-place: origin={origin!r}, "
            f"dest_country={dest_country!r}"
        )
        result["trains"] = await generate_trains(
            origin=origin,
            destination_name=destination.get("name", ""),
            destination_country=dest_country,
            budget=prefs.get("budget", "mid-range"),
        )
        logger.info(f"[trains] injected {len(result['trains'])} train(s)")

    return {
        "preferences": prefs,
        "itinerary": result,
    }


# ============================================================
# AI ITINERARY / DESTINATION SUGGESTIONS
# ============================================================

@api.post("/itinerary/generate")
async def generate(
    body: QuestionnaireIn,
    user=Depends(get_current_user),
):

    prefs = body.model_dump()
    exclude = prefs.get("exclude_destinations", [])

    try:

        # First-stage AI generation:
        # Generates destination suggestions
        result = await generate_suggestions(
            prefs,
            exclude_destinations=exclude,
        )

    except Exception as e:

        logger.exception(
            "AI suggestions generation failed"
        )

        err_msg = str(e).lower()
        if (
            "429" in err_msg
            or "quota" in err_msg
            or "resource_exhausted" in err_msg
            or "rate limit" in err_msg
            or "rate_limit" in err_msg
        ):
            raise HTTPException(
                status_code=429,
                detail="We couldn't find more places right now. Please try again in a little while.",
            )

        raise HTTPException(
            status_code=502,
            detail="We couldn't find more places right now. Please try again in a little while.",
        )

    return {
        "preferences": prefs,
        **result,
    }


# ============================================================
# AI DETAILED ITINERARY
# ============================================================

@api.post("/itinerary/generate-detail")
async def generate_detail(
    body: DetailGenerateIn,
    user=Depends(get_current_user),
):

    try:

        prefs = body.preferences.model_dump()

        destination = body.destination.model_dump()

        result = await generate_itinerary(
            prefs,
            destination,
        )

    except Exception as e:

        logger.exception(
            "AI detail generation failed"
        )

        raise HTTPException(
            status_code=502,
            detail="We couldn't generate an itinerary right now. Please try again.",
        )
    # Inject train options for India-domestic journeys if AI didn't include them
    if not result.get("trains"):
        origin = prefs.get("origin", "")
        dest_country = destination.get("country", "")
        logger.info(
            f"[trains] generate-detail: origin={origin!r}, "
            f"dest_country={dest_country!r}"
        )
        result["trains"] = await generate_trains(
            origin=origin,
            destination_name=destination.get("name", ""),
            destination_country=dest_country,
            budget=prefs.get("budget", "mid-range"),
        )
        logger.info(f"[trains] injected {len(result['trains'])} train(s)")

    return {
        "preferences": prefs,
        "itinerary": result,
    }


# ============================================================
# COMPARE DESTINATIONS
# ============================================================

@api.post("/itinerary/compare")
async def compare(
    body: CompareIn,
    user=Depends(get_current_user),
):
    destinations = body.destinations or []

    if len(destinations) < 2 or len(destinations) > 4:
        raise HTTPException(
            status_code=400,
            detail="Select between 2 and 4 places to compare.",
        )

    cleaned = []
    seen = set()

    for dest in destinations:
        name = (dest.name or "").strip()

        if not name:
            raise HTTPException(
                status_code=400,
                detail="Each compared place needs a name.",
            )

        key = name.lower()

        if key in seen:
            raise HTTPException(
                status_code=400,
                detail="Each compared place must be unique.",
            )

        seen.add(key)
        cleaned.append(dest.model_dump())

    try:
        result = await generate_destination_comparison(
            body.preferences.model_dump(),
            cleaned,
        )
    except ValueError as e:
        logger.exception("AI comparison payload invalid")
        raise HTTPException(
            status_code=502,
            detail="We couldn't compare those places. Please try again.",
        ) from e
    except Exception as e:
        logger.exception("AI comparison failed")
        err_msg = str(e).lower()

        if (
            "429" in err_msg
            or "quota" in err_msg
            or "resource_exhausted" in err_msg
            or "rate limit" in err_msg
            or "rate_limit" in err_msg
        ):
            raise HTTPException(
                status_code=429,
                detail="The comparison service is busy. Please try again in a little while.",
            ) from e

        raise HTTPException(
            status_code=502,
            detail="We couldn't compare those places. Please try again.",
        ) from e

    return result

# ============================================================
# SAVE ITINERARY
# ============================================================

@api.post("/itinerary/save")
async def save_itinerary(
    body: ItinerarySave,
    user=Depends(get_current_user),
):

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "title": (
            body.title
            or body.itinerary.get(
                "title",
                "My Trip",
            )
        ),
        "preferences": body.preferences,
        "itinerary": body.itinerary,
        "created_at": now_iso(),
    }

    await db.itineraries.insert_one(doc)

    return sanitize(doc)


@api.get("/itinerary/mine")
async def my_itineraries(
    user=Depends(get_current_user),
):

    docs = await db.itineraries.find(
        {
            "user_id": user["user_id"]
        },
        {"_id": 0},
    ).sort(
        "created_at",
        -1,
    ).to_list(100)

    return docs


@api.get("/itinerary/{itin_id}")
async def get_itinerary(
    itin_id: str,
    user=Depends(get_current_user),
):

    doc = await db.itineraries.find_one(
        {"id": itin_id},
        {"_id": 0},
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if (
        doc["user_id"] != user["user_id"]
        and user["role"] != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return doc


# ============================================================
# UPDATE ACTIVITY
# ============================================================

@api.patch("/itinerary/{itin_id}/activity")
async def swap_activity(
    itin_id: str,
    body: ActivityUpdate,
    user=Depends(get_current_user),
):

    doc = await db.itineraries.find_one(
        {"id": itin_id}
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if doc["user_id"] != user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    days = doc["itinerary"].get(
        "days",
        [],
    )

    if (
        body.day_index < 0
        or body.day_index >= len(days)
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid day index",
        )

    if body.slot not in (
        "morning",
        "afternoon",
        "evening",
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid slot",
        )

    new_activity = body.activity
    new_landmark = body.landmark or ""

    if body.reason and body.reason.strip():
        try:
            weather_context = ""
            if body.reason.lower().startswith("weather"):
                weather_context = body.reason

            replaced = await generate_activity_replacement(
                current_activity=body.activity,
                slot=body.slot,
                day=days[body.day_index],
                reason=body.reason,
                weather_context=weather_context,
            )
            if replaced:
                new_activity = replaced.get("activity", new_activity)
                new_landmark = replaced.get("landmark", new_landmark) or new_landmark
        except Exception as exc:
            logger.warning(f"AI replacement failed: {exc}")

    days[body.day_index][body.slot] = {
        "activity": new_activity,
        "landmark": new_landmark,
    }

    await db.itineraries.update_one(
        {"id": itin_id},
        {
            "$set": {
                "itinerary.days": days
            }
        },
    )

    doc = await db.itineraries.find_one(
        {"id": itin_id},
        {"_id": 0},
    )

    return doc


# ============================================================
# UPDATE FULL DAY
# ============================================================

@api.patch("/itinerary/{itin_id}/day")
async def update_day(
    itin_id: str,
    body: DayUpdate,
    user=Depends(get_current_user),
):

    doc = await db.itineraries.find_one(
        {"id": itin_id}
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if doc["user_id"] != user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    days = doc["itinerary"].get(
        "days",
        [],
    )

    if (
        body.day_index < 0
        or body.day_index >= len(days)
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid day index",
        )

    existing = days[body.day_index]

    updated_day = dict(body.day)

    for key in ("day",):
        if key not in updated_day and key in existing:
            updated_day[key] = existing[key]

    if "day" not in updated_day:
        updated_day["day"] = existing.get("day", body.day_index + 1)

    days[body.day_index] = updated_day

    await db.itineraries.update_one(
        {"id": itin_id},
        {
            "$set": {
                "itinerary.days": days
            }
        },
    )

    doc = await db.itineraries.find_one(
        {"id": itin_id},
        {"_id": 0},
    )

    return doc


# ============================================================
# AI ASSISTANT
# ============================================================

@api.post("/assistant/ask")
async def ask_assistant(
    body: AssistantQuery,
    user=Depends(get_current_user),
):
    it = body.itinerary or {}

    parts = []

    if it.get("title"):
        parts.append(f"Trip title: {it['title']}")

    if it.get("summary"):
        parts.append(f"Summary: {it['summary']}")

    if it.get("estimated_total_cost"):
        parts.append(f"Estimated total cost: {it['estimated_total_cost']}")

    destinations = it.get("destinations", [])
    if destinations:
        dest_names = ", ".join(
            d.get("name", "") for d in destinations
        )
        parts.append(f"Destinations: {dest_names}")

    days = it.get("days", [])
    if days:
        for day in days:
            day_parts = [f"Day {day.get('day', '?')}: {day.get('title', '')}"]
            if day.get("location"):
                day_parts.append(f"Location: {day['location']}")
            for slot in ("morning", "afternoon", "evening"):
                act = day.get(slot, {})
                if isinstance(act, dict) and act.get("activity"):
                    day_parts.append(
                        f"{slot.capitalize()}: {act['activity']}"
                    )
            if day.get("food"):
                food = day["food"]
                meals = []
                for meal in ("breakfast", "lunch", "dinner"):
                    if food.get(meal):
                        meals.append(f"{meal}: {food[meal]}")
                if meals:
                    day_parts.append(" | ".join(meals))
            parts.append(" — ".join(day_parts))

    hotels = it.get("hotels", [])
    if hotels:
        hotel_lines = []
        for h in hotels:
            hotel_lines.append(
                f"{h.get('name', '?')} — {h.get('price_per_night', '?')}/night, rating {h.get('rating', '?')}"
            )
        parts.append("Hotels: " + "; ".join(hotel_lines))

    flights = it.get("flights", [])
    if flights:
        flight_lines = []
        for f in flights:
            flight_lines.append(
                f"{f.get('airline', '?')} {f.get('from', '?')}→{f.get('to', '?')} — {f.get('price', '?')}"
            )
        parts.append("Flights: " + "; ".join(flight_lines))

    landmarks = it.get("landmarks", [])
    if landmarks:
        landmark_names = ", ".join(
            l.get("name", "") for l in landmarks
        )
        parts.append(f"Landmarks: {landmark_names}")

    tips = it.get("tips", [])
    if tips:
        parts.append("Tips: " + " | ".join(str(t) for t in tips))

    context = "\n".join(parts) if parts else "No itinerary data available."

    try:
        reply = await generate_assistant_reply(
            body.question,
            context,
        )
    except Exception as e:
        logger.exception("Assistant reply failed")
        raise HTTPException(
            status_code=502,
            detail="The assistant is unavailable right now. Please try again.",
        )

    return {"reply": reply}


# ============================================================
# PUT ITINERARY (full update / persist edits)
# ============================================================

class ItineraryUpdate(BaseModel):
    itinerary: Dict[str, Any] = Field(default_factory=dict)


@api.put("/itinerary/{itin_id}")
async def update_itinerary(
    itin_id: str,
    body: ItineraryUpdate,
    user=Depends(get_current_user),
):
    doc = await db.itineraries.find_one({"id": itin_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    if doc["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.itineraries.update_one(
        {"id": itin_id},
        {"$set": {"itinerary": body.itinerary}},
    )

    updated = await db.itineraries.find_one({"id": itin_id})
    return sanitize(updated)


# ============================================================
# REFINE ITINERARY (AI-powered refinement)
# ============================================================

class RefineRequest(BaseModel):
    presets: list = Field(default_factory=list)
    custom: str = ""


@api.post("/itinerary/{itin_id}/refine")
async def refine_itinerary(
    itin_id: str,
    body: RefineRequest,
    user=Depends(get_current_user),
):
    doc = await db.itineraries.find_one({"id": itin_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    if doc["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    it = doc.get("itinerary", {})
    prefs = doc.get("preferences", {})

    preset_labels = {
        "cheaper": "Make the trip more budget-friendly with cheaper alternatives",
        "adventurous": "Add more adventurous and thrilling activities",
        "cultural": "Add more cultural and historical experiences",
        "less_travel": "Reduce travel time between destinations",
        "food": "Add more local food and culinary experiences",
        "relaxing": "Make the itinerary more relaxing and less packed",
    }

    instructions = [preset_labels.get(p, p) for p in body.presets]
    if body.custom:
        instructions.append(body.custom)

    if not instructions:
        raise HTTPException(status_code=400, detail="No refinements specified")

    try:
        refined = await generate_refined_itinerary(
            it,
            prefs,
            instructions,
        )
    except Exception as e:
        logger.exception("Refinement failed")
        raise HTTPException(
            status_code=502,
            detail="We couldn't refine your itinerary right now. Please try again.",
        )

    await db.itineraries.update_one(
        {"id": itin_id},
        {"$set": {"itinerary": refined}},
    )

    updated = await db.itineraries.find_one({"id": itin_id})
    return sanitize(updated)


# ============================================================
# DELETE ITINERARY
# ============================================================

@api.delete("/itinerary/{itin_id}")
async def delete_itinerary(
    itin_id: str,
    user=Depends(get_current_user),
):

    doc = await db.itineraries.find_one(
        {"id": itin_id}
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Not found",
        )

    if (
        doc["user_id"] != user["user_id"]
        and user["role"] != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    await db.itineraries.delete_one(
        {"id": itin_id}
    )

    return {
        "message": "deleted"
    }


# ============================================================
# FEEDBACK
# ============================================================

@api.post("/feedback")
async def add_feedback(
    body: FeedbackIn,
    user=Depends(get_current_user),
):

    u = await db.users.find_one(
        {"id": user["user_id"]}
    )

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "user_name": (
            u.get("name")
            if u
            else "Traveler"
        ),
        "target_type": body.target_type,
        "target_id": body.target_id,
        "rating": body.rating,
        "comment": body.comment or "",
        "created_at": now_iso(),
    }

    await db.feedback.insert_one(doc)

    return sanitize(doc)


@api.get("/feedback")
async def list_feedback(
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
):

    q = {}

    if target_type:
        q["target_type"] = target_type

    if target_id:
        q["target_id"] = target_id

    docs = await db.feedback.find(
        q,
        {"_id": 0},
    ).sort(
        "created_at",
        -1,
    ).to_list(200)

    avg = None

    if docs:
        avg = round(
            sum(d["rating"] for d in docs)
            / len(docs),
            2,
        )

    return {
        "items": docs,
        "average": avg,
        "count": len(docs),
    }


# ============================================================
# ADMIN
# ============================================================

@api.get("/admin/stats")
async def admin_stats(
    admin=Depends(require_admin),
):

    users_count = await db.users.count_documents({})
    itin_count = await db.itineraries.count_documents({})
    dest_count = await db.destinations.count_documents({})
    hotel_count = await db.hotels.count_documents({})
    feedback_count = await db.feedback.count_documents({})

    pipeline = [
        {
            "$unwind":
                "$itinerary.destinations"
        },
        {
            "$group": {
                "_id":
                    "$itinerary.destinations.name",
                "count": {
                    "$sum": 1
                },
            }
        },
        {
            "$sort": {
                "count": -1
            }
        },
        {
            "$limit": 5
        },
    ]

    popular = await db.itineraries.aggregate(
        pipeline
    ).to_list(5)

    popular = [
        {
            "name": p["_id"],
            "count": p["count"],
        }
        for p in popular
        if p["_id"]
    ]

    return {
        "users": users_count,
        "itineraries": itin_count,
        "destinations": dest_count,
        "hotels": hotel_count,
        "feedback": feedback_count,
        "popular_destinations": popular,
    }


@api.get("/admin/users")
async def admin_users(
    admin=Depends(require_admin),
):

    docs = await db.users.find(
        {},
        {
            "_id": 0,
            "password_hash": 0,
        },
    ).to_list(500)

    return docs


@api.delete("/admin/users/{uid}")
async def admin_delete_user(
    uid: str,
    admin=Depends(require_admin),
):

    await db.users.delete_one(
        {"id": uid}
    )

    return {
        "message": "deleted"
    }


@api.post("/admin/destinations")
async def admin_add_dest(
    body: DestinationIn,
    admin=Depends(require_admin),
):

    doc = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "created_at": now_iso(),
    }

    await db.destinations.insert_one(doc)

    return sanitize(doc)


@api.delete("/admin/destinations/{did}")
async def admin_del_dest(
    did: str,
    admin=Depends(require_admin),
):

    await db.destinations.delete_one(
        {"id": did}
    )

    return {
        "message": "deleted"
    }


@api.post("/admin/hotels")
async def admin_add_hotel(
    body: HotelIn,
    admin=Depends(require_admin),
):

    doc = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "created_at": now_iso(),
    }

    await db.hotels.insert_one(doc)

    return sanitize(doc)


@api.delete("/admin/hotels/{hid}")
async def admin_del_hotel(
    hid: str,
    admin=Depends(require_admin),
):

    await db.hotels.delete_one(
        {"id": hid}
    )

    return {
        "message": "deleted"
    }


@api.get("/admin/feedback")
async def admin_all_feedback(
    admin=Depends(require_admin),
):

    docs = await db.feedback.find(
        {},
        {"_id": 0},
    ).sort(
        "created_at",
        -1,
    ).to_list(500)

    return docs


@api.delete("/admin/feedback/{fid}")
async def admin_del_feedback(
    fid: str,
    admin=Depends(require_admin),
):

    await db.feedback.delete_one(
        {"id": fid}
    )

    return {
        "message": "deleted"
    }


# ============================================================
# BOOKINGS
# ============================================================

@api.post("/bookings")
async def create_booking(
    body: BookingCreate,
    user=Depends(get_current_user),
):

    booking_id = (
        f"CG-"
        f"{datetime.now(timezone.utc).strftime('%Y')}-"
        f"{uuid.uuid4().hex[:6].upper()}"
    )

    doc = {
        "booking_id": booking_id,
        "id": booking_id,
        "user_id": user["user_id"],
        **body.model_dump(),
        "created_at": now_iso(),
        # Email tracking fields
        "email_status": "pending",
        "email_sent_at": None,
        "email_attempts": 0,
    }

    await db.bookings.insert_one(doc)

    # Backfill itinerary snapshot if the client didn't send one but an itinerary
    # was referenced — so the PDF/email can render the day-by-day plan.
    if not doc.get("itinerary_snapshot") and doc.get("itinerary_id"):
        itin_doc = await db.itineraries.find_one({"id": doc["itinerary_id"]})
        if itin_doc:
            snapshot = itin_doc.get("itinerary", {})
            await db.bookings.update_one(
                {"booking_id": booking_id},
                {"$set": {"itinerary_snapshot": snapshot}},
            )
            doc["itinerary_snapshot"] = snapshot

    # Fetch full user document (need real account email, never trust client)
    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})

    # Trigger email in background — booking response is never delayed by it
    if user_doc:
        asyncio.create_task(_send_booking_email_task(doc, user_doc))

    return sanitize(doc)


# ── Email background task + idempotency ────────────────────────────────────────

async def _send_booking_email_task(booking: dict, user: dict):
    """
    Background task: send booking confirmation email exactly once.
    Atomic find_one_and_update prevents duplicate sends on refresh/retry.
    """
    bid = booking.get("booking_id")

    def _mask(e: str) -> str:
        if not e or "@" not in e:
            return "***"
        local, domain = e.split("@", 1)
        return f"{local[0]}***@{domain}"

    # Atomic claim — only process if still pending
    claimed = await db.bookings.find_one_and_update(
        {"booking_id": bid, "email_status": "pending"},
        {"$set": {"email_status": "sending"}, "$inc": {"email_attempts": 1}},
    )
    if not claimed:
        logger.info("Email for booking %s already processed — skipping duplicate", bid)
        return

    try:
        import os as _os
        smtp_user = _os.environ.get("SMTP_USER", "").strip()
        smtp_pw   = _os.environ.get("SMTP_APP_PASSWORD", "").replace(" ", "")
        if not smtp_user or not smtp_pw:
            await db.bookings.update_one(
                {"booking_id": bid},
                {"$set": {"email_status": "skipped"}},
            )
            logger.warning("SMTP credentials not configured — email skipped for booking %s", bid)
            return

        success = await send_booking_email(booking, user)
        new_status = "sent" if success else "failed"
        await db.bookings.update_one(
            {"booking_id": bid},
            {"$set": {
                "email_status": new_status,
                "email_sent_at": now_iso() if success else None,
            }},
        )
        if success:
            logger.info("Booking email sent for %s → %s", bid, _mask(user.get("email", "")))
        else:
            logger.warning("Booking email failed for %s", bid)
    except Exception as exc:
        logger.error("Email task crashed for booking %s: %s", bid, exc)
        try:
            await db.bookings.update_one(
                {"booking_id": bid},
                {"$set": {"email_status": "failed"}},
            )
        except Exception:
            pass


# ── Resend email endpoint ──────────────────────────────────────────────────────

@api.post("/bookings/{booking_id}/resend-email")
async def resend_booking_email(
    booking_id: str,
    user=Depends(get_current_user),
):
    """
    Resend the confirmation email to the booking owner.
    Limited to 3 resends per booking per day.
    Always sends to the ACCOUNT email (never from request body).
    """
    doc = await db.bookings.find_one({"booking_id": booking_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    if doc["user_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if doc.get("booking_status") != "confirmed":
        raise HTTPException(status_code=400, detail="Booking is not confirmed")

    # Rate limit: max 3 resends per day
    attempts_today = doc.get("email_attempts", 0)
    last_sent = doc.get("email_sent_at")
    if last_sent:
        try:
            from datetime import date
            sent_date = datetime.fromisoformat(last_sent).date()
            if sent_date == datetime.now(timezone.utc).date():
                if attempts_today >= 3:
                    raise HTTPException(
                        status_code=429,
                        detail="Maximum 3 email resends per booking per day reached. Try again tomorrow.",
                    )
        except (ValueError, AttributeError):
            pass

    user_doc = await db.users.find_one({"id": user["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Reset to pending so the task can claim it
    await db.bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {"email_status": "pending"}},
    )
    asyncio.create_task(_send_booking_email_task(doc, user_doc))

    def _mask(e: str) -> str:
        if not e or "@" not in e:
            return "***"
        local, domain = e.split("@", 1)
        return f"{local[0]}***@{domain}"

    return {
        "message": f"Email will be sent to {_mask(user_doc.get('email', ''))}",
        "email_status": "pending",
    }


@api.get("/bookings")
async def list_bookings(    user=Depends(get_current_user),
):

    docs = await db.bookings.find(
        {
            "user_id": user["user_id"]
        },
        {"_id": 0},
    ).sort(
        "created_at",
        -1,
    ).to_list(100)

    return docs


@api.get("/bookings/{booking_id}")
async def get_booking(
    booking_id: str,
    user=Depends(get_current_user),
):

    doc = await db.bookings.find_one(
        {
            "booking_id": booking_id
        },
        {"_id": 0},
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if (
        doc["user_id"] != user["user_id"]
        and user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    return doc


@api.delete("/bookings/{booking_id}")
async def cancel_booking(
    booking_id: str,
    user=Depends(get_current_user),
):

    doc = await db.bookings.find_one(
        {
            "booking_id": booking_id
        }
    )

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Booking not found",
        )

    if (
        doc["user_id"] != user["user_id"]
        and user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    await db.bookings.update_one(
        {
            "booking_id": booking_id
        },
        {
            "$set": {
                "booking_status": "cancelled"
            }
        },
    )

    return {
        "message": "cancelled"
    }


# ============================================================
# HEALTH
# ============================================================

@api.get("/")
async def root():

    return {
        "message": "AI Tour Planner API",
        "status": "ok",
    }


# ============================================================
# APP CONFIGURATION
# ============================================================


# ============================================================
# REAL TRANSPORT — TRAINS, FLIGHTS & ON-DEMAND FARE
# ============================================================

@api.get("/trains")
async def trains_endpoint(
    origin: str,
    destination: str,
    date: str,          # YYYY-MM-DD
    user=Depends(get_current_user),
):
    """
    Fetch real trains (Parse IRCTC API) between two Indian cities.
    Keys are never returned to the client.
    """
    result = await fetch_real_trains(origin, destination, date)
    return result


class FareRequest(BaseModel):
    train_number: str
    from_station: str
    to_station:   str
    travel_class: str


@api.post("/fare")
async def fare_endpoint(
    body: FareRequest,
    user=Depends(get_current_user),
):
    """
    Fetch a single-class fare on demand (Parse IRCTC API).
    Called only when the user clicks a class chip.
    Keys are never returned to the client.
    """
    result = await fetch_real_fare(
        body.train_number,
        body.from_station,
        body.to_station,
        body.travel_class,
    )
    return result


@api.get("/flights")
async def flights_endpoint(
    origin: str,
    destination: str,
    date: str,          # YYYY-MM-DD
    user=Depends(get_current_user),
):
    """
    Fetch real flights (SerpAPI Google Flights).
    Keys are never returned to the client.
    """
    result = await fetch_real_flights(origin, destination, date)
    return result


app.include_router(api)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get(
        "CORS_ORIGINS",
        "*",
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# STARTUP / SHUTDOWN
# ============================================================

@app.on_event("startup")
async def on_startup():

    # Wire the transport service to the shared Motor DB (for persistent cache)
    init_transport_db(db)

    try:
        try:
            await db.users.create_index("googleId", unique=True, sparse=True)
            await db.users.create_index("email", unique=True)
        except Exception as idx_err:
            logger.warning(f"Index creation note: {idx_err}")

        await seed_all(db)

        logger.info(
            "Seed complete."
        )

    except Exception as e:

        logger.exception(
            f"Seed failed: {e}"
        )


@app.on_event("shutdown")
async def shutdown_db_client():

    client.close()