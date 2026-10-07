"""
Gemini-powered destination suggestions and detailed itinerary generation.
"""

import json
import os
import re
import time
from typing import Any, Dict, Optional

from google import genai


# ============================================================
# GEMINI CONFIGURATION
# ============================================================

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY not found. Please add it to your .env file."
    )

client = genai.Client(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-2.5-flash"


# ============================================================
# DESTINATION SUGGESTION PROMPT
# ============================================================

SUGGESTION_PROMPT = """
You are an expert travel curator for an AI Tour Planner.

Based on the user's travel preferences, recommend exactly FOUR
distinct destinations.

Return ONLY valid JSON.
Do NOT return markdown.
Do NOT return explanations outside the JSON.

Required schema:

{
    "suggestions": [
        {
            "name": "string",
            "country": "string",
            "why": "one concise sentence explaining why this destination fits",
            "image_query": "specific real travel photo search phrase"
        }
    ]
}

Rules:

- Return exactly 4 destinations.
- All 4 destinations must be distinct.
- Do not repeat a city.
- Prefer destinations that genuinely match the user's preferences.
- Decide automatically whether each suggestion should be domestic or international.
- Do NOT assume the user wants an Indian destination.
- Use the user's budget, duration, origin, interests, companions, diet, and transport to decide what is realistic.
- International destinations are allowed and should be suggested when they are a good fit for the user's preferences and realistic for the stated budget and duration.
- Domestic destinations are also allowed when they are a better fit.
- Do not ask the user whether they want domestic or international travel.
- Keep all four destinations distinct, varied, and genuinely relevant to the user.

IMAGE QUERY RULES:

- image_query must describe a real, recognizable travel location.
- Each image_query must be different.
- Include the destination name.
- Include country/region when useful.
- Include a recognizable visual feature when appropriate.
- Do not use generic queries such as:
  "travel"
  "beautiful destination"
  "tourism"
  "vacation"
  "India"
- The image_query must be useful for an image search API.

Return ONLY valid JSON.
"""


# ============================================================
# DETAILED ITINERARY PROMPT
# ============================================================

DETAIL_PROMPT = """
You are an expert AI travel planner.

Create a detailed, realistic, geographically coherent, personalized
itinerary for the SELECTED destination using the user's travel
preferences.

The itinerary will be displayed to the user exactly as generated.

Accuracy, internal consistency, realistic geography, realistic
pricing, and useful image search queries are extremely important.

Return ONLY valid JSON.
Do NOT return markdown.
Do NOT return explanations outside the JSON.


============================================================
REQUIRED JSON SCHEMA
============================================================

{
    "title": "string",
    "summary": "string",

    "destinations": [
        {
            "name": "string",
            "country": "string",
            "why": "string",
            "image_query": "specific searchable photo query"
        }
    ],

    "estimated_total_cost": "string",

    "hotels": [
        {
            "name": "string",
            "location": "string",
            "price_per_night": "string",
            "rating": 4.5,
            "amenities": ["string"],
            "image_query": "specific hotel or accommodation photo query"
        }
    ],

    "flights": [
        {
            "airline": "string",
            "from": "string",
            "to": "string",
            "price": "string",
            "duration": "string",
            "stops": "string",
            "estimated": true
        }
    ],

    "days": [
        {
            "day": 1,
            "title": "string",
            "location": "string",

            "morning": {
                "activity": "string",
                "landmark": "string"
            },

            "afternoon": {
                "activity": "string",
                "landmark": "string"
            },

            "evening": {
                "activity": "string",
                "landmark": "string"
            },

            "food": {
                "breakfast": "string",
                "lunch": "string",
                "dinner": "string",
                "image_query": "specific local food photo query"
            }
        }
    ],

    "landmarks": [
        {
            "name": "string",
            "description": "string",
            "location": "string",
            "image_query": "specific landmark photo query"
        }
    ],

    "tips": [
        "string"
    ]
}


============================================================
CORE ITINERARY RULES
============================================================

- The number of days MUST exactly equal duration_days.
- Use the selected destination as the primary destination.
- NEVER replace the selected destination with another destination.
- Respect the user's budget.
- Respect the user's dietary preference.
- Respect the user's transport preference.
- Respect the user's interests.
- Respect the user's companions.
- Consider the user's origin.
- The AI decides whether the trip is domestic or international based on the user's preferences.
- Do NOT assume the trip must be within India.
- International travel is allowed when it is realistic for the user's budget, duration, and origin.
- Domestic travel is allowed when it is a better fit.
- Prices must be reasonable estimates.
- Hotels must match the requested budget tier.
- Provide SIX varied hotel options when possible.
- Hotel options must be relevant to the selected destination.
- Provide 2-4 estimated flight options when flights are relevant.
- If the user prefers train, bus, or car, reflect that preference
  instead of forcing flights.


============================================================
DAILY ITINERARY — GEOGRAPHIC ACCURACY
============================================================

Every day MUST contain:

- morning activity
- afternoon activity
- evening activity
- location

Activities within the same day must be geographically sensible.

Do NOT place activities from distant parts of the destination
together on the same day unless realistic transportation between
them is explicitly considered.

When possible, group activities that are close to each other
into the same day.

GOOD:

Day 1:
- Morning: attraction A
- Afternoon: attraction B nearby
- Evening: market/restaurant/riverfront nearby

BAD:

Day 1:
- Morning: attraction on one side of the city
- Afternoon: attraction several hours away
- Evening: attraction in another distant city

The itinerary should feel like a REAL person could physically
follow it without unnecessary backtracking.

If the destination has multiple areas or neighborhoods,
organize days around those areas.

The "location" field should identify the actual area/city where
the majority of that day's activities occur.

Each activity's "landmark" must correspond to the actual place
mentioned in the activity.

Do NOT mention a landmark in the landmark field that is unrelated
to the activity.


============================================================
ACTIVITY QUALITY
============================================================

- Every day should feel different.
- Avoid repeatedly suggesting the same activity.
- Avoid filler activities such as "relax at hotel" unless genuinely
  appropriate.
- Include a realistic mixture of sightseeing, food, culture,
  nature, shopping, experiences, and relaxation according to
  the user's interests.
- Consider opening/closing practicality when selecting activities.
- Do not schedule activities that are obviously impossible at
  the same time.
- Allow reasonable travel time between locations.
- Do not overload a single day with too many major attractions.


============================================================
HOTEL RULES
============================================================

Hotels must be real or plausibly identifiable accommodations
in or near the selected destination.

Prefer recognizable accommodation names when possible.

For each hotel:

- name = actual hotel/hostel/resort name
- location = actual area/city
- price_per_night = reasonable estimate
- rating = plausible rating
- amenities = realistic amenities


IMPORTANT HOTEL IMAGE RULE:

The image_query is used directly with an image search API.

Therefore:

1. First try to describe the EXACT PROPERTY.
2. Include the property name and location.
3. Add the type of accommodation.
4. If the exact property's images are unlikely to be available,
   search for a visually representative accommodation instead.

GOOD:

"Zostel Rishikesh Tapovan hostel hotel room"

"Zostel Rishikesh Tapovan hostel exterior"

"hotel room Tapovan Rishikesh India"

BAD:

"Rishikesh"

"beautiful Rishikesh"

"travel hotel"

"India travel"

For hotel images, NEVER intentionally search for a generic
tourist attraction, mountain, river, beach, temple, or landscape.

If an exact hotel photo cannot be found, it is acceptable for the
image search to return a different hotel/hostel room with a
similar style.

The image must at least visually represent the type of
accommodation being described.


============================================================
DESTINATION IMAGE RULES
============================================================

For each destination, create a specific image query.

Include:

- destination name
- country/region
- recognizable visual feature when useful

GOOD:

"Rishikesh India Ganges river mountains"

"Jaipur Rajasthan India Hawa Mahal"

BAD:

"India travel"

"beautiful destination"


============================================================
LANDMARK IMAGE RULES
============================================================

For every landmark:

- Use the exact landmark name.
- Include the city/region.
- Include the country when useful.
- The query must specifically search for that landmark.

GOOD:

"Neer Garh Waterfall Rishikesh India"

"Triveni Ghat Rishikesh India"

"Ram Jhula Rishikesh India"

BAD:

"Rishikesh tourist place"

"India landmark"


============================================================
FOOD IMAGE RULES
============================================================

Food image queries must search for FOOD.

Include:

- dish/cuisine name
- destination/location

GOOD:

"Rishikesh India North Indian thali"

"Rishikesh local vegetarian food"

"Gujarati thali India"

BAD:

"Rishikesh"

"Indian travel"

"restaurant"


============================================================
IMAGE QUERY GENERAL RULE
============================================================

Every image_query must be:

- specific
- searchable
- visually descriptive
- directly related to the object it belongs to
- different from unrelated image queries

NEVER use generic queries such as:

"travel"
"beautiful place"
"tourism"
"vacation"
"India"
"Rishikesh"
"hotel"
"food"
"landmark"

The query should contain enough information for an image search
engine to understand exactly what visual subject is required.


============================================================
FINAL CONSISTENCY CHECK
============================================================

Before returning JSON, internally verify:

1. Number of days equals duration_days.
2. Selected destination remains unchanged.
3. Every day's activities actually belong to that destination.
4. Activities within each day are geographically sensible.
5. Every landmark belongs to the destination.
6. Every landmark matches its activity.
7. Hotels are relevant to the destination.
8. Hotel image queries search for accommodation, not scenery.
9. Landmark image queries search for the actual landmark.
10. Food image queries search for food.
11. Destination image queries search for the destination.
12. Dietary preferences are respected.
13. Budget preferences are respected.
14. Transport preferences are respected.
15. No obviously impossible scheduling exists.
16. No generic image queries are used.

Return ONLY valid JSON.
"""


# ============================================================
# JSON EXTRACTION
# ============================================================

def _extract_json(text: str) -> str:
    """
    Extract JSON from Gemini response.

    Handles:
    - normal JSON
    - ```json fenced JSON
    - accidental surrounding text
    """

    text = (text or "").strip()

    # Remove markdown code fences if Gemini adds them.
    fence = re.search(
        r"```(?:json)?\s*(.*?)```",
        text,
        re.DOTALL | re.IGNORECASE,
    )

    if fence:
        return fence.group(1).strip()

    # Find the outermost JSON object.
    start = text.find("{")
    end = text.rfind("}")

    if start != -1 and end != -1 and end >= start:
        return text[start:end + 1]

    return text


# ============================================================
# GEMINI CALL HELPER
# ============================================================

def _call(
    prompt: str,
    system_prompt: str,
) -> Dict[str, Any]:
    """
    Send a request to Gemini and return parsed JSON.
    """

    # Gemini can occasionally return a temporary 503/UNAVAILABLE
    # during periods of high demand. Retry those temporary failures
    # a few times before giving up.
    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config={
                    "system_instruction": system_prompt,
                    "temperature": 0.8,
                    "response_mime_type": "application/json",
                },
            )
            break

        except Exception as exc:
            error_text = str(exc)
            is_temporary_503 = (
                "503" in error_text
                or "UNAVAILABLE" in error_text
                or "high demand" in error_text.lower()
            )

            # Retry only temporary availability/high-demand errors.
            if is_temporary_503 and attempt < max_attempts - 1:
                wait_seconds = 2 ** (attempt + 1)  # 2s, then 4s
                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                f"Gemini API Error: {error_text}"
            ) from exc

    text = getattr(response, "text", None)

    if not text:
        raise ValueError(
            "Gemini returned an empty response."
        )

    cleaned = _extract_json(text)

    try:
        data = json.loads(cleaned)

    except json.JSONDecodeError as exc:
        raise ValueError(
            "Gemini returned invalid JSON: "
            f"{text[:500]}"
        ) from exc

    if not isinstance(data, dict):
        raise ValueError(
            "Gemini response must be a JSON object."
        )

    return data


