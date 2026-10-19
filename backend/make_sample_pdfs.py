"""
make_sample_pdfs.py
Generates sample itinerary and booking confirmation PDFs for a 5-day family trip to Pondicherry.
Output files are saved in backend/sample_pdfs/.
"""

import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from pdf_service import build_confirmation_pdf, build_itinerary_pdf
from image_service import CACHE_DIR

OUTPUT_DIR = BASE_DIR / "sample_pdfs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


PONDICHERRY_ITINERARY = {
    "title": "Pondicherry French Riviera & Coastal Charm",
    "summary": "A relaxing 5-day family escape blending French colonial architecture, spiritual peace at Auroville, golden beaches, and delectable Franco-Tamil cuisine.",
    "destination": {
        "name": "Pondicherry",
        "country": "India",
        "image_query": "Pondicherry French Quarter",
    },
    "duration_days": 5,
    "tier": "Premium Family",
    "origin": "New Delhi (DEL)",
    "dates": {
        "start_date": "2025-11-12",
        "end_date": "2025-11-16",
    },
    "estimated_total_cost": "₹68,450",
    "travelers": {
        "fullName": "Rahul Sharma",
        "email": "rahul.sharma@example.com",
        "phone": "+91 98765 43210",
        "numTravelers": 3,
        "adults": 2,
        "children": 1,
    },
    "schedule": [
        {
            "day": 1,
            "title": "Arrival & French Quarter Stroll",
            "location": "White Town",
            "morning": {
                "activity": "Check-in at heritage hotel and refreshing welcome drinks",
                "landmark": "Palais de Mahe",
            },
            "afternoon": {
                "activity": "Leisurely walking tour through pastel-colored French colonial villas and bougainvillea streets",
                "landmark": "Romain Rolland Street",
            },
            "evening": {
                "activity": "Sunset stroll along the seaside promenade, tasting fresh crepes and street gelato",
                "landmark": "Promenade Beach Pondicherry",
            },
            "food": {
                "breakfast": "Hotel buffet with fresh croissants & filter coffee",
                "lunch": "Cafe des Arts — French baguettes & iced teas",
                "dinner": "Le Dupleix — Franco-Tamil seafood fusion",
                "image_query": "Pondicherry cafe food",
            },
            "notes": "Pleasant coastal breeze; light cotton clothes recommended.",
        },
        {
            "day": 2,
            "title": "Spiritual Auroville & Serenity Beach",
            "location": "Auroville",
            "morning": {
                "activity": "Guided tour of the experimental township and outer viewing of the golden sphere",
                "landmark": "Matrimandir Auroville",
            },
            "afternoon": {
                "activity": "Explore Auroville Visitors Centre, botanical gardens, and handcrafted pottery studios",
                "landmark": "Auroville Visitors Centre",
            },
            "evening": {
                "activity": "Relaxing beach evening with sunset views and peaceful waters",
                "landmark": "Serenity Beach Pondicherry",
            },
            "food": {
                "breakfast": "Artisan sourdough toasts & fresh juice at Auroville Bakery",
                "lunch": "Solar Kitchen / Well Cafe — organic Mediterranean bowls",
                "dinner": "Tanto Pizzeria — wood-fired Italian pizzas",
                "image_query": "Matrimandir Auroville",
            },
            "notes": "Book Matrimandir viewing tokens in advance for early morning slots.",
        },
        {
            "day": 3,
            "title": "Paradise Beach & Watersports Island",
            "location": "Chunnambar",
            "morning": {
                "activity": "Scenic ferry boat cruise through backwaters to reach the golden sandspit beach",
                "landmark": "Chunnambar Boat House",
            },
            "afternoon": {
                "activity": "Family beach activities, banana boat rides, and swimming in clean shallow waters",
                "landmark": "Paradise Beach Pondicherry",
            },
            "evening": {
                "activity": "Visit the sacred 500-year-old temple known for its golden chariot and temple elephant",
                "landmark": "Manakula Vinayagar Temple",
            },
            "food": {
                "breakfast": "South Indian tiffin at hotel",
                "lunch": "Coconut water & coastal snacks at Paradise Beach huts",
                "dinner": "Coromandel Cafe — artisanal modern European in a restored villa",
                "image_query": "Paradise Beach Pondicherry",
            },
            "notes": "Carry sunscreen, hats, and a change of clothes for beach time.",
        },
        {
            "day": 4,
            "title": "Ancient Heritage & Mangrove Kayaking",
            "location": "Arikamedu & Pichavaram",
            "morning": {
                "activity": "Visit the archaeological excavations of the 1st-century Indo-Roman trade post",
                "landmark": "Arikamedu Ruins",
            },
            "afternoon": {
                "activity": "Walk through the lush botanical gardens with over 1500 species of exotic flora",
                "landmark": "Pondicherry Botanical Gardens",
            },
            "evening": {
                "activity": "Shopping for handmade paper, aromatherapy oils, and Auroville textiles in Mission Street",
                "landmark": "Mission Street Markets",
            },
            "food": {
                "breakfast": "Baker’s Street — pain au chocolat & quiches",
                "lunch": "Appachi Chettinad — traditional banana leaf thali",
                "dinner": "Villa Shanti — courtyard dining with candlelit ambiance",
                "image_query": "White Town French Quarter Pondicherry",
            },
            "notes": "Great souvenir shopping day for Auroville incense and handmade paper.",
        },
        {
            "day": 5,
            "title": "Sunrise on Goubert Avenue & Departure",
            "location": "Pondicherry Bay",
            "morning": {
                "activity": "Early morning sunrise walk and photography by the French war memorial and Gandhi statue",
                "landmark": "Goubert Avenue",
            },
            "afternoon": {
                "activity": "Souvenir packing and check-out from hotel",
                "landmark": "Palais de Mahe",
            },
            "evening": {
                "activity": "Private transfer to Chennai International Airport for departure flight",
                "landmark": "Chennai Airport Departure",
            },
            "food": {
                "breakfast": "Relaxed seaside terrace breakfast",
                "lunch": "Surcouf Restaurant — French crepes & salad",
                "dinner": "Airport lounge dinner",
                "image_query": "Pondicherry beach sunrise",
            },
            "notes": "Allow 3 hours travel time from Pondicherry to Chennai Airport along ECR.",
        },
    ],
    "hotels": [
        {
            "name": "Palais de Mahe - CGH Earth",
            "location": "White Town, Pondicherry",
            "rating": 4.8,
            "price_per_night": "₹11,500",
            "amenities": ["Swimming Pool", "Heritage Courtyard", "Free High-Speed Wi-Fi", "Multi-cuisine Restaurant", "Ayurvedic Spa"],
            "image_query": "Palais de Mahe Pondicherry",
        },
    ],
    "flights": [
        {
            "airline": "IndiGo 6E-2041",
            "from": "DEL (New Delhi)",
            "to": "MAA (Chennai)",
            "duration": "2h 45m",
            "stops": "Non-stop",
            "price": "₹16,800 (Total for 3)",
        },
    ],
    "trains": [],
    "transport": [
        {
            "mode": "Private AC Innova",
            "from": "Chennai Airport (MAA)",
            "to": "Pondicherry Hotel",
            "duration": "2h 45m scenic East Coast Road drive",
            "price": "₹3,500 round trip",
            "provider": "Chalo Ghumne Verified Fleets",
        },
    ],
    "budget_breakdown": {
        "transport": "₹20,300",
        "stay": "₹46,000",
        "activities": "₹8,500",
        "food": "₹14,000",
        "discount": "− ₹760",
        "total": "₹68,450",
    },
    "tips": [
        "White Town is closed to motorized vehicles from 6 PM to 7:30 AM — ideal for quiet family evening walks.",
        "Dress modestly when visiting Auroville Matrimandir and Manakula Vinayagar Temple.",
        "Rent bicycles or electric scooters from White Town kiosks to explore the French and Tamil quarters at your own pace.",
        "Carry cash for small beach shacks and coconut vendors at Paradise Beach.",
    ],
}

