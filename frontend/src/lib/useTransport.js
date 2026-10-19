/**
 * useTransport — fetches real train and flight data from the backend.
 *
 * Strategy:
 * 1. Immediately seed state with AI-estimated trains from the itinerary (if any).
 *    This means users see train options right away, even before the API responds.
 * 2. Fire a background API call to the backend (Railkit SDK via bridge).
 * 3. If real trains come back, upgrade the display (trainsEstimated → false).
 * 4. If the API fails or returns nothing, keep the AI trains showing.
 * 5. Only show an error when there are zero trains from both sources.
 */
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

export function resolveOrigin(itinerary, preferences) {
  if (preferences?.origin) return preferences.origin;
  return null;
}

export function resolveDestination(itinerary) {
  const dests = itinerary?.destinations || [];
  return dests[0]?.name || null;
}

export function resolveTravelDate(preferences) {
  const raw = preferences?.start_date;
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("-");
    return `${y}-${m}-${d}`;
  }
  return null;
}

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
 *   trains          — array of train objects (real or AI-estimated)
 *   trainError      — string | null  (null when trains are showing)
 *   trainsLoading   — bool
 *   trainsEstimated — bool  (true = AI fallback, not live Railkit data)
 *   flights         — array of flight objects
 *   flightError     — string | null
 *   flightsLoading  — bool
 *   travelDate      — YYYY-MM-DD | null
 *   needsDate       — bool
 *   setOverrideDate — fn(YYYY-MM-DD)
 */
export function useTransport(itinerary, preferences, isDomestic) {
  const [trains, setTrains]               = useState([]);
  const [trainError, setTrainError]       = useState(null);
  const [trainsLoading, setTrainsLoading] = useState(false);
  const [trainsEstimated, setTrainsEstimated] = useState(false);

  const [flights, setFlights]               = useState([]);
  const [flightError, setFlightError]       = useState(null);
  const [flightsLoading, setFlightsLoading] = useState(false);

  const [overrideDate, setOverrideDate] = useState(null);

  // Always keep a live ref so async callbacks see the latest itinerary
  const itRef = useRef(itinerary);
  itRef.current = itinerary;

  const resolvedDate = overrideDate || resolveTravelDate(preferences);
  const travelDate   = resolvedDate && isDateFuture(resolvedDate) ? resolvedDate : null;
  const needsDate    = !travelDate;

  const origin      = resolveOrigin(itinerary, preferences);
  const destination = resolveDestination(itinerary);

  // ── Step 1: Seed AI trains from itinerary immediately ───────────────────
  // Runs whenever the itinerary object changes (e.g. after async load from DB).
  // Gives users something to see before the API responds.
  useEffect(() => {
    if (!isDomestic) {
      setTrains([]);
      setTrainsEstimated(false);
      setTrainError(null);
      return;
    }
    const aiTrains = (itinerary?.trains || []).filter(
      (t) => t && t.name && t.classes?.length > 0
    );
    if (aiTrains.length > 0) {
      // Only seed if we haven't already loaded real trains
      setTrains((prev) => (prev.length > 0 && !trainsEstimated ? prev : aiTrains));
      setTrainsEstimated(true);
      setTrainError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itinerary, isDomestic]);

  // ── Step 2: Background live API fetch ────────────────────────────────────
  useEffect(() => {
    if (!origin || !destination || needsDate) {
      setFlights([]);
      return;
    }

    let cancelled = false;

    // Flights ────────────────────────────────────────────────────────────────
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

    // Trains (domestic only) ─────────────────────────────────────────────────
    if (!isDomestic) return () => { cancelled = true; };

    setTrainsLoading(true);

    api
      .get("/trains", { params: { origin, destination, date: travelDate } })
      .then((r) => {
        if (cancelled) return;
        const { trains: tr } = r.data;
        if (tr && tr.length > 0) {
          // Got real Railkit trains — replace AI estimates
          setTrains(tr);
          setTrainsEstimated(false);
          setTrainError(null);
        }
        // API returned empty → keep AI seed, don't overwrite
      })
      .catch(() => {
        if (cancelled) return;
        // API failed → keep AI seed, show error only if nothing is showing
        setTrains((prev) => {
          if (prev.length === 0) {
            setTrainError("Live trains unavailable. Please check IRCTC.");
          }
          return prev;
        });
      })
      .finally(() => {
        if (!cancelled) setTrainsLoading(false);
      });

    return () => { cancelled = true; };
  }, [origin, destination, travelDate, isDomestic]);

  return {
    trains,
    trainError,
    trainsLoading,
    trainsEstimated,
    flights,
    flightError,
    flightsLoading,
    travelDate,
    needsDate,
    setOverrideDate,
  };
}
