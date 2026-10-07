/**
 * Smart image resolution service.
 *
 * Uses Unsplash API with category-aware searches.
 *
 * Priority:
 * 1. Exact / specific search
 * 2. Location-specific related search
 * 3. Category-specific fallback search
 * 4. Curated fallback image
 *
 * Supports:
 * - destination images
 * - hotel images
 * - landmark images
 * - food images
 *
 * Usage:
 *   resolveImage("Paris", "destination-1")
 *   resolveImage("Zostel Rishikesh", "hotel-1", "hotel")
 */

const UNSPLASH_KEY = process.env.REACT_APP_UNSPLASH_KEY || "";
const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";

const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1470214304380-aadaedcfff1b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
];

const FALLBACK_PHOTO = "";

const cache = new Map();
const inflight = new Map();

/* ============================================================
   HELPERS
============================================================ */

/**
 * Clean user/API-generated search text.
 */
function cleanText(value = "") {
  return String(value)
    .replace(/[^\w\s,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a deterministic fallback image.
 *
 * Same query + salt = same fallback image.
 */
function hashFallback(query, salt = "") {
  const key = `${query}-${salt}`;

  let hash = 0;

  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  return PHOTO_POOL[hash % PHOTO_POOL.length] || FALLBACK_PHOTO;
}

/**
 * Detect the type of image being requested.
 *
 * Supported types:
 * - hotel
 * - food
 * - landmark
 * - destination
 */
function detectType(query = "", type = "") {
  if (type) {
    return String(type).toLowerCase();
  }

  const q = String(query).toLowerCase();

  if (
    q.includes("hotel") ||
    q.includes("hostel") ||
    q.includes("resort") ||
    q.includes("homestay") ||
    q.includes("stay") ||
    q.includes("room")
  ) {
    return "hotel";
  }

  if (
    q.includes("food") ||
    q.includes("restaurant") ||
    q.includes("cuisine") ||
    q.includes("thali") ||
    q.includes("breakfast") ||
    q.includes("lunch") ||
    q.includes("dinner")
  ) {
    return "food";
  }

  if (
    q.includes("waterfall") ||
    q.includes("temple") ||
    q.includes("fort") ||
    q.includes("palace") ||
    q.includes("museum") ||
    q.includes("bridge") ||
    q.includes("monument") ||
    q.includes("beach") ||
    q.includes("lake") ||
    q.includes("mountain") ||
    q.includes("landmark")
  ) {
    return "landmark";
  }

  return "destination";
}

function buildQueries(query, type = "destination") {
  const original = cleanText(query);

  if (!original) {
    return [];
  }

  if (type === "hotel") {
    return [
      `"${original}"`,
      `${original}`,
      `${original} hotel`,
      `${original} hotel room`,
      `${original} hotel interior`,
      `${original} rooms`,
      `${original} property`,
    ];
  }

  if (type === "landmark") {
    return [
      `"${original}"`,
      `${original}`,
      `${original} landmark`,
      `${original} monument`,
      `${original} attraction`,
      `${original} tourism`,
      `${original} travel`,
    ];
  }

  if (type === "food") {
    return [
      `"${original}"`,
      `${original}`,
      `${original} food`,
      `${original} dish`,
      `${original} cuisine`,
      `${original} restaurant`,
    ];
  }

  return [
    `"${original}"`,
    `${original}`,
    `${original} travel`,
    `${original} tourism`,
    `${original} destination`,
  ];
}
/* ============================================================
   UNSPLASH
============================================================ */

/**
 * Search Unsplash.
 *
 * Requests multiple results so we can select
 * the most relevant image instead of blindly
 * using result #1.
 */
async function searchUnsplash(query) {
  const url =
    `${UNSPLASH_ENDPOINT}?query=${encodeURIComponent(query)}` +
    `&per_page=10&orientation=landscape`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unsplash ${response.status}`);
  }

  const json = await response.json();

  return json?.results || [];
}

/**
 * Pick the most useful image from Unsplash results.
 */
function chooseBestResult(results, type, originalQuery) {
  if (!results?.length) {
    return null;
  }

  const queryWords = cleanText(originalQuery)
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const scored = results.map((photo) => {
    const text = [
      photo.alt_description,
      photo.description,
      photo.user?.name,
      photo.tags?.map((tag) => tag.title).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let score = 0;

    // Exact phrase match
    const normalizedQuery = originalQuery
      .toLowerCase()
      .trim();

    if (
      normalizedQuery &&
      text.includes(normalizedQuery)
    ) {
      score += 20;
    }

    // Individual query words
    queryWords.forEach((word) => {
      if (text.includes(word)) {
        score += 5;
      }
    });

    // HOTEL
    if (type === "hotel") {
      if (
        text.includes("hotel") ||
        text.includes("hostel") ||
        text.includes("resort") ||
        text.includes("room") ||
        text.includes("interior") ||
        text.includes("accommodation")
      ) {
        score += 12;
      }

      if (
        text.includes("mountain") ||
        text.includes("road") ||
        text.includes("bridge") ||
        text.includes("landscape") ||
        text.includes("beach")
      ) {
        score -= 6;
      }
    }

    // LANDMARK
    if (type === "landmark") {
      if (
        text.includes("landmark") ||
        text.includes("temple") ||
        text.includes("waterfall") ||
        text.includes("monument") ||
        text.includes("bridge") ||
        text.includes("fort") ||
        text.includes("palace") ||
        text.includes("museum") ||
        text.includes("beach") ||
        text.includes("lake") ||
        text.includes("mountain")
      ) {
        score += 10;
      }
    }

    // FOOD
    if (type === "food") {
      if (
        text.includes("food") ||
        text.includes("restaurant") ||
        text.includes("dish") ||
        text.includes("cuisine") ||
        text.includes("meal") ||
        text.includes("dining")
      ) {
        score += 10;
      }
    }

    return {
      photo,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);

 const best = scored[0];

if (!best) {
  return null;
}

// Destinations:
// Unsplash's search ranking is usually enough for cities/regions.
// Don't reject a good city photo just because its metadata
// doesn't literally contain the city name.
if (type === "destination") {
  return best.photo;
}

// Landmarks:
// Require some evidence that the image is actually a landmark.
if (type === "landmark") {
  if (best.score >= 8) {
    return best.photo;
  }

  return null;
}

// Food:
// Require food-related evidence.
if (type === "food") {
  if (best.score >= 10) {
    return best.photo;
  }

  return null;
}

// Hotels:
// Keep hotels stricter so a random landscape doesn't become
// a hotel image.
if (type === "hotel") {
  if (best.score >= 12) {
    return best.photo;
  }

  return null;
}

return best.photo;
}
/* ============================================================
   MAIN IMAGE RESOLVER
============================================================ */

/**
 * Resolve an image.
 *
 * Usage:
 *
 * resolveImage(
 *   "Zostel Rishikesh Tapovan",
 *   "hotel-1",
 *   "hotel"
 * );
 *
 * The third parameter is optional, so this remains
 * compatible with Bolt's simpler implementation.
 */
export async function resolveImage(
  query,
  salt = "",
  type = ""
) {
  const cleanQuery = cleanText(query);
  const detectedType = detectType(
    cleanQuery,
    type
  );

  const cacheKey =
    `${cleanQuery}||${salt}||${detectedType}`;

  /* --------------------------------------------------------
     Cache
  -------------------------------------------------------- */

  if (cache.has(cacheKey)) {
    return Promise.resolve(
      cache.get(cacheKey)
    );
  }

  /* --------------------------------------------------------
     Prevent duplicate simultaneous requests
  -------------------------------------------------------- */

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey);
  }

  /* --------------------------------------------------------
     No API key / empty query
  -------------------------------------------------------- */

  if (!UNSPLASH_KEY || !cleanQuery) {
  cache.set(cacheKey, "");
  return Promise.resolve("");
}

  const searchQueries = buildQueries(
    cleanQuery,
    detectedType
  );

  /* --------------------------------------------------------
     Unsplash search
  -------------------------------------------------------- */

  const promise = (async () => {
    try {
      /*
       * Search from most specific
       * to most general.
       */
      for (const searchQuery of searchQueries) {
        try {
          const results =
            await searchUnsplash(searchQuery);

          const selected =
            chooseBestResult(
              results,
              detectedType,
              cleanQuery
            );

          if (selected?.urls?.regular) {
            const imageUrl =
              selected.urls.regular;

            cache.set(
              cacheKey,
              imageUrl
            );

            return imageUrl;
          }
        } catch {
          /*
           * If one search fails, continue
           * with the next search query.
           */
        }
      }

      /* ------------------------------------------------------
         Nothing useful found
      ------------------------------------------------------ */

      cache.set(cacheKey, "");

return "";
    } finally {
      /*
       * Always remove the request from
       * the inflight map.
       */
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(
    cacheKey,
    promise
  );

  return promise;
}

/* ============================================================
   SYNCHRONOUS FALLBACK
============================================================ */

/**
 * Synchronous fallback used while Unsplash
 * is being searched or when Unsplash is unavailable.
 */
export function fallbackImage(
  query = "travel",
  salt = ""
) {
  return hashFallback(
    query,
    salt
  );
}

/* ============================================================
   EXPORTS
============================================================ */

export {
  PHOTO_POOL,
  FALLBACK_PHOTO,
};