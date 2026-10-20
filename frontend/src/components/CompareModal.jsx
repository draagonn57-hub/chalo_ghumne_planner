import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight, Scale, Sparkles, X, Star, Wallet,
  CloudSun, Compass, UtensilsCrossed, MapPin,
} from "lucide-react";
import { api } from "@/lib/api";
import SmartImage from "@/components/SmartImage";

/* ── The exact 5 allowed criteria (order matters) ────────────────────────────── */
const ALLOWED_CRITERIA = [
  "match with interests",
  "total budget",
  "best season and weather",
  "must do experiences",
  "food and hotels",
];

function normCriterion(name) {
  return (name || "").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

function matchesAllowed(name) {
  const n = normCriterion(name);
  // Direct substring match both ways
  const direct = ALLOWED_CRITERIA.find((a) => n.includes(a) || a.includes(n));
  if (direct) return direct;
  // Keyword fallback — each criterion's key words
  const KEYWORDS = {
    "match with interests":    ["interest", "match"],
    "total budget":            ["budget", "cost", "price", "estimated total"],
    "best season and weather": ["season", "weather", "climate", "month"],
    "must do experiences":     ["experience", "must do", "activities", "famous places"],
    "food and hotels":         ["food", "hotel", "stay", "cuisine", "dining"],
  };
  for (const [criterion, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => n.includes(w))) return criterion;
  }
  return null;
}

/* ── Icon map for the 5 criteria ──────────────────────────────────────────── */
const CRITERION_ICONS = {
  "match with interests":    Star,
  "total budget":            Wallet,
  "best season and weather": CloudSun,
  "must do experiences":     Compass,
  "food and hotels":         UtensilsCrossed,
};

function criterionIcon(name) {
  const key = (name || "").toLowerCase().trim();
  for (const [k, Icon] of Object.entries(CRITERION_ICONS)) {
    if (key.includes(k) || k.includes(key.split(" ")[0])) return Icon;
  }
  return Star;
}

/* ── place-name canonicalisation (unchanged logic) ─────────────────────────── */
function canonPlace(name, placeNames) {
  if (!name || typeof name !== "string") return null;
  const raw = name.trim().toLowerCase();
  if (!raw) return null;
  const exact = placeNames.find((n) => n.toLowerCase() === raw);
  if (exact) return exact;
  const strippedParens = raw.replace(/\(.*?\)/g, "").trim();
  if (strippedParens) {
    const m = placeNames.find((n) => n.toLowerCase() === strippedParens);
    if (m) return m;
  }
  const commaPart = raw.split(",")[0].trim();
  if (commaPart) {
    const m = placeNames.find((n) => n.toLowerCase() === commaPart);
    if (m) return m;
  }
  return placeNames.find(
    (n) => raw.includes(n.toLowerCase()) || n.toLowerCase().includes(raw)
  ) || null;
}

