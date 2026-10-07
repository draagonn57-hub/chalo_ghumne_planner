import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Search, Sparkles, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AILoadingChecklist from "@/components/AILoadingChecklist";

const LOADING_STEPS = [
  "Locking in your destination",
  "Building the day-by-day plan",
  "Selecting hotels",
  "Finding flights & transport",
  "Polishing the details",
];

const DURATION_OPTIONS = [3, 5, 7, 10, 14];

const BUDGET_OPTIONS = [
  { v: "budget", label: "Backpacker" },
  { v: "mid-range", label: "Balanced" },
  { v: "luxury", label: "Luxury" },
];

const COMPANION_OPTIONS = [
  { v: "solo", label: "Solo" },
  { v: "couple", label: "Couple" },
  { v: "family", label: "Family" },
  { v: "friends", label: "Friends" },
];

const INTEREST_OPTIONS = [
  { v: "nature", label: "Nature" },
  { v: "adventure", label: "Adventure" },
  { v: "culture", label: "Culture" },
  { v: "nightlife", label: "Nightlife" },
  { v: "relaxation", label: "Relaxation" },
  { v: "food", label: "Food" },
];

export default function ManualDestination() {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState(5);
  const [budget, setBudget] = useState("mid-range");
  const [companions, setCompanions] = useState("couple");
  const [interests, setInterests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (val) => {
    setInterests((prev) =>
      prev.includes(val) ? prev.filter((i) => i !== val) : [...prev, val]
    );
  };

  const canSubmit = query.trim().length >= 2;

  const generate = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setLoading(true);
    try {
      const { data: detail } = await api.post("/itinerary/generate-for-place", {
        place_name: query.trim(),
        budget,
        duration_days: duration,
        interests,
        companions,
        diet: "non-veg",
        origin: "",
      });

      sessionStorage.setItem("tp_last_itinerary", JSON.stringify(detail));
      nav("/itinerary/preview");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "AI could not build that itinerary");
      setLoading(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="max-w-3xl mx-auto px-6 py-10 sm:py-16" data-testid="manual-destination">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => nav("/plan")}
          className="btn-ghost flex items-center gap-2"
          data-testid="manual-back"
        >
          <ArrowLeft size={16} />
          Choose another mode
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-10"
        >
          <p className="eyebrow">Your destination, your way</p>
          <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight">
            Where do you want to go?
          </h1>
          <p className="text-slate-600 mt-4 max-w-xl leading-relaxed">
            Tell us the place and a few preferences. We'll craft a full
            day-by-day itinerary around your choice.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="tp-card p-8 mt-8 space-y-8"
        >
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
              <MapPin size={12} />
              Destination
            </label>
            <div className="relative mt-2">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Tokyo, Paris, Manali…"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none transition-colors"
                data-testid="manual-destination-input"
                onKeyDown={(e) => e.key === "Enter" && canSubmit && generate()}
              />
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Trip length
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    duration === d
                      ? "bg-[#0D5C75] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-testid={`manual-duration-${d}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
                Budget
              </div>
              <div className="flex flex-wrap gap-2">
                {BUDGET_OPTIONS.map((b) => (
                  <button
                    key={b.v}
                    onClick={() => setBudget(b.v)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      budget === b.v
                        ? "bg-[#E76F51] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    data-testid={`manual-budget-${b.v}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
                Companions
              </div>
              <div className="flex flex-wrap gap-2">
                {COMPANION_OPTIONS.map((c) => (
                  <button
                    key={c.v}
                    onClick={() => setCompanions(c.v)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      companions === c.v
                        ? "bg-[#E76F51] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    data-testid={`manual-companions-${c.v}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Interests (optional)
            </div>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => toggleInterest(opt.v)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    interests.includes(opt.v)
                      ? "bg-[#0D5C75] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-testid={`manual-interest-${opt.v}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={generate}
              disabled={!canSubmit || busy}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              data-testid="manual-generate"
            >
              <Sparkles size={18} />
              {busy ? "Building your trip…" : "Generate itinerary"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </div>
        </motion.div>
      </div>

      {loading && (
        <AILoadingChecklist steps={LOADING_STEPS} done={false} onDone={() => {}} />
      )}
    </>
  );
}
