import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  MapPin,
  Scale,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Wallet,
  Navigation,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AILoadingChecklist from "@/components/AILoadingChecklist";
import SmartImage from "@/components/SmartImage";
import CompareModal from "@/components/CompareModal";
import VisitedPlacesInput from "@/components/VisitedPlacesInput";
import { useAuth } from "@/lib/AuthContext";
import { BUDGET_OPTIONS as SHARED_BUDGET_OPTIONS } from "@/lib/budgetUtils";
import CityAutocompleteInput from "@/components/CityAutocompleteInput";

const MAX_COMPARE = 4;
const EMPTY_SUGGESTIONS = [];

// Derived from the shared BUDGET_OPTIONS so labels stay consistent.
// PreferencesRow uses { value, label } — map from the shared { v, label } shape.
const BUDGET_OPTIONS = SHARED_BUDGET_OPTIONS.map(({ v, label }) => ({ value: v, label }));

const COMPANION_OPTIONS = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
];

function destId(d) {
  return `${(d?.name || "").trim().toLowerCase()}::${(d?.country || "").trim().toLowerCase()}`;
}

const LOADING_STEPS_SAVED = [
  "Scanning your saved trips…",
  "Finding similar vibes…",
  "Curating destinations…",
  "Almost ready…",
];

const LOADING_STEPS_NEW = [
  "Analysing your travel taste…",
  "Finding places you haven't visited…",
  "Curating your shortlist…",
  "Almost ready…",
];

const LOADING_STEPS_ITINERARY = [
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

// ---------- exported helpers (Itinerary imports these) ----------

export function imageFor(query = "travel", salt = "") {
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
  event.currentTarget.src =
    "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=1200&q=80";
}

// ---------- session storage helpers ----------

function ssKey(suffix, userId) {
  return userId ? `tp_${suffix}_${userId}` : `tp_${suffix}`;
}

function ssGet(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function ssSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------- PreferencesRow ----------

function PreferencesRow({ prefs, onChange, disabled }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Budget */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <Wallet size={13} /> Budget
        </label>
        <div className="flex gap-2 flex-wrap">
          {BUDGET_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...prefs, budget: value })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                prefs.budget === value
                  ? "bg-[#0D5C75] text-white border-[#0D5C75]"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#0D5C75]/40"
              } disabled:opacity-50`}
              data-testid={`pref-budget-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <Calendar size={13} /> Duration
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || prefs.duration_days <= 1}
            onClick={() =>
              onChange({ ...prefs, duration_days: Math.max(1, (prefs.duration_days || 5) - 1) })
            }
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#0D5C75] hover:text-[#0D5C75] transition-colors disabled:opacity-40"
          >
            −
          </button>
          <span className="font-semibold text-slate-700 dark:text-slate-200 min-w-[3rem] text-center text-sm" data-testid="pref-days">
            {prefs.duration_days || 5} days
          </span>
          <button
            type="button"
            disabled={disabled || prefs.duration_days >= 30}
            onClick={() =>
              onChange({ ...prefs, duration_days: Math.min(30, (prefs.duration_days || 5) + 1) })
            }
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#0D5C75] hover:text-[#0D5C75] transition-colors disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Companions */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <Users size={13} /> Travelling with
        </label>
        <div className="flex gap-2 flex-wrap">
          {COMPANION_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...prefs, companions: value })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                prefs.companions === value
                  ? "bg-[#0D5C75] text-white border-[#0D5C75]"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#0D5C75]/40"
              } disabled:opacity-50`}
              data-testid={`pref-companions-${value}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Origin */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <Navigation size={13} /> Travelling from
          <span className="text-slate-400 font-normal normal-case tracking-normal ml-1">(optional)</span>
        </label>
        <CityAutocompleteInput
          id="pref-origin"
          label=""
          value={prefs.origin || ""}
          onChange={(val) => onChange({ ...prefs, origin: val })}
          placeholder="City name…"
          testId="pref-origin"
          disabled={disabled}
        />
        <p className="text-xs text-slate-400 mt-1">Used to suggest flights and trains</p>
      </div>
    </div>
  );
}

