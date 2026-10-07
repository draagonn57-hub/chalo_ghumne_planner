const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";

const locationCache = new Map();
const weatherCache = new Map();

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function getWeatherDescription(code) {
  if (code === 0) return { label: "Clear sky", iconType: "sun" };
  if ([1, 2].includes(code)) {
    return { label: "Partly cloudy", iconType: "partly-cloudy" };
  }
  if (code === 3) return { label: "Cloudy", iconType: "cloudy" };
  if ([45, 48].includes(code)) return { label: "Foggy", iconType: "fog" };
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { label: "Drizzle", iconType: "rain" };
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: "Rain", iconType: "rain" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: "Snow", iconType: "snow" };
  }
  if ([95, 96, 99].includes(code)) {
    return { label: "Thunderstorm", iconType: "storm" };
  }

  return { label: "Mixed weather", iconType: "cloudy" };
}

async function tryGeocode(name) {
  const url =
    `${GEOCODING_BASE}?name=${encodeURIComponent(name)}` +
    "&count=1&language=en&format=json";

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.results?.[0];

  if (result?.latitude == null || result?.longitude == null) {
    return null;
  }

  return {
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

async function geocodeLocation(location) {
  const cleanLocation = String(location || "").trim();

  if (!cleanLocation) {
    return null;
  }

  const cacheKey = cleanLocation.toLowerCase();

  if (locationCache.has(cacheKey)) {
    return locationCache.get(cacheKey);
  }

  try {
    // Try the full location string first
    let coords = await tryGeocode(cleanLocation);

    // If that fails, try the last part after a comma (usually the city name)
    if (!coords && cleanLocation.includes(",")) {
      const parts = cleanLocation.split(",").map((s) => s.trim()).filter(Boolean);
      for (let i = parts.length - 1; i >= 0 && !coords; i--) {
        coords = await tryGeocode(parts[i]);
      }
    }

    // Strip common suffixes like "area", "district", "neighborhood" and retry
    if (!coords) {
      const stripped = cleanLocation
        .replace(/\b(area|district|neighborhood|quarter|zone|sector)\b/gi, "")
        .replace(/[(),]/g, " ")
        .trim();
      if (stripped && stripped !== cleanLocation) {
        coords = await tryGeocode(stripped);
        if (!coords && stripped.includes(" ")) {
          for (const part of stripped.split(/\s+/)) {
            if (part.length < 3) continue;
            coords = await tryGeocode(part);
            if (coords) break;
          }
        }
      }
    }

    locationCache.set(cacheKey, coords);
    return coords;
  } catch (error) {
    locationCache.set(cacheKey, null);
    return null;
  }
}

function createWeatherObject(daily, index) {
  const weatherCode = daily.weather_code?.[index];
  const description = getWeatherDescription(weatherCode);

  return {
    date: daily.time?.[index] ?? null,
    label: description.label,
    iconType: description.iconType,
    tempMax: daily.temperature_2m_max?.[index] ?? null,
    tempMin: daily.temperature_2m_min?.[index] ?? null,
    precipitationProbability:
      daily.precipitation_probability_max?.[index] ?? 0,
    windMax: daily.wind_speed_10m_max?.[index] ?? null,
    weatherCode,
  };
}

/**
 * Fetch weather for a location and date from Open-Meteo.
 *
 * Returns:
 *   { ...weather } on success
 *   { error: "OUT_OF_RANGE" } if the date is outside the 16-day forecast window
 *   { error: "NO_LOCATION" } if the location can't be geocoded
 *   { error: "FETCH_FAILED" } if the API request fails
 *   { error: "NO_DATA" } if the API returns no daily data
 *   null if location or date is missing/invalid
 */
export async function fetchWeatherForDate(location, date) {
  const dateString = formatDate(date);

  if (!location || !dateString) {
    return null;
  }

  const cleanLocation = String(location).trim();
  const cacheKey = `${cleanLocation.toLowerCase()}::${dateString}`;

  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey);
  }

  const coordinates = await geocodeLocation(cleanLocation);

  if (!coordinates) {
    const result = { error: "NO_LOCATION" };
    weatherCache.set(cacheKey, result);
    return result;
  }

  try {
    const url =
      `${API_BASE}?latitude=${coordinates.latitude}` +
      `&longitude=${coordinates.longitude}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,` +
      `precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto` +
      `&forecast_days=16`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const result = { error: "FETCH_FAILED" };
      weatherCache.set(cacheKey, result);
      return result;
    }

    const data = await response.json();

    if (data?.error || !data?.daily?.time) {
      const result = { error: "NO_DATA" };
      weatherCache.set(cacheKey, result);
      return result;
    }

    const index = data.daily.time.indexOf(dateString);

    if (index === -1) {
      const result = { error: "OUT_OF_RANGE" };
      weatherCache.set(cacheKey, result);
      return result;
    }

    const weather = createWeatherObject(data.daily, index);

    weatherCache.set(cacheKey, weather);

    return weather;
  } catch (error) {
    const result = { error: "FETCH_FAILED" };
    weatherCache.set(cacheKey, result);
    return result;
  }
}

export function isDisruptiveWeather(weather) {
  if (!weather || weather.error) {
    return false;
  }

  const rainyCodes = [
    51, 53, 55, 56, 57,
    61, 63, 65, 66, 67,
    71, 73, 75, 77,
    80, 81, 82, 85, 86,
    95, 96, 99,
  ];

  return (
    rainyCodes.includes(weather.weatherCode) ||
    Number(weather.precipitationProbability || 0) >= 50
  );
}

export function getWeatherAdvisory(weather) {
  if (!weather || weather.error || !isDisruptiveWeather(weather)) {
    return [];
  }

  const precipitation = Number(weather.precipitationProbability || 0);

  if (precipitation >= 70) {
    return [
      {
        title: "High chance of rain",
        message:
          "Consider indoor attractions, museums, galleries, cafes, or weather-safe activities.",
      },
    ];
  }

  return [
    {
      title: "Rain may affect this day",
      message:
        "Keep an indoor alternative available and allow extra time between activities.",
    },
  ];
}
