import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, MapPin, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import AILoadingChecklist from "@/components/AILoadingChecklist";
import SmartImage from "@/components/SmartImage";

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

export default function Suggestions() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, [nav]);

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

  if (!data) return null;

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => nav("/plan")}
          className="btn-ghost flex items-center gap-2"
          data-testid="suggestions-back"
        >
          <ArrowLeft size={16} />
          Change preferences
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-10"
        >
          <p className="eyebrow">Your shortlist</p>
          <h1 className="font-display text-4xl sm:text-6xl mt-2 tracking-tight">
            Four places, one perfect fit.
          </h1>
          <p className="text-slate-600 mt-4 max-w-2xl leading-relaxed">
            Choose the destination that pulls you in. We'll build the full
            day-by-day journey only for the one you pick.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {(data.suggestions || []).map((d, i) => (
            <motion.button
              key={`${d.name}-${i}`}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              onClick={() => choose(d, i)}
              disabled={busy !== null}
              className="tp-card overflow-hidden text-left group disabled:opacity-70 relative"
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
            </motion.button>
          ))}
        </div>
      </div>

      {loading && (
        <AILoadingChecklist steps={LOADING_STEPS} done={false} onDone={() => {}} />
      )}
    </>
  );
}
