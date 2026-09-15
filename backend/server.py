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

from ai_service import generate_itinerary, generate_suggestions, generate_activity_replacement
from seed import seed_all


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

class SignupIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


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
    diet: str
    # veg | non-veg

    budget: str
    # budget | mid-range | luxury

    duration_days: int

    interests: List[str]

    companions: str
    # solo | couple | family | friends

    origin: Optional[str] = None

    start_date: Optional[str] = None


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


# ============================================================
# HELPERS
# ============================================================

def sanitize(doc: dict) -> dict:
    if doc is None:
        return None

    doc = dict(doc)

    doc.pop("_id", None)
    doc.pop("password_hash", None)

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
        "password_hash": hash_password(body.password),
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

    if not user or not verify_password(
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
# AI ITINERARY / DESTINATION SUGGESTIONS
# ============================================================

@api.post("/itinerary/generate")
async def generate(
    body: QuestionnaireIn,
    user=Depends(get_current_user),
):

    prefs = body.model_dump()

    try:

        # First-stage AI generation:
        # Generates destination suggestions
        result = await generate_suggestions(
            prefs
        )

    except Exception as e:

        logger.exception(
            "AI suggestions generation failed"
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "AI generation failed: "
                f"{str(e)[:200]}"
            ),
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
            detail=(
                "AI generation failed: "
                f"{str(e)[:200]}"
            ),
        )

    return {
        "preferences": prefs,
        "itinerary": result,
    }


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
    }

    await db.bookings.insert_one(doc)

    return sanitize(doc)


@api.get("/bookings")
async def list_bookings(
    user=Depends(get_current_user),
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

    try:

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