PONDICHERRY_BOOKING = {
    "booking_id": "CG-2025-PDY8821",
    "transaction_id": "TXN_9948271034",
    "user_id": "usr_test_rahul",
    "user_name": "Rahul Sharma",
    "user_email": "rahul.sharma@example.com",
    "user_phone": "+91 98765 43210",
    "destination": {
        "name": "Pondicherry",
        "country": "India",
    },
    "duration_days": 5,
    "origin": "New Delhi (DEL)",
    "travel_dates": {
        "start_date": "2025-11-12",
        "end_date": "2025-11-16",
    },
    "transport_mode": "flight",
    "flight": {
        "airline": "IndiGo 6E-2041",
        "from": "DEL",
        "to": "MAA",
        "duration": "2h 45m",
        "stops": "Non-stop",
        "price": "₹16,800",
    },
    "hotel": {
        "name": "Palais de Mahe - CGH Earth",
        "location": "White Town, Pondicherry",
        "rating": 4.8,
        "price_per_night": "₹11,500",
    },
    "room": {
        "label": "Heritage Deluxe Suite with Pool View",
    },
    "num_rooms": 1,
    "num_nights": 4,
    "travelers": {
        "fullName": "Rahul Sharma",
        "email": "rahul.sharma@example.com",
        "phone": "+91 98765 43210",
        "numTravelers": 3,
        "adults": 2,
        "children": 1,
    },
    "addons": [
        {"name": "Private Airport Transfer (Chennai ECR Return)", "price": 3500},
        {"name": "Auroville Guided Experience Pass", "price": 1200},
        {"name": "Paradise Beach Speedboat Voucher", "price": 1800},
    ],
    "pricing": {
        "subtotal": 62500,
        "taxes": 3710,
        "discount": 760,
        "grandTotal": 65450,
        "currency": "INR",
    },
    "booking_status": "confirmed",
    "payment_status": "successful",
    "created_at": "2025-10-15T10:30:00Z",
    "itinerary": PONDICHERRY_ITINERARY,
}