/* ── validation (same logic as before) ──────────────────────────────────────── */
export function validateCompareResult(data, destinations) {
  const placeNames = (destinations || []).map((d) => (d?.name || "").trim()).filter(Boolean);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (placeNames.length < 2) return null;

  const criteriaIn = Array.isArray(data.criteria) ? data.criteria : [];
  const criteria = [];
  for (const row of criteriaIn) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.name || "").trim();
    if (!name || !row.scores || typeof row.scores !== "object") continue;
    // ── Enforce only the 5 allowed criteria ──
    const allowedKey = matchesAllowed(name);
    if (!allowedKey) continue;
    // Use the canonical display label
    const displayName = ALLOWED_CRITERIA.find((a) => a === allowedKey) || name;
    // Capitalise first letter of each word for display
    const prettyName = displayName.replace(/\b\w/g, (c) => c.toUpperCase());
    const scores = {};
    Object.entries(row.scores).forEach(([key, value]) => {
      const place = canonPlace(key, placeNames);
      const num = Number(value);
      if (place && Number.isFinite(num)) scores[place] = num;
    });
    if (Object.keys(scores).length < 2) continue;
    const notes = {};
    if (row.notes && typeof row.notes === "object") {
      Object.entries(row.notes).forEach(([key, value]) => {
        const place = canonPlace(key, placeNames);
        if (place && typeof value === "string" && value.trim()) notes[place] = value.trim();
      });
    }
    // Avoid duplicates (same allowedKey already added)
    if (!criteria.find((c) => normCriterion(c.name) === allowedKey)) {
      criteria.push({ name: prettyName, scores, notes });
    }
  }
  // Sort in canonical order
  criteria.sort((a, b) => {
    const ai = ALLOWED_CRITERIA.indexOf(normCriterion(a.name));
    const bi = ALLOWED_CRITERIA.indexOf(normCriterion(b.name));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  if (!criteria.length) return null;

  const overall = {};
  if (data.overall_scores && typeof data.overall_scores === "object") {
    Object.entries(data.overall_scores).forEach(([key, value]) => {
      const place = canonPlace(key, placeNames);
      const num = Number(value);
      if (place && Number.isFinite(num)) overall[place] = num;
    });
  }
  placeNames.forEach((place) => {
    if (overall[place] != null) return;
    const vals = criteria.map((r) => r.scores[place]).filter((v) => Number.isFinite(v));
    if (vals.length) overall[place] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  });

  const maxScore = Math.max(...placeNames.map((n) => overall[n] ?? -1));
  const topScorers = placeNames.filter((n) => (overall[n] ?? -1) === maxScore);
  let winner = canonPlace(data.winner, placeNames);
  if (!winner || !topScorers.includes(winner)) winner = topScorers[0] || placeNames[0];

  const winnerReason = typeof data.winner_reason === "string" ? data.winner_reason.trim() : "";
  if (!winner || !winnerReason) return null;

  const whyRaw = data.why_not_others && typeof data.why_not_others === "object" ? data.why_not_others : {};
  const why_not_others = {};
  placeNames.forEach((place) => {
    if (place === winner) return;
    let note = "";
    Object.entries(whyRaw).forEach(([key, value]) => {
      if (canonPlace(key, placeNames) === place && typeof value === "string") note = value.trim();
    });
    why_not_others[place] = note || `${place} is a strong option, but ${winner} fits this trip better.`;
  });

  return { winner, winner_reason: winnerReason, criteria, overall_scores: Object.fromEntries(placeNames.map((n) => [n, overall[n] ?? 0])), why_not_others };
}

/* ── skeleton ───────────────────────────────────────────────────────────────── */
function SkeletonRows() {
  return (
    <div className="space-y-4 mt-4" aria-hidden="true">
      <div className="skeleton h-28 w-full rounded-2xl" />
      <div className="skeleton h-10 w-1/2 rounded-xl" />
      <div className="skeleton h-64 w-full rounded-2xl" />
    </div>
  );
}

/* ── score chip ─────────────────────────────────────────────────────────────── */
function ScoreChip({ score, note, isWinner, isBest }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 transition-colors"
      style={
        isWinner || isBest
          ? { background: "rgba(74,103,65,0.12)", border: "1px solid rgba(74,103,65,0.25)" }
          : { background: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.3)" }
      }
    >
      <p
        className="text-base font-bold leading-none"
        style={{ color: isWinner || isBest ? "#4A6741" : "#1A2530" }}
      >
        {Number.isFinite(score) ? `${score}/10` : "—"}
      </p>
      {note && (
        <p className="text-xs text-slate-500 mt-1.5 leading-snug">{note}</p>
      )}
    </div>
  );
}

