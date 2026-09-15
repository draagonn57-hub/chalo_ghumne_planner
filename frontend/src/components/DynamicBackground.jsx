import { useEffect, useRef, useState } from "react";

/**
 * Curated pool of high-quality, varied travel photos.
 */
const CYCLE_POOL = [
  // Bora Bora / turquoise lagoon
  "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=1920&q=70",

  // Dolomites — Italian Alps
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=70",

  // New York skyline at night
  "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1920&q=70",

  // Misty forest / pines
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=70",

  // Sahara-style dunes
  "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1920&q=70",

  // Santorini — whitewashed cliffs
  "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1920&q=70",

  // Northern lights over cabin
  "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1920&q=70",

  // Kyoto — red pagoda / cherry blossom
  "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1920&q=70",

  // Bali rice terraces
  "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1920&q=70",

  // Alpine lake & mountains
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=70",

  // Petra / historic ruin
  "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=1920&q=70",

  // Paris — Eiffel Tower at dusk
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1920&q=70",
];

/**
 * Static background used for Auth page.
 */
const STATIC_DEFAULT =
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=70";

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function DynamicBackground({
  mode = "cycle",
  images = CYCLE_POOL,
  staticImage = STATIC_DEFAULT,
  intervalMs = 7000,
  overlayClassName = "hero-overlay",
  className = "",
}) {
  const reduce = prefersReducedMotion();
  const pool = images && images.length ? images : CYCLE_POOL;

  const [index, setIndex] = useState(0);
  const [nextReady, setNextReady] = useState(true);

  const timerRef = useRef(null);

  useEffect(() => {
    if (mode !== "cycle" || reduce) return;

    const nextIdx = (index + 1) % pool.length;

    setNextReady(false);

    const img = new Image();
    img.src = pool[nextIdx];

    img.onload = () => setNextReady(true);
    img.onerror = () => setNextReady(true);
  }, [index, mode, reduce, pool]);

  useEffect(() => {
    if (mode !== "cycle" || reduce) return;
    if (!nextReady) return;

    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % pool.length);
    }, intervalMs);

    return () => clearTimeout(timerRef.current);
  }, [nextReady, mode, reduce, intervalMs, pool.length]);

  if (mode === "static" || reduce) {
    const src = mode === "static" ? staticImage : pool[0];

    return (
      <div
        className={`absolute inset-0 ${className}`}
        data-testid="dynamic-bg-static"
      >
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />

        {overlayClassName && (
          <div className={`absolute inset-0 ${overlayClassName}`} />
        )}
      </div>
    );
  }

  const currentSrc = pool[index];
  const prevSrc = pool[(index - 1 + pool.length) % pool.length];

  return (
    <div
      className={`absolute inset-0 ${className}`}
      data-testid="dynamic-bg-cycle"
    >
      <img
        key={`prev-${prevSrc}`}
        src={prevSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />

      <img
        key={`cur-${currentSrc}`}
        src={currentSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover dynamic-bg-fade"
        loading="eager"
      />

      {overlayClassName && (
        <div className={`absolute inset-0 ${overlayClassName}`} />
      )}
    </div>
  );
}