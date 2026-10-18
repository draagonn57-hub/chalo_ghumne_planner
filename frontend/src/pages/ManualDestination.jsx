import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, MapPin, Navigation, Search, Sparkles, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AILoadingChecklist from "@/components/AILoadingChecklist";
import CityAutocompleteInput from "@/components/CityAutocompleteInput";
import { getBudgetEstimates, BUDGET_OPTIONS } from "@/lib/budgetUtils";

const LOADING_STEPS = [
  "Locking in your destination",
  "Building the day-by-day plan",
  "Selecting hotels",
  "Finding flights & transport",
  "Polishing the details",
];

const DURATION_MIN = 1;
const DURATION_MAX = 21;


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
  const [origin, setOrigin] = useState("");
  const [originError, setOriginError] = useState("");
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

  const validate = () => {
    if (!origin.trim()) {
      setOriginError("Please enter your starting city");
      return false;
    }
    const normalise = (s) => s.trim().toLowerCase().replace(/,.*$/, "").trim();
    if (normalise(origin) === normalise(query)) {
      setOriginError("Origin and destination cannot be the same city");
      return false;
    }
    setOriginError("");
    return true;
  };

  const generate = async () => {
    if (!canSubmit) return;
    if (!validate()) return;
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
        origin: origin.trim(),
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

        {/* Single white card containing EVERYTHING */}
        <div className="tp-card p-8 sm:p-10">

          {/* Back button */}
          <button
            onClick={() => nav("/plan")}
            className="btn-ghost flex items-center gap-2"
            data-testid="manual-back"
          >
            <ArrowLeft size={16} />
            Choose another mode
          </button>

          {/* Header */}
          <div className="mt-8">
            <p className="eyebrow">Your destination, your way</p>
            <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight">
              Where do you want to go?
            </h1>
            <p className="text-slate-600 mt-4 max-w-xl leading-relaxed">
              Tell us the place and a few preferences. We'll craft a full
              day-by-day itinerary around your choice.
            </p>
          </div>

          {/* Divider */}
          <div className="mt-8 h-px bg-slate-100" />

          {/* Form fields */}
          <div className="mt-8 space-y-8">

            {/* Origin input — "Starting from" */}
            <CityAutocompleteInput
              id="manual-origin"
              label="Starting from"
              labelIcon={<Navigation size={12} />}
              value={origin}
              onChange={(val) => {
                setOrigin(val);
                if (originError) setOriginError("");
              }}
              placeholder="Enter your city (e.g. Ahmedabad)"
              inputIcon={<Search size={18} />}
              error={originError}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && generate()}
              testId="manual-origin-input"
              disabled={busy}
            />

            {/* Destination input */}
            <CityAutocompleteInput
              id="manual-destination"
              label="Destination"
              labelIcon={<MapPin size={12} />}
              value={query}
              onChange={(val) => setQuery(val)}
              placeholder="e.g. Tokyo, Paris, Manali…"
              inputIcon={<Search size={18} />}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && generate()}
              testId="manual-destination-input"
              disabled={busy}
            />

            {/* Trip length — slider, matches Questionnaire "How many days?" step exactly */}
            <div>
              <label
                htmlFor="manual-duration"
                className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 block"
              >
                Trip length
              </label>
              <div className="p-2">
                <div className="flex items-baseline gap-3">
                  <motion.span
                    key={duration}
                    initial={{ scale: 0.9, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="font-display text-6xl"
                  >
                    {duration}
                  </motion.span>
                  <span className="text-slate-500">
                    {duration === 1 ? "day" : "days"}
                  </span>
                </div>
                <input
                  id="manual-duration"
                  type="range"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full mt-6 accent-[#E76F51]"
                  data-testid="manual-duration-slider"
                  aria-label="Trip length in days"
                  aria-valuemin={DURATION_MIN}
                  aria-valuemax={DURATION_MAX}
                  aria-valuenow={duration}
                  aria-valuetext={`${duration} ${duration === 1 ? "day" : "days"}`}
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>{DURATION_MIN}</span>
                  <span>{DURATION_MAX}</span>
                </div>
              </div>
            </div>

            {/* Budget — full width, 3 cards side by side on sm+ */}
            <div>
              <div
                role="group"
                aria-labelledby="manual-budget-label"
                className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3"
                id="manual-budget-label"
              >
                Budget
              </div>
              {(() => {
                const estimates = getBudgetEstimates(duration);
                return (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {BUDGET_OPTIONS.map((b) => (
                      <BudgetChoice
                        key={b.v}
                        option={b}
                        estimate={estimates[b.v]}
                        selected={budget === b.v}
                        onClick={() => setBudget(b.v)}
                        testId={`manual-budget-${b.v}`}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Companions — full width row below budget */}
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">Companions</div>
              <div className="flex flex-wrap gap-2">
                {COMPANION_OPTIONS.map((c) => (
                  <button
                    key={c.v}
                    onClick={() => setCompanions(c.v)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      companions === c.v ? "bg-[#E76F51] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    data-testid={`manual-companions-${c.v}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interests */}
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
                      interests.includes(opt.v) ? "bg-[#0D5C75] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    data-testid={`manual-interest-${opt.v}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
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

          </div>
        </div>
      </div>

      {loading && (
        <AILoadingChecklist steps={LOADING_STEPS} done={false} onDone={() => {}} />
      )}
    </>
  );
}

/**
 * Budget card — identical look to the BudgetChoice used in Questionnaire.
 * Shows label, subtitle, and a dynamic cost estimate for the selected duration.
 */
function BudgetChoice({ option, estimate, selected, onClick, testId }) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      data-testid={testId}
      className={`choice-card text-left relative w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51] focus-visible:ring-offset-2 ${selected ? "selected" : ""}`}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#E76F51] text-white flex items-center justify-center"
        >
          <Check size={12} strokeWidth={3} />
        </motion.div>
      )}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        selected ? "bg-[#E76F51] text-white" : "bg-[#0D5C75]/10 text-[#0D5C75]"
      }`}>
        <Icon size={20} />
      </div>
      <div className="font-display text-xl mt-3">{option.label}</div>
      <div className="text-slate-500 text-sm mt-0.5">{option.desc}</div>
      {estimate && (
        <div className={`mt-2.5 text-xs font-semibold px-2 py-1 rounded-lg inline-block transition-colors ${
          selected ? "bg-[#E76F51]/15 text-[#E76F51]" : "bg-slate-100 text-slate-500"
        }`}>
          ~{estimate}
        </div>
      )}
    </button>
  );
}
