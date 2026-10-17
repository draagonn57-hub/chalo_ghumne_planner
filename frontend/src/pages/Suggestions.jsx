import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Compass, MapPin, Scale, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AILoadingChecklist from "@/components/AILoadingChecklist";
import SmartImage from "@/components/SmartImage";
import CompareModal from "@/components/CompareModal";

const MAX_COMPARE = 4;
const EMPTY_SUGGESTIONS = [];

function destId(d) {
  return `${(d?.name || "").trim().toLowerCase()}::${(d?.country || "").trim().toLowerCase()}`;
}

const LOADING_STEPS = [
  "Locking in your destination",
  "Building the day-by-day plan",
  "Selecting hotels",
  "Finding flights & transport",
  "Polishing the details",
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.12, ease: [0.2, 0.9, 0.3, 1] },
  }),
};

export function imageFor(query = "travel", salt = "") {
  // Re-exported for backward compatibility (Itinerary imports this)
  // but SmartImage is the preferred way going forward
  let hash = 0;
  const key = `${query}-${salt}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const POOL = [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=1200&q=80",
  ];
  return POOL[hash % POOL.length];
}

export function handleImageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=1200&q=80";
}

export default function Suggestions({ mode }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [exploringMore, setExploringMore] = useState(false);
  const [exploredHistory, setExploredHistory] = useState(() => {
    try {
      const rawHistory = sessionStorage.getItem("tp_explored_history");
      return rawHistory ? JSON.parse(rawHistory) : [];
    } catch {
      return [];
    }
  });
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [seenCompareHint, setSeenCompareHint] = useState(() => {
    try {
      return sessionStorage.getItem("tp_compare_hint") === "1";
    } catch {
      return false;
    }
  });
  const [hintForId, setHintForId] = useState(null);

  useEffect(() => {
    if (data?.suggestions) {
      const names = data.suggestions.map((s) => s.name).filter(Boolean);
      setExploredHistory((prev) => {
        const merged = Array.from(new Set([...prev, ...names]));
        try {
          sessionStorage.setItem("tp_explored_history", JSON.stringify(merged));
        } catch {}
        return merged;
      });
    }
  }, [data]);

  useEffect(() => {
    if (mode === "recommended") {
      setFetching(true);
      api
        .get("/itinerary/recommend")
        .then((r) => setData(r.data))
        .catch((err) => {
          const msg = err?.response?.data?.detail || "No recommendations available yet.";
          setError(msg);
        })
        .finally(() => setFetching(false));
      return;
    }

    const raw = sessionStorage.getItem("tp_last_suggestions");
    if (!raw) {
      nav("/plan");
      return;
    }
    try {
      setData(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem("tp_last_suggestions");
      nav("/plan");
    }
  }, [nav, mode]);

  const choose = async (destination, index) => {
    setBusy(index);
    setLoading(true);

    try {
      const { data: detail } = await api.post("/itinerary/generate-detail", {
        preferences: data.preferences,
        destination,
      });

      sessionStorage.setItem("tp_last_itinerary", JSON.stringify(detail));
      nav("/itinerary/preview");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not build that itinerary");
      setLoading(false);
    } finally {
      setBusy(null);
    }
  };

  const exploreMore = async () => {
    if (exploringMore || busy !== null || !data?.preferences) return;

    setExploringMore(true);

    try {
      const currentNames = (data.suggestions || []).map((s) => s.name).filter(Boolean);
      const allExcluded = Array.from(
        new Set([
          ...exploredHistory,
          ...currentNames,
          ...(data.visited || []),
        ])
      );

      const payload = {
        ...data.preferences,
        exclude_destinations: allExcluded,
      };

      const res = await api.post("/itinerary/generate", payload);
      const newSuggestions = res.data?.suggestions;

      if (!Array.isArray(newSuggestions) || newSuggestions.length !== 4) {
        throw new Error("We couldn't find more places right now. Please try again in a little while.");
      }

      const newNames = newSuggestions.map((s) => s.name).filter(Boolean);
      const nextHistory = Array.from(new Set([...allExcluded, ...newNames]));
      setExploredHistory(nextHistory);
      try {
        sessionStorage.setItem("tp_explored_history", JSON.stringify(nextHistory));
      } catch {}

      const nextData = {
        ...data,
        suggestions: [...(data.suggestions || []), ...newSuggestions],
      };
      setData(nextData);
      try {
        sessionStorage.setItem("tp_last_suggestions", JSON.stringify(nextData));
      } catch {}

      toast.success("Here are four new destinations to explore!");
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const errorMsg =
        status === 429 ||
        detail?.toLowerCase().includes("quota") ||
        detail?.toLowerCase().includes("rate")
          ? "We couldn't find more places right now. Please try again in a little while."
          : detail || "We couldn't find more places right now. Please try again in a little while.";

      toast.error(errorMsg);
    } finally {
      setExploringMore(false);
    }
  };

  const suggestions = data?.suggestions || EMPTY_SUGGESTIONS;

  useEffect(() => {
    const valid = new Set(suggestions.map(destId));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [suggestions]);

  const selectedDestinations = useMemo(
    () => suggestions.filter((d) => selectedIds.has(destId(d))),
    [suggestions, selectedIds]
  );
  const selectedCount = selectedDestinations.length;
  const atMax = selectedCount >= MAX_COMPARE;
  const canCompare = selectedCount >= 2 && selectedCount <= MAX_COMPARE;

  const markHintSeen = () => {
    if (seenCompareHint) return;
    setSeenCompareHint(true);
    setHintForId(null);
    try {
      sessionStorage.setItem("tp_compare_hint", "1");
    } catch {}
  };

  const toggleSelect = (destination) => {
    const id = destId(destination);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_COMPARE) return prev;
      next.add(id);
      return next;
    });
    markHintSeen();
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openCompare = () => {
    if (!canCompare) return;
    setCompareOpen(true);
  };

  if (fetching) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <Sparkles size={28} className="text-[#E76F51] animate-pulse mx-auto" />
        <p className="text-slate-500 mt-4">Finding places similar to your saved trips…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center" data-testid="recommend-error">
        <p className="eyebrow">No recommendations yet</p>
        <h2 className="font-display text-3xl mt-2">{error}</h2>
        <button onClick={() => nav("/plan")} className="btn-primary mt-6">
          Back to planning modes
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14 pb-28 sm:pb-14">
        <div className="tp-card p-8 sm:p-10">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => nav("/plan")}
          className="btn-ghost flex items-center gap-2"
          data-testid="suggestions-back"
        >
          <ArrowLeft size={16} />
          {mode === "recommended" ? "Back to modes" : "Change preferences"}
        </motion.button>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="min-w-0"
          >
            <p className="eyebrow">{mode === "recommended" ? "Inspired by your trips" : "Your shortlist"}</p>
            <h1 className="font-display text-4xl sm:text-6xl mt-2 tracking-tight">
              {mode === "recommended" ? "Places you'll love next" : "Four places, one perfect fit."}
            </h1>
            <p className="text-slate-600 mt-4 max-w-2xl leading-relaxed">
              {mode === "recommended"
                ? "Based on your saved trips and favourites, here are destinations with a similar vibe."
                : "Choose the destination that pulls you in. We'll build the full day-by-day journey only for the one you pick."}
            </p>
          </motion.div>

          <div className="hidden sm:flex flex-col items-start sm:items-end shrink-0">
            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-sm font-semibold text-[#0D5C75] hover:underline"
                  data-testid="compare-clear"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={openCompare}
                disabled={!canCompare || busy !== null}
                title={!canCompare ? "Select at least 2 places to compare" : "Compare selected places"}
                className="inline-flex items-center gap-2 font-semibold text-sm bg-[#0D5C75] text-white px-4 py-2 rounded-full transition-colors hover:bg-[#0A485C] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0D5C75]"
                data-testid="compare-btn"
              >
                <Scale size={16} />
                Compare ({selectedCount})
              </button>
            </div>
            {!canCompare && (
              <p className="text-xs text-slate-500 mt-2">Select at least 2 places to compare</p>
            )}
          </div>
        </div>

        <div
          className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 transition-opacity duration-300 ${
            exploringMore ? "opacity-75 pointer-events-none" : ""
          }`}
        >
          {suggestions.map((d, i) => {
            const id = destId(d);
            const selected = selectedIds.has(id);
            const checkboxDisabled = atMax && !selected;
            return (
              <motion.article
                key={`${d.name}-${i}`}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className={`tp-card overflow-hidden text-left group relative ${
                  selected ? "compare-selected" : ""
                }`}
                data-testid={`suggestion-card-wrap-${i}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`Select ${d.name} to compare`}
                  aria-disabled={checkboxDisabled || busy !== null}
                  disabled={busy !== null}
                  title={
                    hintForId === id || hintForId === `max:${id}`
                      ? undefined
                      : checkboxDisabled
                        ? "You can compare up to 4 places"
                        : seenCompareHint
                          ? `Select ${d.name} to compare`
                          : "Select to compare"
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (checkboxDisabled || busy !== null) return;
                    toggleSelect(d);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      if (checkboxDisabled || busy !== null) return;
                      toggleSelect(d);
                    }
                  }}
                  onMouseEnter={() => {
                    if (checkboxDisabled) {
                      setHintForId(`max:${id}`);
                      return;
                    }
                    if (!seenCompareHint) setHintForId(id);
                  }}
                  onMouseLeave={() => {
                    if (hintForId === id) {
                      setHintForId(null);
                      markHintSeen();
                    } else if (hintForId === `max:${id}`) {
                      setHintForId(null);
                    }
                  }}
                  onFocus={() => {
                    if (checkboxDisabled) {
                      setHintForId(`max:${id}`);
                      return;
                    }
                    if (!seenCompareHint) setHintForId(id);
                  }}
                  onBlur={() => {
                    if (hintForId === id) {
                      setHintForId(null);
                      markHintSeen();
                    } else if (hintForId === `max:${id}`) {
                      setHintForId(null);
                    }
                  }}
                  className={`absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md border shadow-[0_4px_12px_rgba(10,30,40,0.18)] transition-[border-color,background-color,transform] duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${
                    selected
                      ? "bg-[#0D5C75] border-[#0D5C75] text-white"
                      : checkboxDisabled
                        ? "bg-white/85 border-white text-transparent opacity-60 cursor-not-allowed"
                        : "bg-white/85 border-white text-transparent hover:border-[#0D5C75]"
                  }`}
                  data-testid={`compare-checkbox-${i}`}
                >
                  <Check
                    size={14}
                    strokeWidth={3}
                    className={`text-white origin-center transition-transform duration-150 ${
                      selected ? "scale-100" : "scale-0"
                    }`}
                  />
                  {hintForId === id && !seenCompareHint && !selected && (
                    <span className="pointer-events-none z-30 absolute right-0 top-full mt-2 whitespace-nowrap rounded-full bg-[#1A2530] text-white text-[11px] font-medium px-2.5 py-1 shadow-md">
                      Select to compare
                    </span>
                  )}
                  {hintForId === `max:${id}` && (
                    <span className="pointer-events-none z-30 absolute right-0 top-full mt-2 whitespace-nowrap rounded-full bg-[#1A2530] text-white text-[11px] font-medium px-2.5 py-1 shadow-md">
                      You can compare up to 4 places
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => choose(d, i)}
                  disabled={busy !== null || exploringMore}
                  className="relative z-0 w-full text-left disabled:opacity-70"
                  data-testid={`suggestion-card-${i}`}
                >
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <SmartImage
                      directUrl={d.image}
                      imageQuery={d.image_query || d.name || "travel"}
                      salt={`suggestion-${i}`}
                      alt={d.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  <div className="p-5">
                    <div className="text-slate-500 text-sm flex items-center gap-1">
                      <MapPin size={14} />
                      {d.country}
                    </div>
                    <div className="font-display text-2xl mt-2 group-hover:text-[#E76F51] transition-colors">
                      {d.name}
                    </div>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                      {d.why}
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 text-[#0D5C75] font-semibold text-sm bg-[#0D5C75]/8 px-3 py-1.5 rounded-full group-hover:bg-[#0D5C75] group-hover:text-white transition-colors duration-300">
                      {busy === i ? (
                        <>
                          <Sparkles size={16} className="animate-pulse" />
                          Crafting your days…
                        </>
                      ) : (
                        <>
                          Explore this journey
                          <ArrowRight size={16} />
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </motion.article>
            );
          })}
        </div>

        {/* Explore More Places Button Section */}
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={exploreMore}
            disabled={exploringMore || busy !== null}
            className="btn-secondary group inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3.5 text-sm sm:text-base font-semibold shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            data-testid="explore-more-btn"
          >
            {exploringMore ? (
              <>
                <Sparkles size={18} className="text-[#E76F51] animate-spin" />
                <span>Finding your next favourite places…</span>
              </>
            ) : (
              <>
                <Compass
                  size={19}
                  className="text-[#0D5C75] transition-transform duration-500 group-hover:rotate-45"
                />
                <span>✦ Explore More Places</span>
              </>
            )}
          </button>

          <p className="text-xs sm:text-sm text-slate-500 mt-3 max-w-md">
            Not finding your perfect place? Discover four more destinations.
          </p>

          {exploringMore && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 inline-flex items-center gap-2 text-xs font-medium text-[#0D5C75] bg-[#0D5C75]/8 px-3.5 py-1.5 rounded-full"
            >
              <Sparkles size={14} className="text-[#E76F51] animate-pulse" />
              <span>Finding your next favourite places…</span>
            </motion.div>
          )}
        </div>
        </div>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(13,92,117,0.2)]">
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-sm font-semibold text-[#0D5C75] shrink-0"
              data-testid="compare-clear-mobile"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={openCompare}
            disabled={!canCompare || busy !== null}
            title={!canCompare ? "Select at least 2 places to compare" : "Compare selected places"}
            className="flex-1 inline-flex items-center justify-center gap-2 font-semibold text-sm bg-[#0D5C75] text-white px-4 py-3 rounded-full transition-colors hover:bg-[#0A485C] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0D5C75]"
            data-testid="compare-btn-mobile"
          >
            <Scale size={16} />
            Compare ({selectedCount})
          </button>
        </div>
        {!canCompare && (
          <p className="text-xs text-slate-500 mt-2 text-center">Select at least 2 places to compare</p>
        )}
      </div>

      <CompareModal
        open={compareOpen}
        destinations={selectedDestinations}
        preferences={data.preferences}
        onClose={() => setCompareOpen(false)}
        onBuildItinerary={(destination) => {
          setCompareOpen(false);
          if (!destination) return;
          const index = suggestions.findIndex((s) => destId(s) === destId(destination));
          choose(destination, index >= 0 ? index : 0);
        }}
      />

      {loading && (
        <AILoadingChecklist steps={LOADING_STEPS} done={false} onDone={() => {}} />
      )}
    </>
  );
}
