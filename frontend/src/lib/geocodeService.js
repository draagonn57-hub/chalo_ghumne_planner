const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const GEOCODE_ENDPOINT =
  "https://maps.googleapis.com/maps/api/geocode/json";

const LS_KEY = "tp_geocode_cache_v1";
const memoryCache = new Map();

function loadLSCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLSCache(obj) {
  try {
    const keys = Object.keys(obj);
    const trimmed = keys.slice(-500);
    const trimmedObj = {};
    trimmed.forEach((k) => (trimmedObj[k] = obj[k]));
    localStorage.setItem(LS_KEY, JSON.stringify(trimmedObj));
  } catch {
    // localStorage might be full or unavailable
  }
}

function normalizeQuery(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function geocode(query) {
  const clean = normalizeQuery(query);
  if (!clean) return null;

  if (memoryCache.has(clean)) return memoryCache.get(clean);

  const ls = loadLSCache();
  if (ls[clean]) {
    memoryCache.set(clean, ls[clean]);
    return ls[clean];
  }

  if (!API_KEY) return null;

  try {
    const url = `${GEOCODE_ENDPOINT}?address=${encodeURIComponent(
      query
    )}&key=${API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status === "OK" && json.results?.length > 0) {
      const loc = json.results[0].geometry.location;
      const result = {
        lat: loc.lat,
        lng: loc.lng,
        formatted_address: json.results[0].formatted_address,
      };

      memoryCache.set(clean, result);
      ls[clean] = result;
      saveLSCache(ls);

      return result;
    }
  } catch {
    // Network or parse error
  }

  memoryCache.set(clean, null);
  return null;
}

export async function geocodeBatch(queries) {
  const unique = [...new Set(queries.map(normalizeQuery).filter(Boolean))];
  const results = await Promise.all(
    unique.map(async (q) => {
      const r = await geocode(q);
      return [q, r];
    })
  );

  const map = {};
  results.forEach(([q, r]) => (map[q] = r));
  return map;
}

export function hasMapsKey() {
  return !!API_KEY;
}
