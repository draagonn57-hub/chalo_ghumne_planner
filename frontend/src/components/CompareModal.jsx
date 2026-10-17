import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Scale, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";

function canonPlace(name, placeNames) {
  if (!name || typeof name !== "string") return null;
  const raw = name.trim().toLowerCase();
  if (!raw) return null;

  // 1. Direct exact match
  const exact = placeNames.find((n) => n.toLowerCase() === raw);
  if (exact) return exact;

  // 2. Strip parentheses, e.g. "Rishikesh (India)" -> "Rishikesh"
  const strippedParens = raw.replace(/\(.*?\)/g, "").trim();
  if (strippedParens) {
    const parenMatch = placeNames.find((n) => n.toLowerCase() === strippedParens);
    if (parenMatch) return parenMatch;
  }

  // 3. Strip comma, e.g. "Rishikesh, India" -> "Rishikesh"
  const commaPart = raw.split(",")[0].trim();
  if (commaPart) {
    const commaMatch = placeNames.find((n) => n.toLowerCase() === commaPart);
    if (commaMatch) return commaMatch;
  }

  // 4. Substring matching
  const subMatch = placeNames.find(
    (n) => raw.includes(n.toLowerCase()) || n.toLowerCase().includes(raw)
  );
  if (subMatch) return subMatch;

  return null;
}

export function validateCompareResult(data, destinations) {
  const placeNames = (destinations || [])
    .map((d) => (d?.name || "").trim())
    .filter(Boolean);

  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (placeNames.length < 2) return null;

  const criteriaIn = Array.isArray(data.criteria) ? data.criteria : [];
  const criteria = [];

  for (const row of criteriaIn) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.name || "").trim();
    if (!name || !row.scores || typeof row.scores !== "object") continue;

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
        if (place && typeof value === "string" && value.trim()) {
          notes[place] = value.trim();
        }
      });
    }

    criteria.push({ name, scores, notes });
  }

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
    const vals = criteria
      .map((row) => row.scores[place])
      .filter((v) => Number.isFinite(v));
    if (vals.length) {
      overall[place] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
  });

  const maxScore = Math.max(...placeNames.map((n) => overall[n] ?? -1));
  const topScorers = placeNames.filter((n) => (overall[n] ?? -1) === maxScore);

  let winner = canonPlace(data.winner, placeNames);
  if (!winner || !topScorers.includes(winner)) {
    winner = topScorers[0] || placeNames[0];
  }

  const winnerReason = typeof data.winner_reason === "string" ? data.winner_reason.trim() : "";
  if (!winner || !winnerReason) return null;

  const whyRaw = data.why_not_others && typeof data.why_not_others === "object" ? data.why_not_others : {};
  const why_not_others = {};
  placeNames.forEach((place) => {
    if (place === winner) return;
    let note = "";
    Object.entries(whyRaw).forEach(([key, value]) => {
      if (canonPlace(key, placeNames) === place && typeof value === "string") {
        note = value.trim();
      }
    });
    why_not_others[place] =
      note || `${place} is a strong option, but ${winner} fits this trip a little better.`;
  });

  return {
    winner,
    winner_reason: winnerReason,
    criteria,
    overall_scores: Object.fromEntries(placeNames.map((n) => [n, overall[n] ?? 0])),
    why_not_others,
  };
}

function SkeletonRows() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-48 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
    </div>
  );
}

