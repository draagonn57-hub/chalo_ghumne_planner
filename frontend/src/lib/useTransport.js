/**
 * useTransport — fetches real train and flight data from the backend.
 *
 * Rules:
 * - All API calls go through /api/trains and /api/flights (backend only).
 * - No keys are ever touched in the frontend.
 * - Never falls back to synthetic / AI-generated data.
 */
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

/**
 * Derive the primary origin city from an itinerary.
 * Uses preferences.origin → first destination city fallback.
 */
export function resolveOrigin(itinerary, preferences) {
  if (preferences?.origin) return preferences.origin;
  // First destination is the trip's arrival city, not origin — skip it.
  return null;
}

/**
 * Derive the primary destination city.
 */
export function resolveDestination(itinerary) {
  const dests = itinerary?.destinations || [];
  return dests[0]?.name || null;
}

/**
 * Parse travel date from preferences or itinerary.
 * Returns YYYY-MM-DD string or null.
 */
export function resolveTravelDate(preferences) {
  const raw = preferences?.start_date;
  if (!raw) return null;
  // Accept YYYY-MM-DD or DD-MM-YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("-");
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Returns true if the date is today or in the future.
 */
export function isDateFuture(isoDate) {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(isoDate) >= today;
}

/**
 * useTransport(itinerary, preferences, isDomestic)
 *
 * Returns:
 *   trains:          array of train objects (empty if international or error)
 *   trainError:      string | null
 *   trainsLoading:   bool
 *   flights:         array of flight objects
 *   flightError:     string | null
 *   flightsLoading:  bool
 *   travelDate:      YYYY-MM-DD | null
 *   needsDate:       bool  — true when date is missing or in the past
 *   setOverrideDate: fn(YYYY-MM-DD) — lets user override the date
 */
export function useTransport(itinerary, preferences, isDomestic) {
  const [trains, setTrains]               = useState([]);
  const [trainError, setTrainError]       = useState(null);
  const [trainsLoading, setTrainsLoading] = useState(false);

  const [flights, setFlights]               = useState([]);
  const [flightError, setFlightError]       = useState(null);
  const [flightsLoading, setFlightsLoading] = useState(false);

  const [overrideDate, setOverrideDate] = useState(null);

  // Stable refs so effect deps stay minimal
  const itRef   = useRef(itinerary);
  const prefRef = useRef(preferences);
  itRef.current   = itinerary;
  prefRef.current = preferences;

  const resolvedDate = overrideDate || resolveTravelDate(preferences);
  const travelDate   = resolvedDate && isDateFuture(resolvedDate) ? resolvedDate : null;
  const needsDate    = !travelDate;

  const origin      = resolveOrigin(itinerary, preferences);
  const destination = resolveDestination(itinerary);

  useEffect(() => {
    if (!origin || !destination || needsDate) {
      setTrains([]);
      setFlights([]);
      return;
    }

    // ── Flights (always, for all trips) ───────────────────────────────────
    let cancelled = false;
    setFlightsLoading(true);
    setFlightError(null);

    api
      .get("/flights", { params: { origin, destination, date: travelDate } })
      .then((r) => {
        if (cancelled) return;
        const { flights: fl, error } = r.data;
        setFlights(fl || []);
        setFlightError(error || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setFlights([]);
        setFlightError(
          err?.response?.data?.detail || "Unable to load flights. Please try again."
        );
      })
      .finally(() => {
        if (!cancelled) setFlightsLoading(false);
      });

    // ── Trains (domestic India only) ──────────────────────────────────────
    if (isDomestic) {
      setTrainsLoading(true);
      setTrainError(null);

      api
        .get("/trains", { params: { origin, destination, date: travelDate } })
        .then((r) => {
          if (cancelled) return;
          const { trains: tr, error } = r.data;
          setTrains(tr || []);
          setTrainError(error || null);
        })
        .catch((err) => {
          if (cancelled) return;
          setTrains([]);
          setTrainError(
            err?.response?.data?.detail || "Unable to load trains. Please try again."
          );
        })
        .finally(() => {
          if (!cancelled) setTrainsLoading(false);
        });
    } else {
      setTrains([]);
      setTrainError(null);
      setTrainsLoading(false);
    }

    return () => { cancelled = true; };
  }, [origin, destination, travelDate, isDomestic]);

  return {
    trains,
    trainError,
    trainsLoading,
    flights,
    flightError,
    flightsLoading,
    travelDate,
    needsDate,
    setOverrideDate,
  };
}
