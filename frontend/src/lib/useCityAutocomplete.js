/**
 * useCityAutocomplete
 *
 * Lazy-loads the Google Maps JS SDK (with the "places" library) once, then
 * exposes a `getSuggestions(input)` function that returns an array of city
 * name strings via the Places AutocompleteService.
 *
 * Returns: { getSuggestions, ready }
 *   - getSuggestions(text): Promise<string[]>  — call on every keystroke
 *   - ready: boolean — true once the SDK has finished loading
 */

import React from "react";

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const SCRIPT_ID = "gm-places-sdk";

// Singleton load state
let sdkStatus = "idle"; // "idle" | "loading" | "ready" | "error"
const listeners = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
  listeners.length = 0;
}

function loadSdk() {
  if (sdkStatus !== "idle") return;
  if (!MAPS_KEY) {
    sdkStatus = "error";
    notifyListeners();
    return;
  }

  // If some other script already put the SDK on the page
  if (window.google?.maps?.places) {
    sdkStatus = "ready";
    notifyListeners();
    return;
  }

  if (document.getElementById(SCRIPT_ID)) {
    // Script tag exists but hasn't fired yet — wait for it
    sdkStatus = "loading";
    return;
  }

  sdkStatus = "loading";
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    sdkStatus = "ready";
    notifyListeners();
  };
  script.onerror = () => {
    sdkStatus = "error";
    notifyListeners();
  };
  document.head.appendChild(script);
}

export function useCityAutocomplete() {
  const [ready, setReady] = React.useState(
    () => sdkStatus === "ready"
  );

  React.useEffect(() => {
    if (sdkStatus === "ready") {
      setReady(true);
      return;
    }

    const onDone = () => setReady(sdkStatus === "ready");
    listeners.push(onDone);

    // Kick off loading only from the first consumer
    loadSdk();

    // If it was already "loading" before this component mounted, the
    // existing script tag will fire onload and call notifyListeners().
    return () => {
      const idx = listeners.indexOf(onDone);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  /**
   * getSuggestions(text): Promise<string[]>
   * Returns up to 5 city/region name strings.
   * Falls back to [] if the SDK isn't ready or the query is too short.
   */
  const getSuggestions = React.useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!ready || !window.google?.maps?.places) {
          resolve([]);
          return;
        }
        if (!text || text.trim().length < 2) {
          resolve([]);
          return;
        }

        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          {
            input: text,
            types: ["(cities)"],
          },
          (predictions, status) => {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              predictions?.length
            ) {
              resolve(predictions.map((p) => p.description));
            } else {
              resolve([]);
            }
          }
        );
      }),
    [ready]
  );

  return { getSuggestions, ready };
}