# ============================================================
# PREFERENCE FORMATTER
# ============================================================

def _preference_text(
    prefs: Dict[str, Any]
) -> str:
    """
    Convert questionnaire preferences into a clean prompt.
    """

    interests = prefs.get(
        "interests",
        [],
    )

    if isinstance(interests, list):
        interests_text = ", ".join(
            str(item)
            for item in interests
        )
    else:
        interests_text = str(interests)

    return f"""
Destination scope: The AI should decide automatically between domestic and international travel.
Diet: {prefs.get("diet", "veg")}
Budget: {prefs.get("budget", "mid-range")}
Duration: {prefs.get("duration_days", 5)} days
Interests: {interests_text}
Companions: {prefs.get("companions", "solo")}
Transport: {prefs.get("transport", "flight")}
Origin: {prefs.get("origin") or "Not specified"}
""".strip()


# ============================================================
# DESTINATION SUGGESTIONS
# ============================================================

async def generate_suggestions(
    prefs: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate four destination suggestions based on
    questionnaire preferences.
    """

    prompt = f"""
User travel preferences:

{_preference_text(prefs)}

Generate exactly four suitable destination suggestions.

Make sure all four destinations are distinct and genuinely
match the user's preferences.

Return ONLY the required JSON.
"""

    return _call(
        prompt,
        SUGGESTION_PROMPT,
    )


# ============================================================
# SIMILAR DESTINATIONS (from saved trip history)
# ============================================================

SIMILAR_PROMPT = """
You are an expert travel curator for an AI Tour Planner.

The user has saved or explored trips to certain destinations before.
Based on those destinations and their preferences, recommend exactly
FOUR NEW destinations that are similar in vibe, region, or style.

Return ONLY valid JSON. Do NOT return markdown.

Required schema:

{
    "suggestions": [
        {
            "name": "string",
            "country": "string",
            "why": "one concise sentence explaining why this fits based on their past trips",
            "image_query": "specific real travel photo search phrase"
        }
    ]
}

Rules:

- Return exactly 4 destinations.
- All 4 must be distinct.
- Do NOT repeat any destination the user has already visited or saved.
- Suggest places that share a similar atmosphere, region, activity
  type, or travel style as the user's past destinations.
- Consider the user's budget, interests, and companion preferences
  if available.
- image_query must describe a real, recognizable travel location
  including the destination name.
- Do NOT use generic queries like "travel" or "beautiful destination".
"""


async def generate_similar_destinations(
    past_destinations: list,
    preferences: dict,
) -> dict:
    """
    Generate four destination suggestions based on the user's
    saved/explored trip history and preferences.
    """
    dest_names = [
        d.get("name", "")
        for d in past_destinations
        if isinstance(d, dict) and d.get("name")
    ]

    dest_list = "\n".join(
        f"- {name}" for name in dest_names
    ) if dest_names else "- (no past destinations yet)"

    prefs_text = _preference_text(preferences) if preferences else "No specific preferences provided."

    prompt = f"""
The user has previously saved or explored trips to these destinations:

{dest_list}

User preferences:
{prefs_text}

Generate exactly four NEW destination suggestions that are similar
in vibe, region, or style to the user's past destinations.

Do NOT repeat any destination the user has already visited.

Return ONLY the required JSON.
"""

    return _call(
        prompt,
        SIMILAR_PROMPT,
    )


# ============================================================
# DETAILED ITINERARY
# ============================================================

async def generate_itinerary(
    prefs: Dict[str, Any],
    destination: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate the detailed itinerary for the selected destination.
    """

    if destination is None:
        destination = {
            "name": "a destination matching the preferences",
            "country": "",
            "why": "",
            "image_query": "",
        }

    destination_name = destination.get(
        "name",
        "Unknown destination",
    )

    destination_country = destination.get(
        "country",
        "",
    )

    destination_why = destination.get(
        "why",
        "",
    )

    destination_image_query = destination.get(
        "image_query",
        "",
    )

    prompt = f"""
User travel preferences:

{_preference_text(prefs)}

SELECTED DESTINATION:

Name: {destination_name}
Country: {destination_country}
Why it was recommended: {destination_why}
Image query: {destination_image_query}


IMPORTANT:

The user has already selected this destination.

Generate the complete detailed itinerary specifically for:

{destination_name}, {destination_country}

Do NOT replace the selected destination with another destination.

All daily activities, landmarks, hotels, food suggestions and
destination information must be relevant to the selected
destination.

Return ONLY the required JSON.
"""

    return _call(
        prompt,
        DETAIL_PROMPT,
    )

# ============================================================
# ACTIVITY REPLACEMENT (WEATHER-AWARE)
# ============================================================

ACTIVITY_REPLACE_PROMPT = """
You are an expert AI travel planner adjusting a single activity
because weather or other conditions may disrupt the original plan.

Return ONLY valid JSON. Do NOT return markdown or explanations.

Required schema:

{
    "activity": "string - the new activity suggestion",
    "landmark": "string - the landmark or venue name, or empty string"
}

Rules:

- The replacement must be in the same destination as the original activity.
- If the reason is weather-related (rain, storm, heat, cold, wind),
  prefer indoor or weather-safe alternatives: museums, galleries,
  covered markets, cafes, cooking classes, indoor entertainment,
  shopping arcades, aquariums, planetariums, etc.
- Keep the activity interesting and relevant to the time of day
  (morning, afternoon, or evening).
- The landmark must be a real place or venue in the destination.
- Do not repeat the original activity if it is the one being replaced.
- Keep the activity description concise (one sentence).
"""


async def generate_activity_replacement(
    current_activity: str,
    slot: str,
    day: Dict[str, Any],
    reason: str,
    weather_context: str = "",
) -> Dict[str, Any]:
    """
    Generate a weather-aware replacement for a single activity.
    """
    day_location = day.get("location", "the destination")
    day_title = day.get("title", "")
    day_num = day.get("day", "")

    morning = day.get("morning", {}).get("activity", "")
    afternoon = day.get("afternoon", {}).get("activity", "")
    evening = day.get("evening", {}).get("activity", "")

    prompt = f"""
REPLACEMENT REQUEST

Destination / area: {day_location}
Day {day_num}: {day_title}
Time slot: {slot}

Current activity to replace:
"{current_activity}"

Other activities on this day (for context, do NOT replace these):
- Morning: {morning}
- Afternoon: {afternoon}
- Evening: {evening}

Reason for replacement:
{reason}

{f"Weather context: {weather_context}" if weather_context else ""}

Suggest a single replacement activity that is appropriate for the
time slot, located in the same area, and suitable given the reason
for replacement.

Return ONLY valid JSON.
"""

    return _call(
        prompt,
        ACTIVITY_REPLACE_PROMPT,
    )


# ============================================================
# TRAVEL ASSISTANT CHAT
# ============================================================

ASSISTANT_PROMPT = """
You are a helpful AI travel assistant embedded in an AI Tour Planner app.
The user is viewing their itinerary and asking you questions about it.

Rules:
- Answer concisely and conversationally.
- Keep answers under 200 words unless the user asks for detail.
- Use the itinerary context provided to give accurate, specific answers.
- If the user asks about something not in the itinerary, use your
  travel knowledge to help, but mention that it's outside the itinerary.
- If the user asks about booking, pricing, or payment, direct them to
  the Book Now button on the page.
- Be friendly, enthusiastic, and helpful.
- Do not use markdown formatting. Use plain text.
"""


async def generate_assistant_reply(
    question: str,
    itinerary_context: str,
) -> str:
    """
    Generate a conversational reply to a user's question
    about their itinerary.
    """

    prompt = f"""
ITINERARY CONTEXT:
{itinerary_context}

USER QUESTION:
{question}

Answer the user's question helpfully based on the itinerary context above.
If the question is about something not covered in the itinerary, use your
general travel knowledge to assist.
"""

    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config={
                    "system_instruction": ASSISTANT_PROMPT,
                    "temperature": 0.7,
                },
            )
            break

        except Exception as exc:
            error_text = str(exc)
            is_temporary_503 = (
                "503" in error_text
                or "UNAVAILABLE" in error_text
                or "high demand" in error_text.lower()
            )

            if is_temporary_503 and attempt < max_attempts - 1:
                wait_seconds = 2 ** (attempt + 1)
                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                f"Gemini API Error: {error_text}"
            ) from exc

    text = getattr(response, "text", None)

    if not text:
        return "I'm sorry, I couldn't generate a response. Please try asking again."

    return text.strip()