// ---------- SuggestionsGrid ----------

function SuggestionsGrid({ suggestions, busy, exploringMore, onChoose, selectedIds, onToggle, hintForId, setHintForId, seenCompareHint, markHintSeen, atMax }) {
  return (
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
            className={`tp-card overflow-hidden text-left group relative ${selected ? "compare-selected" : ""}`}
            data-testid={`suggestion-card-wrap-${i}`}
          >
            {/* Compare checkbox */}
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={`Select ${d.name} to compare`}
              aria-disabled={checkboxDisabled || busy !== null}
              disabled={busy !== null}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (checkboxDisabled || busy !== null) return;
                onToggle(d);
              }}
              onMouseEnter={() => {
                if (checkboxDisabled) { setHintForId(`max:${id}`); return; }
                if (!seenCompareHint) setHintForId(id);
              }}
              onMouseLeave={() => {
                if (hintForId === id) { setHintForId(null); markHintSeen(); }
                else if (hintForId === `max:${id}`) setHintForId(null);
              }}
              className={`absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md border shadow-[0_4px_12px_rgba(10,30,40,0.18)] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${
                selected
                  ? "bg-[#0D5C75] border-[#0D5C75] text-white"
                  : checkboxDisabled
                    ? "bg-white/85 border-white text-transparent opacity-60 cursor-not-allowed"
                    : "bg-white/85 border-white text-transparent hover:border-[#0D5C75]"
              }`}
              data-testid={`compare-checkbox-${i}`}
            >
              <Check size={14} strokeWidth={3} className={`text-white transition-transform duration-150 ${selected ? "scale-100" : "scale-0"}`} />
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

            {/* Card click → choose */}
            <button
              type="button"
              onClick={() => onChoose(d, i)}
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
                  <MapPin size={14} /> {d.country}
                </div>
                <div className="font-display text-2xl mt-2 group-hover:text-[#E76F51] transition-colors">
                  {d.name}
                </div>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{d.why}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-[#0D5C75] font-semibold text-sm bg-[#0D5C75]/8 px-3 py-1.5 rounded-full group-hover:bg-[#0D5C75] group-hover:text-white transition-colors duration-300">
                  {busy === i ? (
                    <><Sparkles size={16} className="animate-pulse" />Crafting your days…</>
                  ) : (
                    <>Explore this journey <ArrowRight size={16} /></>
                  )}
                </div>
              </div>
            </button>
          </motion.article>
        );
      })}
    </div>
  );
}

// ---------- Main component ----------