def main():
    print("Generating sample PDFs for Pondicherry...")

    # Load any cached images if available
    images = []
    if CACHE_DIR.exists():
        for fp in sorted(CACHE_DIR.glob("*.jpg"))[:8]:
            try:
                images.append(fp.read_bytes())
            except Exception:
                pass

    if images:
        print(f"Loaded {len(images)} cached watermark photos.")
    else:
        print("No cached watermark photos found; building with high quality fallback background.")

    # 1. Itinerary PDF
    itin_bytes = build_itinerary_pdf(PONDICHERRY_BOOKING, images=images or None)
    itin_path = OUTPUT_DIR / "ChaloGhumne-Itinerary-Pondicherry.pdf"
    itin_path.write_bytes(itin_bytes)
    print(f"[OK] Saved Itinerary PDF: {itin_path} ({len(itin_bytes):,} bytes)")

    # 2. Confirmation PDF
    user_info = {
        "name": "Rahul Sharma",
        "email": "rahul.sharma@example.com",
        "phone": "+91 98765 43210",
    }
    conf_bytes = build_confirmation_pdf(PONDICHERRY_BOOKING, user_info, images=images or None)
    conf_path = OUTPUT_DIR / "ChaloGhumne-Confirmation-Pondicherry.pdf"
    conf_path.write_bytes(conf_bytes)
    print(f"[OK] Saved Confirmation PDF: {conf_path} ({len(conf_bytes):,} bytes)")

    print("\nAll sample PDFs generated successfully in backend/sample_pdfs/")


if __name__ == "__main__":
    main()