export default function CompareModal({
  open,
  destinations,
  preferences,
  onClose,
  onBuildItinerary,
}) {
  const [status, setStatus] = useState("loading");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const runCompare = useCallback(async () => {
    if (!Array.isArray(destinations) || destinations.length < 2 || destinations.length > 4) {
      setStatus("error");
      setError("Select between 2 and 4 places to compare.");
      return;
    }

    setStatus("loading");
    setResult(null);
    setError("");

    try {
      const { data } = await api.post("/itinerary/compare", {
        preferences,
        destinations: destinations.map((d) => ({
          name: d.name,
          country: d.country || "",
          why: d.why || "",
          image_query: d.image_query || "",
        })),
      });

      const validated = validateCompareResult(data, destinations);
      if (!validated) {
        throw new Error("malformed");
      }
      setResult(validated);
      setStatus("ready");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" && detail.trim()
          ? detail
          : "We couldn't compare those places. Please try again."
      );
      setStatus("error");
    }
  }, [destinations, preferences]);

  useEffect(() => {
    if (!open) return undefined;
    runCompare();
    return undefined;
  }, [open, runCompare]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const winnerDest = result
    ? destinations.find(
        (d) => (d?.name || "").trim().toLowerCase() === (result.winner || "").trim().toLowerCase()
      ) || destinations[0]
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center sm:p-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      data-testid="compare-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        className="tp-card w-full sm:max-w-5xl sm:max-h-[90vh] h-full sm:h-auto overflow-hidden flex flex-col rounded-none sm:rounded-[1.25rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-8 pt-5 sm:pt-7 pb-4 border-b border-slate-100">
          <div>
            <p className="eyebrow">Side by side</p>
            <h2 id="compare-modal-title" className="font-display text-3xl sm:text-4xl mt-1 tracking-tight">
              Compare your shortlist
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="btn-ghost p-2 mt-1"
            aria-label="Close comparison"
            data-testid="compare-modal-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
          {status === "loading" && (
            <div data-testid="compare-loading">
              <div className="flex items-center gap-3 mb-6 text-[#0D5C75]">
                <Sparkles size={18} className="text-[#E76F51] animate-pulse" />
                <p className="font-semibold">Comparing your places…</p>
              </div>
              <SkeletonRows />
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-10" data-testid="compare-error">
              <p className="font-display text-2xl">We hit a snag</p>
              <p className="text-slate-600 mt-3 max-w-md mx-auto leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={runCompare}
                className="btn-secondary mt-6"
                data-testid="compare-retry"
              >
                Retry
              </button>
            </div>
          )}

          {status === "ready" && result && (
            <div className="space-y-8">
              <div
                className="rounded-[1.25rem] border border-[#0D5C75]/15 bg-[#0D5C75]/6 p-5 sm:p-6"
                data-testid="compare-winner"
              >
                <p className="eyebrow text-[#0D5C75]">Best pick for you</p>
                <h3 className="font-display text-3xl mt-2 tracking-tight">
                  Best pick for you: {result.winner}
                </h3>
                <p className="text-slate-600 mt-3 leading-relaxed">{result.winner_reason}</p>
                <button
                  type="button"
                  onClick={() => onBuildItinerary?.(winnerDest)}
                  className="mt-5 inline-flex items-center gap-2 text-white font-semibold text-sm bg-[#0D5C75] px-4 py-2 rounded-full hover:bg-[#0A485C] transition-colors"
                  data-testid="compare-build-itinerary"
                >
                  Build my itinerary for {result.winner}
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[520px] text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="text-left font-semibold text-slate-500 py-3 pr-4 sticky left-0 bg-white">
                        Criterion
                      </th>
                      {destinations.map((d) => {
                        const isWinner =
                          (d.name || "").trim().toLowerCase() === (result.winner || "").trim().toLowerCase();
                        return (
                          <th
                            key={d.name}
                            className={`text-left font-display text-lg font-normal py-3 px-3 ${
                              isWinner ? "text-[#0D5C75] font-semibold" : "text-[#1A2530]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{d.name}</span>
                              {isWinner && (
                                <span className="inline-block text-[11px] font-semibold tracking-normal text-[#0D5C75] bg-[#0D5C75]/10 px-2 py-0.5 rounded-full font-sans">
                                  Winner
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {result.criteria.map((row) => {
                      const values = destinations
                        .map((d) => row.scores[d.name])
                        .filter((v) => Number.isFinite(v));
                      const best = values.length ? Math.max(...values) : null;
                      return (
                        <tr key={row.name} className="align-top">
                          <td className="py-3 pr-4 font-semibold text-slate-700 border-t border-slate-100 sticky left-0 bg-white">
                            {row.name}
                          </td>
                          {destinations.map((d) => {
                            const score = row.scores[d.name];
                            const isBest = Number.isFinite(score) && score === best;
                            return (
                              <td key={d.name} className="py-3 px-3 border-t border-slate-100">
                                <div
                                  className={`rounded-xl px-3 py-2 ${
                                    isBest ? "bg-[#0D5C75]/10 text-[#0D5C75] font-semibold" : "text-slate-600"
                                  }`}
                                >
                                  {Number.isFinite(score) ? (
                                    <span>{score}/10</span>
                                  ) : (
                                    <span>—</span>
                                  )}
                                  {row.notes?.[d.name] && (
                                    <p className="text-xs font-normal text-slate-500 mt-1 leading-snug">
                                      {row.notes[d.name]}
                                    </p>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="py-3 pr-4 font-semibold text-slate-700 border-t border-slate-100 sticky left-0 bg-white">
                        Overall
                      </td>
                      {destinations.map((d) => {
                        const score = result.overall_scores[d.name];
                        const isWinner =
                          (d.name || "").trim().toLowerCase() === (result.winner || "").trim().toLowerCase();
                        return (
                          <td key={d.name} className="py-3 px-3 border-t border-slate-100">
                            <div
                              className={`rounded-xl px-3 py-2 ${
                                isWinner ? "bg-[#0D5C75]/10 text-[#0D5C75] font-semibold" : "text-slate-600"
                              }`}
                            >
                              {Number.isFinite(score) ? `${score}/10` : "—"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {Object.keys(result.why_not_others).length > 0 && (
                <div>
                  <h4 className="font-display text-2xl tracking-tight">Why not the others</h4>
                  <ul className="mt-4 space-y-3">
                    {Object.entries(result.why_not_others).map(([place, note]) => (
                      <li key={place} className="rounded-[1.25rem] border border-slate-100 p-4">
                        <p className="font-semibold text-[#1A2530]">{place}</p>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 sm:px-8 py-4 border-t border-slate-100 flex items-center gap-2 text-slate-500 text-sm">
          <Scale size={14} />
          Comparing {destinations.length} places
        </div>
      </div>
    </div>
  );
}