export default function Suggestions({ mode }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;

  // ── Shared state ─────────────────────────────────────
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(false);          // itinerary generation
  const [fetching, setFetching] = useState(false);        // initial AI call
  const [exploringMore, setExploringMore] = useState(false);
  const [error, setError] = useState("");

  const [exploredHistory, setExploredHistory] = useState(() =>
    ssGet("tp_explored_history", [])
  );

  // Compare state
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [seenCompareHint, setSeenCompareHint] = useState(() => {
    try { return sessionStorage.getItem("tp_compare_hint") === "1"; } catch { return false; }
  });
  const [hintForId, setHintForId] = useState(null);

  // ── mode=recommended state ────────────────────────────
  const [status, setStatus] = useState(null);             // { has_saved_trips, saved_destinations }
  const [statusLoading, setStatusLoading] = useState(false);

  // Visited chips
  const [visitedChips, setVisitedChips] = useState(() =>
    ssGet(ssKey("visited_places", userId), [])
  );
  // Preferences for no-saved-trips users
  const [visitedPrefs, setVisitedPrefs] = useState(() =>
    ssGet(ssKey("visited_prefs", userId), {
      budget: "mid-range",
      duration_days: 5,
      companions: "solo",
      origin: "",
    })
  );

  // Panel: "add visited places" visible toggle (for users with saved trips)
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  // Track what was last submitted to avoid re-submission with same data
  const [lastSubmittedChips, setLastSubmittedChips] = useState([]);

  // ── Persist visited chips + prefs ─────────────────────
  useEffect(() => {
    ssSet(ssKey("visited_places", userId), visitedChips);
  }, [visitedChips, userId]);

  useEffect(() => {
    ssSet(ssKey("visited_prefs", userId), visitedPrefs);
  }, [visitedPrefs, userId]);

  // ── Track explored history ────────────────────────────
  useEffect(() => {
    if (data?.suggestions) {
      const names = data.suggestions.map((s) => s.name).filter(Boolean);
      setExploredHistory((prev) => {
        const merged = Array.from(new Set([...prev, ...names]));
        ssSet("tp_explored_history", merged);
        return merged;
      });
    }
  }, [data]);

  // ── Status check (mode=recommended only) ─────────────
  useEffect(() => {
    if (mode !== "recommended") return;
    setStatusLoading(true);
    api
      .get("/itinerary/recommend/status")
      .then((r) => setStatus(r.data))
      .catch(() => setStatus({ has_saved_trips: false, saved_destinations: [] }))
      .finally(() => setStatusLoading(false));
  }, [mode]);

  // Auto-fetch for users WITH saved trips
  useEffect(() => {
    if (mode !== "recommended") return;
    if (!status) return;
    if (!status.has_saved_trips) return;
    // Auto POST with no extra chips
    setFetching(true);
    api
      .post("/itinerary/recommend", { visited_places: [], exclude_destinations: [] })
      .then((r) => setData(r.data))
      .catch((err) => {
        const msg = err?.response?.data?.detail || "Could not load recommendations.";
        setError(msg);
      })
      .finally(() => setFetching(false));
  }, [mode, status]);

  // ── Non-recommended mode: load from sessionStorage ───
  useEffect(() => {
    if (mode === "recommended") return;
    const raw = sessionStorage.getItem("tp_last_suggestions");
    if (!raw) { nav("/plan"); return; }
    try { setData(JSON.parse(raw)); }
    catch { sessionStorage.removeItem("tp_last_suggestions"); nav("/plan"); }
  }, [nav, mode]);

  // ── Helpers ───────────────────────────────────────────
  const markHintSeen = useCallback(() => {
    if (seenCompareHint) return;
    setSeenCompareHint(true);
    setHintForId(null);
    try { sessionStorage.setItem("tp_compare_hint", "1"); } catch {}
  }, [seenCompareHint]);

  const choose = async (destination, index) => {
    setBusy(index);
    setLoading(true);
    try {
      const prefs = data?.preferences || {};
      const { data: detail } = await api.post("/itinerary/generate-detail", {
        preferences: prefs,
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

  // POST /itinerary/recommend with places + prefs (used by both submit and updateSuggestions)
  const fetchRecommend = useCallback(async (chips, prefs, excludeExtra = []) => {
    const currentNames = (data?.suggestions || []).map((s) => s.name).filter(Boolean);
    const allExcluded = Array.from(
      new Set([...exploredHistory, ...currentNames, ...(data?.visited || []), ...excludeExtra])
    );
    const payload = {
      visited_places: chips,
      exclude_destinations: allExcluded,
      ...(prefs ? { preferences: prefs } : {}),
    };
    const res = await api.post("/itinerary/recommend", payload);
    return res.data;
  }, [data, exploredHistory]);

  // "Get my suggestions" (no saved trips path)
  const handleSubmitVisited = async () => {
    if (visitedChips.length === 0) return;
    setFetching(true);
    setError("");
    try {
      const result = await fetchRecommend(visitedChips, visitedPrefs, []);
      setData(result);
      setLastSubmittedChips([...visitedChips]);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      if (status === 400) {
        toast.error(detail || "Add at least one visited place.");
      } else {
        setError(detail || "Could not load recommendations. Please try again.");
      }
    } finally {
      setFetching(false);
    }
  };

  // "Update my suggestions" (has saved trips path, panel)
  const handleUpdateSuggestions = async () => {
    setFetching(true);
    try {
      const result = await fetchRecommend(visitedChips, null, []);
      setData(result);
      setLastSubmittedChips([...visitedChips]);
      setAddPanelOpen(false);
      toast.success("Suggestions updated with your extra places!");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || "Could not update suggestions.");
    } finally {
      setFetching(false);
    }
  };

  const exploreMore = async () => {
    if (exploringMore || busy !== null || !data) return;
    setExploringMore(true);
    try {
      const currentNames = (data.suggestions || []).map((s) => s.name).filter(Boolean);
      const allExcluded = Array.from(
        new Set([...exploredHistory, ...currentNames, ...(data.visited || [])])
      );

      let newSuggestions;
      if (mode === "recommended") {
        // Use POST /itinerary/recommend for recommended mode
        const result = await api.post("/itinerary/recommend", {
          visited_places: visitedChips,
          exclude_destinations: allExcluded,
          ...(status?.has_saved_trips ? {} : { preferences: visitedPrefs }),
        });
        newSuggestions = result.data?.suggestions;
      } else {
        // Use POST /itinerary/generate for questionnaire mode
        const payload = { ...data.preferences, exclude_destinations: allExcluded };
        const res = await api.post("/itinerary/generate", payload);
        newSuggestions = res.data?.suggestions;
      }

      if (!Array.isArray(newSuggestions) || newSuggestions.length !== 4) {
        throw new Error("We couldn't find more places right now. Please try again in a little while.");
      }

      const newNames = newSuggestions.map((s) => s.name).filter(Boolean);
      const nextHistory = Array.from(new Set([...allExcluded, ...newNames]));
      setExploredHistory(nextHistory);
      ssSet("tp_explored_history", nextHistory);

      const nextData = { ...data, suggestions: [...(data.suggestions || []), ...newSuggestions] };
      setData(nextData);
      if (mode !== "recommended") {
        ssSet("tp_last_suggestions", nextData);
      }
      toast.success("Here are four new destinations to explore!");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const s = err?.response?.status;
      const errorMsg =
        s === 429 || detail?.toLowerCase().includes("quota") || detail?.toLowerCase().includes("rate")
          ? "We couldn't find more places right now. Please try again in a little while."
          : detail || "We couldn't find more places right now. Please try again in a little while.";
      toast.error(errorMsg);
    } finally {
      setExploringMore(false);
    }
  };

  // Compare helpers
  const suggestions = data?.suggestions || EMPTY_SUGGESTIONS;

  useEffect(() => {
    const valid = new Set(suggestions.map(destId));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [suggestions]);

  const selectedDestinations = useMemo(
    () => suggestions.filter((d) => selectedIds.has(destId(d))),
    [suggestions, selectedIds]
  );
  const selectedCount = selectedDestinations.length;
  const atMax = selectedCount >= MAX_COMPARE;
  const canCompare = selectedCount >= 2 && selectedCount <= MAX_COMPARE;

  const toggleSelect = (destination) => {
    const id = destId(destination);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= MAX_COMPARE) return prev;
      next.add(id);
      return next;
    });
    markHintSeen();
  };

  // ── RENDER: loading status ────────────────────────────
  if (mode === "recommended" && statusLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <Sparkles size={28} className="text-[#E76F51] animate-pulse mx-auto" />
        <p className="text-slate-500 mt-4">Loading…</p>
      </div>
    );
  }

  // ── RENDER: error screen ──────────────────────────────
  if (error && mode !== "recommended") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center" data-testid="recommend-error">
        <p className="eyebrow">Something went wrong</p>
        <h2 className="font-display text-3xl mt-2">{error}</h2>
        <button onClick={() => { setError(""); setData(null); }} className="btn-primary mt-6">
          Retry
        </button>
      </div>
    );
  }

  // ── RENDER: mode=recommended, NO saved trips, NOT yet submitted ──
  if (mode === "recommended" && status && !status.has_saved_trips && !data) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14">
        <div className="tp-card p-8 sm:p-10">
          <button
            onClick={() => nav("/plan")}
            className="btn-ghost flex items-center gap-2 text-sm"
            data-testid="suggestions-back"
          >
            <ArrowLeft size={16} /> Back to planning modes
          </button>

          <div className="mt-10">
            <p className="eyebrow">Tell us about your travels</p>
            <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight">
              Which places have you<br />already visited?
            </h1>
            <p className="text-slate-500 mt-4 leading-relaxed">
              Add as many as you like. We'll suggest new places based on your taste.
            </p>
          </div>

          <div className="mt-8">
            <VisitedPlacesInput
              chips={visitedChips}
              onChange={setVisitedChips}
              disabled={fetching}
            />
          </div>

          {/* Trip preferences */}
          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-600 mb-4">Trip preferences</p>
            <PreferencesRow prefs={visitedPrefs} onChange={setVisitedPrefs} disabled={fetching} />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmitVisited}
              disabled={fetching || visitedChips.length === 0}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="visited-submit-btn"
            >
              {fetching ? (
                <><Sparkles size={16} className="animate-pulse" />Finding places based on your travels…</>
              ) : (
                <><Sparkles size={16} />Get my suggestions</>
              )}
            </button>
            <button onClick={() => nav("/plan")} className="btn-ghost" disabled={fetching}>
              Back to planning modes
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: AI fetching (has_saved_trips path, initial load) ──
  if (fetching && !data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <Sparkles size={28} className="text-[#E76F51] animate-pulse mx-auto" />
        <p className="text-slate-500 mt-4">
          {status?.has_saved_trips
            ? "Finding places similar to your saved trips…"
            : "Finding places based on your travels…"}
        </p>
      </div>
    );
  }

  if (!data && mode !== "recommended") return null;
  if (!data) return null;

  // ── RENDER: results page (both paths) ────────────────
  const hasSavedTrips = data?.has_saved_trips ?? status?.has_saved_trips ?? false;
  const savedChipsForPanel = hasSavedTrips
    ? (status?.saved_destinations || data?.visited || []).filter(
        (n) => !visitedChips.map((c) => c.toLowerCase()).includes(n.toLowerCase())
      )
    : [];

  return (
    <>
      {/* Hide the suggestions page while compare modal is open */}
      {!compareOpen && (
      <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14 pb-28 sm:pb-14">
        <div className="tp-card p-8 sm:p-10">
          {/* Back button */}
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

          {/* Header */}
          <div className="mt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="min-w-0"
            >
              <p className="eyebrow">
                {mode === "recommended" ? "Inspired by your travels" : "Your shortlist"}
              </p>
              <h1 className="font-display text-4xl sm:text-6xl mt-2 tracking-tight">
                {mode === "recommended" ? "Places you'll love next" : "Four places, one perfect fit."}
              </h1>
              <p className="text-slate-600 mt-4 max-w-2xl leading-relaxed">
                {mode === "recommended"
                  ? "Based on your travel history, here are destinations with a similar vibe."
                  : "Choose the destination that pulls you in. We'll build the full day-by-day journey only for the one you pick."}
              </p>
            </motion.div>

            {/* Compare controls (desktop) */}
            <div className="hidden sm:flex flex-col items-start sm:items-end shrink-0">
              <div className="flex items-center gap-3">
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-sm font-semibold text-[#0D5C75] hover:underline"
                    data-testid="compare-clear"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => canCompare && setCompareOpen(true)}
                  disabled={!canCompare || busy !== null}
                  className="inline-flex items-center gap-2 font-semibold text-sm bg-[#0D5C75] text-white px-4 py-2 rounded-full transition-colors hover:bg-[#0A485C] disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="compare-btn"
                >
                  <Scale size={16} /> Compare ({selectedCount})
                </button>
              </div>
              {!canCompare && (
                <p className="text-xs text-slate-500 mt-2">Select at least 2 places to compare</p>
              )}
            </div>
          </div>

          {/* ── Add visited places panel (for users WITH saved trips) ── */}
          {mode === "recommended" && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setAddPanelOpen((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#0D5C75] border border-[#0D5C75]/20 px-4 py-2 rounded-full hover:bg-[#0D5C75]/5 transition-colors"
                data-testid="add-visited-toggle"
              >
                <Plus size={15} />
                {visitedChips.length > 0
                  ? `Edit places I've visited (${visitedChips.length})`
                  : "Have you visited other places? Tell the AI"}
                {addPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              <AnimatePresence>
                {addPanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-sm text-slate-600 mb-4">
                        Add places you've visited and we'll fine-tune your suggestions to exclude them and find similar vibes.
                      </p>
                      <VisitedPlacesInput
                        chips={visitedChips}
                        onChange={setVisitedChips}
                        savedChips={savedChipsForPanel}
                        disabled={fetching}
                      />
                      <button
                        type="button"
                        onClick={handleUpdateSuggestions}
                        disabled={fetching || visitedChips.length === 0}
                        className="mt-4 btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                        data-testid="visited-submit-btn"
                      >
                        {fetching ? (
                          <><Sparkles size={16} className="animate-pulse" />Updating…</>
                        ) : (
                          <><Sparkles size={16} />Update my suggestions</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Suggestions grid */}
          <SuggestionsGrid
            suggestions={suggestions}
            busy={busy}
            exploringMore={exploringMore}
            onChoose={choose}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            hintForId={hintForId}
            setHintForId={setHintForId}
            seenCompareHint={seenCompareHint}
            markHintSeen={markHintSeen}
            atMax={atMax}
          />

          {/* Explore More */}
          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={exploreMore}
              disabled={exploringMore || busy !== null}
              className="btn-secondary group inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-7 py-3.5 text-sm sm:text-base font-semibold shadow-sm hover:shadow-md transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="explore-more-btn"
            >
              {exploringMore ? (
                <><Sparkles size={18} className="text-[#E76F51] animate-spin" /><span>Finding your next favourite places…</span></>
              ) : (
                <><Compass size={19} className="text-[#0D5C75] transition-transform duration-500 group-hover:rotate-45" /><span>✦ Explore More Places</span></>
              )}
            </button>
            <p className="text-xs sm:text-sm text-slate-500 mt-3 max-w-md">
              Not finding your perfect place? Discover four more destinations.
            </p>
          </div>
        </div>
      </div>
      )}{/* end !compareOpen */}

      {/* Mobile compare bar — also hidden when compare is open */}
      {!compareOpen && (
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur-md px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(13,92,117,0.2)]">
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-sm font-semibold text-[#0D5C75] shrink-0"
              data-testid="compare-clear-mobile"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => canCompare && setCompareOpen(true)}
            disabled={!canCompare || busy !== null}
            className="flex-1 inline-flex items-center justify-center gap-2 font-semibold text-sm bg-[#0D5C75] text-white px-4 py-3 rounded-full transition-colors hover:bg-[#0A485C] disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="compare-btn-mobile"
          >
            <Scale size={16} /> Compare ({selectedCount})
          </button>
        </div>
        {!canCompare && (
          <p className="text-xs text-slate-500 mt-2 text-center">Select at least 2 places to compare</p>
        )}
      </div>
      )}{/* end mobile bar !compareOpen */}

      <CompareModal
        open={compareOpen}
        destinations={selectedDestinations}
        preferences={data?.preferences}
        onClose={() => setCompareOpen(false)}
        onBuildItinerary={(destination) => {
          setCompareOpen(false);
          if (!destination) return;
          const index = suggestions.findIndex((s) => destId(s) === destId(destination));
          choose(destination, index >= 0 ? index : 0);
        }}
      />

      {loading && <AILoadingChecklist steps={LOADING_STEPS_ITINERARY} done={false} onDone={() => {}} />}
    </>
  );
}