/* ── main modal ─────────────────────────────────────────────────────────────── */
export default function CompareModal({ open, destinations, preferences, onClose, onBuildItinerary }) {
  const [status, setStatus] = useState("loading");
  const [result, setResult] = useState(null);
  const [error, setError]   = useState("");

  const runCompare = useCallback(async () => {
    if (!Array.isArray(destinations) || destinations.length < 2 || destinations.length > 4) {
      setStatus("error"); setError("Select between 2 and 4 places to compare."); return;
    }
    setStatus("loading"); setResult(null); setError("");
    try {
      const { data } = await api.post("/itinerary/compare", {
        preferences,
        destinations: destinations.map((d) => ({ name: d.name, country: d.country || "", why: d.why || "", image_query: d.image_query || "" })),
      });
      const validated = validateCompareResult(data, destinations);
      if (!validated) throw new Error("malformed");
      setResult(validated); setStatus("ready");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" && detail.trim() ? detail : "We couldn't compare those places. Please try again.");
      setStatus("error");
    }
  }, [destinations, preferences]);

  useEffect(() => { if (open) runCompare(); }, [open, runCompare]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const winnerDest = result
    ? destinations.find((d) => (d?.name || "").trim().toLowerCase() === (result.winner || "").trim().toLowerCase()) || destinations[0]
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
      data-testid="compare-modal"
    >
      {/* Centered sheet — grows with content, no scroll trap */}
      <div className="min-h-full flex items-start sm:items-center justify-center sm:py-6 sm:px-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compare-modal-title"
          className="relative w-full sm:max-w-5xl rounded-none sm:rounded-3xl"
          style={{
            background: "rgba(248, 246, 242, 0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-8 pt-6 pb-4"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div>
            <p className="eyebrow text-[#E76F51]">Side by side</p>
            <h2 id="compare-modal-title" className="font-display text-3xl sm:text-4xl mt-1 tracking-tight text-[#1A2530]">
              Compare your shortlist
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/8 transition-colors text-slate-500 mt-1"
            aria-label="Close comparison"
            data-testid="compare-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — no overflow, grows naturally */}
        <div className="px-5 sm:px-8 py-6 space-y-6">

          {status === "loading" && (
            <div data-testid="compare-loading">
              <div className="flex items-center gap-2 text-[#0D5C75]">
                <Sparkles size={16} className="text-[#E76F51] animate-pulse" />
                <p className="text-sm font-semibold">Comparing your places…</p>
              </div>
              <SkeletonRows />
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-10" data-testid="compare-error">
              <p className="font-display text-2xl">We hit a snag</p>
              <p className="text-slate-600 mt-3 max-w-md mx-auto leading-relaxed">{error}</p>
              <button type="button" onClick={runCompare} className="btn-secondary mt-6" data-testid="compare-retry">Retry</button>
            </div>
          )}

          {status === "ready" && result && (
            <div className="space-y-6">

              {/* ── Best pick banner ── */}
              <div
                className="rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{
                  background: "rgba(74,103,65,0.08)",
                  border: "1px solid rgba(74,103,65,0.2)",
                }}
                data-testid="compare-winner"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold tracking-widest uppercase text-[#E76F51] flex items-center gap-1.5">
                    <Sparkles size={12} />
                    Best pick for you
                  </p>
                  <h3 className="font-display text-2xl sm:text-3xl mt-1 tracking-tight text-[#1A2530]">
                    {result.winner}
                  </h3>
                  <p className="text-slate-600 mt-2 leading-relaxed text-sm">{result.winner_reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onBuildItinerary?.(winnerDest)}
                  className="shrink-0 inline-flex items-center gap-2 text-white font-semibold text-sm bg-[#E76F51] hover:bg-[#D45A3E] px-5 py-2.5 rounded-full transition-colors whitespace-nowrap"
                  data-testid="compare-build-itinerary"
                >
                  Build my itinerary for {result.winner}
                  <ArrowRight size={15} />
                </button>
              </div>

              {/* ── Comparison table ── */}
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.35)" }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm border-separate border-spacing-0">

                    {/* Column headers with destination images */}
                    <thead>
                      <tr>
                        {/* Criterion label cell */}
                        <th
                          className="text-left text-[10px] font-bold tracking-widest uppercase text-slate-400 px-4 py-4 w-36"
                          style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                        >
                          Criterion
                        </th>

                        {destinations.map((d) => {
                          const isWinner = (d.name || "").trim().toLowerCase() === (result.winner || "").trim().toLowerCase();
                          return (
                            <th
                              key={d.name}
                              className="px-3 pt-3 pb-4 text-left align-top"
                              style={{
                                borderBottom: "1px solid rgba(0,0,0,0.06)",
                                background: isWinner ? "rgba(74,103,65,0.1)" : "transparent",
                              }}
                            >
                              {/* Destination image */}
                              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-2 max-w-[140px]">
                                <SmartImage
                                  imageQuery={d.image_query || `${d.name} ${d.country || ""}`}
                                  type="destination"
                                  salt={`compare-col-${d.name}`}
                                  alt={d.name}
                                  className="w-full h-full object-cover"
                                />
                                {isWinner && (
                                  <div
                                    className="absolute top-1.5 left-1.5 text-white text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                                    style={{ background: "#4A6741" }}
                                  >
                                    Best pick
                                  </div>
                                )}
                              </div>
                              <div>
                                <p
                                  className="font-semibold text-sm leading-tight"
                                  style={{ color: isWinner ? "#4A6741" : "#1A2530" }}
                                >
                                  {d.name}
                                </p>
                                {d.country && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                                    <MapPin size={9} />
                                    {d.country}
                                  </p>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    {/* Criteria rows */}
                    <tbody>
                      {result.criteria.map((row, ri) => {
                        const values = destinations.map((d) => row.scores[d.name]).filter((v) => Number.isFinite(v));
                        const best   = values.length ? Math.max(...values) : null;
                        const Icon   = criterionIcon(row.name);
                        return (
                          <tr key={row.name} className="align-top">
                            {/* Criterion name */}
                            <td
                              className="px-4 py-4 font-semibold text-slate-700 text-xs"
                              style={{
                                borderTop: ri === 0 ? "none" : "1px solid rgba(0,0,0,0.05)",
                              }}
                            >
                              <div className="flex items-start gap-1.5">
                                <Icon size={13} className="text-[#E76F51] mt-0.5 shrink-0" />
                                <span className="leading-snug">{row.name}</span>
                              </div>
                            </td>

                            {destinations.map((d) => {
                              const score    = row.scores[d.name];
                              const isBest   = Number.isFinite(score) && score === best;
                              const isWinner = (d.name || "").trim().toLowerCase() === (result.winner || "").trim().toLowerCase();
                              return (
                                <td
                                  key={d.name}
                                  className="px-3 py-3"
                                  style={{
                                    borderTop: ri === 0 ? "none" : "1px solid rgba(0,0,0,0.05)",
                                    background: isWinner ? "rgba(74,103,65,0.07)" : "transparent",
                                  }}
                                >
                                  <ScoreChip
                                    score={score}
                                    note={row.notes?.[d.name]}
                                    isBest={isBest}
                                    isWinner={isWinner && isBest}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Why not the others ── */}
              {Object.keys(result.why_not_others).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-[#E76F51]" />
                    <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Why not the others?</p>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Here's why these places didn't make the final pick.</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(result.why_not_others).map(([place, note]) => {
                      const dest = destinations.find((d) => (d?.name || "").trim().toLowerCase() === place.trim().toLowerCase());
                      return (
                        <div
                          key={place}
                          className="rounded-xl p-3 flex items-start gap-3"
                          style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.07)" }}
                        >
                          {/* Thumb */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                            <SmartImage
                              imageQuery={dest?.image_query || `${place} ${dest?.country || ""}`}
                              type="destination"
                              salt={`compare-why-${place}`}
                              alt={place}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-[#1A2530] leading-tight">{place}</p>
                            {dest?.country && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                <MapPin size={8} />{dest.country}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-1 leading-snug">{note}</p>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-[#E76F51]/60 shrink-0 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 sm:px-8 py-3 flex items-center gap-2 text-slate-400 text-xs"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <Scale size={12} />
          Comparing {destinations.length} place{destinations.length !== 1 ? "s" : ""}
        </div>
        </div>{/* end glass card */}
      </div>{/* end centering wrapper */}
    </div>
  );
}