# ============================================================
# REFINE ITINERARY
# ============================================================

REFINE_PROMPT = """
You are an AI travel planner refining an existing itinerary.
The user wants to adjust their current trip — NOT create a new one.

Rules:
- Return ONLY valid JSON in the exact same schema as the input itinerary.
- Keep the same number of days and destinations.
- Keep the same JSON structure: title, summary, destinations, days, hotels, flights, transport, landmarks, tips, estimated_total_cost.
- Each day has: day, title, location, morning {activity, landmark}, afternoon {activity, landmark}, evening {activity, landmark}, food {breakfast, lunch, dinner, image_query}.
- Apply the user's requested refinements while keeping the trip coherent.
- If asked for cheaper options, swap expensive hotels/activities for budget alternatives and update estimated_total_cost.
- If asked for more adventurous/cultural/relaxing, swap relevant activities.
- Do NOT add markdown formatting. Return raw JSON only.
"""


async def generate_refined_itinerary(
    itinerary: dict,
    preferences: dict,
    instructions: list,
) -> dict:
    """
    Refine an existing itinerary based on user instructions.
    Returns the updated itinerary as a dict.
    """

    import json

    prompt = f"""
CURRENT ITINERARY (JSON):
{json.dumps(itinerary, indent=2)}

USER PREFERENCES:
{json.dumps(preferences, indent=2)}

REFINEMENT INSTRUCTIONS:
{chr(10).join(f"- {inst}" for inst in instructions)}

Return the refined itinerary as JSON. Keep the same structure and number of days.
Apply the refinements above. Return ONLY the JSON, no markdown, no explanation.
"""

    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config={
                    "system_instruction": REFINE_PROMPT,
                    "temperature": 0.6,
                    "response_mime_type": "application/json",
                },
            )
            break

        except Exception as exc:
            error_text = str(exc)
            is_temporary_503 = (
                "503" in error_text
                or "UNAVAILABLE" in error_text
                or "high demand" in error_text.lower()
            )

            if is_temporary_503 and attempt < max_attempts - 1:
                wait_seconds = 2 ** (attempt + 1)
                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                f"Gemini API Error: {error_text}"
            ) from exc

    text = getattr(response, "text", None)

    if not text:
        raise RuntimeError("Empty response from AI model")

    text = text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        text = "\n".join(lines)

    try:
        refined = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"AI returned invalid JSON: {e}") from e

    return refined
