"""Idempotent seed for destinations, hotels, and admin user."""
import os
import uuid
from datetime import datetime, timezone
from auth import hash_password

ADMIN_EMAIL = "admin@tourplanner.com"
ADMIN_PASSWORD = "Admin@12345"

SEED_DESTINATIONS = [
    {"name": "Goa", "country": "India", "type": "national", "tags": ["beach", "nightlife", "relaxation"],
     "image": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=940&q=80",
     "description": "Sun-kissed beaches, Portuguese heritage, and vibrant nightlife on India's western coast."},
    {"name": "Manali", "country": "India", "type": "national", "tags": ["nature", "adventure", "mountains"],
     "image": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=940&q=80",
     "description": "Snow-capped Himalayas, apple orchards, and paragliding in Himachal Pradesh."},
    {"name": "Jaipur", "country": "India", "type": "national", "tags": ["culture", "history", "food"],
     "image": "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=940&q=80",
     "description": "The Pink City — royal palaces, bustling bazaars, and Rajasthani cuisine."},
    {"name": "Kyoto", "country": "Japan", "type": "international", "tags": ["culture", "food", "nature"],
     "image": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=940&q=80",
     "description": "Ancient temples, cherry blossoms, and centuries-old tea houses."},
    {"name": "Santorini", "country": "Greece", "type": "international", "tags": ["relaxation", "food", "beach"],
     "image": "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=940&q=80",
     "description": "Whitewashed cliff-top villages and unforgettable Aegean sunsets."},
    {"name": "Reykjavik", "country": "Iceland", "type": "international", "tags": ["adventure", "nature"],
     "image": "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=940&q=80",
     "description": "Northern lights, glaciers, geothermal spas, and dramatic landscapes."},
]

SEED_HOTELS = [
    {"name": "The Leela Goa", "city": "Goa", "price_per_night": 220, "rating": 4.7,
     "amenities": ["WiFi", "Pool", "Spa", "Beach access"],
     "image": "https://images.pexels.com/photos/35868592/pexels-photo-35868592.jpeg?auto=compress&cs=tinysrgb&w=940"},
    {"name": "Snow Valley Resort", "city": "Manali", "price_per_night": 95, "rating": 4.3,
     "amenities": ["WiFi", "Mountain view", "Restaurant"],
     "image": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=940&q=80"},
    {"name": "Rambagh Palace", "city": "Jaipur", "price_per_night": 480, "rating": 4.9,
     "amenities": ["Heritage", "Spa", "Pool", "Fine dining"],
     "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=940&q=80"},
    {"name": "Ryokan Yoshida-sanso", "city": "Kyoto", "price_per_night": 310, "rating": 4.8,
     "amenities": ["Traditional", "Onsen", "Kaiseki dining"],
     "image": "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=940&q=80"},
    {"name": "Katikies Hotel", "city": "Santorini", "price_per_night": 540, "rating": 4.9,
     "amenities": ["Infinity pool", "Caldera view", "Spa"],
     "image": "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=940&q=80"},
]


async def seed_all(db):
    # Admin user
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "avatar": None,
            "preferences": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Destinations
    if await db.destinations.count_documents({}) == 0:
        docs = []
        for d in SEED_DESTINATIONS:
            docs.append({"id": str(uuid.uuid4()), **d,
                         "created_at": datetime.now(timezone.utc).isoformat()})
        await db.destinations.insert_many(docs)

    # Hotels
    if await db.hotels.count_documents({}) == 0:
        docs = []
        for h in SEED_HOTELS:
            docs.append({"id": str(uuid.uuid4()), **h,
                         "created_at": datetime.now(timezone.utc).isoformat()})
        await db.hotels.insert_many(docs)

