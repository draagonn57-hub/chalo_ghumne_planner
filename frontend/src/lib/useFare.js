/**
 * useFare — fetches a single train class fare from the backend on demand.
 *
 * Rules:
 * - Called only when the user clicks a class chip.
 * - Results are cached in-memory so re-clicking doesn't re-fetch.
 * - Never falls back to estimated or AI-generated fares.
 */
import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

/**
 * useTrainFares(trains, travelDate)
 *
 * Returns:
 *   fares:      { "<trainIdx>:<classIdx>": { price, price_int, error, loading, unavailable, breakdown } }
 *   fetchFare:  (trainIdx, classIdx, train) => void
 *
 * trains must be the array from useTransport — each item has
 *   { number, from_station, to_station, classes: [{name}] }
 * travelDate is YYYY-MM-DD passed to the fare API for accurate pricing.
 */
export function useTrainFares(trains, travelDate = "") {
  const [fares, setFares] = useState({});

  // Stable ref so fetchFare never re-creates due to fares state change
  const faresRef    = useRef(fares);
  const inFlight    = useRef(new Set());
  faresRef.current  = fares;

  const fetchFare = useCallback(
    async (trainIdx, classIdx, train) => {
      const cls = train.classes?.[classIdx];
      if (!cls) return;

      const key = `${trainIdx}:${classIdx}`;

      // Already has a real price or unavailable — don't re-fetch
      const existing = faresRef.current[key];
      if (existing?.price || existing?.unavailable) return;

      // Already in-flight
      if (inFlight.current.has(key)) return;

      inFlight.current.add(key);
      setFares((prev) => ({
        ...prev,
        [key]: { loading: true, price: null, price_int: null, error: null, unavailable: false },
      }));

      try {
        const { data } = await api.post("/fare", {
          train_number: train.number,
          from_station: train.from_station,
          to_station:   train.to_station,
          travel_class: cls.name,
          travel_date:  travelDate || undefined,
        });

        setFares((prev) => ({
          ...prev,
          [key]: {
            loading:     false,
            price:       data.price       ?? null,
            price_int:   data.fare        ?? null,
            error:       data.error       ?? null,
            unavailable: data.unavailable ?? false,
            breakdown:   data.breakdown   ?? null,
          },
        }));
      } catch (err) {
        setFares((prev) => ({
          ...prev,
          [key]: {
            loading:     false,
            price:       null,
            price_int:   null,
            error:       err?.response?.data?.detail || "Unable to fetch fare.",
            unavailable: false,
          },
        }));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [] // stable — reads fares via ref, not closure
  );

  return { fares, fetchFare };
}
