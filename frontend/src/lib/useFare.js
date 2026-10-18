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
 * useTrainFares(trains)
 *
 * Returns:
 *   fares:      { "<trainIdx>:<classIdx>": { price, price_int, error, loading } }
 *   fetchFare:  (trainIdx, classIdx, train) => void
 *
 * trains must be the array from useTransport — each item has
 *   { number, from_station, to_station, classes: [{name}] }
 */
export function useTrainFares(trains) {
  // fares["0:2"] = { price: "₹650", price_int: 650, error: null, loading: false }
  const [fares, setFares] = useState({});

  // In-memory dedup: track in-flight requests so double-clicks don't double-fetch
  const inFlight = useRef(new Set());

  const fetchFare = useCallback(
    async (trainIdx, classIdx, train) => {
      const cls = train.classes?.[classIdx];
      if (!cls) return;

      const key = `${trainIdx}:${classIdx}`;

      // Already loaded or loading
      if (fares[key]?.price !== undefined || inFlight.current.has(key)) return;

      inFlight.current.add(key);
      setFares((prev) => ({ ...prev, [key]: { loading: true, price: null, price_int: null, error: null } }));

      try {
        const { data } = await api.post("/fare", {
          train_number: train.number,
          from_station: train.from_station,
          to_station:   train.to_station,
          travel_class: cls.name,
        });

        setFares((prev) => ({
          ...prev,
          [key]: {
            loading:   false,
            price:     data.price     ?? null,
            price_int: data.fare      ?? null,
            error:     data.error     ?? null,
          },
        }));
      } catch (err) {
        setFares((prev) => ({
          ...prev,
          [key]: {
            loading:   false,
            price:     null,
            price_int: null,
            error:     err?.response?.data?.detail || "Unable to fetch fare.",
          },
        }));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [fares]
  );

  return { fares, fetchFare };
}
