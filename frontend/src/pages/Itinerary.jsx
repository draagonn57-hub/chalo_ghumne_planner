import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import SmartImage from "@/components/SmartImage";

import {
  Save,
  Star,
  Utensils,
  Sunrise,
  Sun,
  Moon,
  MapPin,
  BedDouble,
  Plane,
  Printer,
  Pencil,
  Trash2,
  MessageSquare,
  Compass,
  Calendar,
  Building2,
  Landmark,
  Lightbulb,
  CreditCard,
  Map as MapIcon,
  CloudRain,
  CloudSun,
  Cloud,
  Sun as SunIcon,
  Snowflake,
  CloudLightning,
  Droplets,
  Thermometer,
  AlertTriangle,
  RefreshCw,
  Wind,
} from "lucide-react";
import ItineraryMap from "@/components/ItineraryMap";
import {
  fetchWeatherForDate,
  getWeatherAdvisory,
  isDisruptiveWeather,
} from "@/lib/weatherService";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Compass },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "daily", label: "Daily Plan", icon: Calendar },
  { id: "hotels", label: "Hotels", icon: Building2 },
  { id: "flights", label: "Flights", icon: Plane },
  { id: "landmarks", label: "Landmarks", icon: Landmark },
  { id: "tips", label: "Tips", icon: Lightbulb },
];

const TRANS_ICON = {
  flight: Plane,
  train: Plane,
  car: Plane,
  bus: Plane,
};

export function ItineraryPreview() {
  const nav = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("tp_last_itinerary");

    if (!raw) {
      nav("/plan");
      return;
    }

    try {
      setData(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem("tp_last_itinerary");
      nav("/plan");
    }
  }, [nav]);

  const save = async () => {
    if (!data) return;

    try {
      const { data: saved } = await api.post("/itinerary/save", {
        preferences: data.preferences,
        itinerary: data.itinerary,
        title: data.itinerary?.title,
      });

      toast.success("Trip saved to your account");

      sessionStorage.removeItem("tp_last_itinerary");

      nav(`/itinerary/${saved.id}`);
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || "Save failed"
      );
    }
  };

  if (!data) return null;

  return (
    <ItineraryView
      it={data.itinerary}
      startDate={data.preferences?.start_date || ""}
      onSave={save}
      onBook={() => nav("/booking")}
      onBackToSuggestions={() =>
        nav("/itinerary/suggestions")
      }
    />
  );
}

export function ItineraryDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .get(`/itinerary/${id}`)
      .then((r) => setDoc(r.data))
      .catch(() => nav("/dashboard"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  const onSwap = async (dayIndex, slot, activity, reason) => {
    try {
      const { data } = await api.patch(
        `/itinerary/${id}/activity`,
        {
          day_index: dayIndex,
          slot,
          activity,
          landmark: "",
          reason: reason || "",
        }
      );

      setDoc(data);
      toast.success("Activity updated");
      return data;
    } catch {
      toast.error("Failed to update");
      throw new Error("swap failed");
    }
  };

  const onUpdateDay = async (dayIndex, dayData) => {
    try {
      const { data } = await api.patch(
        `/itinerary/${id}/day`,
        {
          day_index: dayIndex,
          day: dayData,
        }
      );

      setDoc(data);
      toast.success("Day updated");
      return data;
    } catch {
      toast.error("Failed to update day");
      throw new Error("day update failed");
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this trip?")) return;

    try {
      await api.delete(`/itinerary/${id}`);

      toast.success("Deleted");
      nav("/dashboard");
    } catch {
      toast.error("Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-10 space-y-4">
        <div className="skeleton h-12 w-1/2" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (!doc) return null;

  return (
    <ItineraryView
      it={doc.itinerary}
      startDate={doc.preferences?.start_date || ""}
      savedId={id}
      onSwap={onSwap}
      onDelete={onDelete}
      onUpdateDay={onUpdateDay}
      onBook={() => nav(`/booking/itinerary/${id}`)}
    />
  );
}

function ItineraryView({
  it,
  onSave,
  savedId,
  onSwap,
  onDelete,
  onBackToSuggestions,
  onBook,
  startDate,
  onUpdateDay,
}) {
  const [openDay, setOpenDay] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const sectionRefs = useRef({});

  if (!it) return null;

  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === "overview") return true;
    if (s.id === "map") return true;
    if (s.id === "daily") return it.days?.length > 0;
    if (s.id === "hotels") return it.hotels?.length > 0;
    if (s.id === "flights") return it.flights?.length > 0 || it.transport?.length > 0;
    if (s.id === "landmarks") return it.landmarks?.length > 0;
    if (s.id === "tips") return it.tips?.length > 0;
    return false;
  });

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <div
      className="max-w-6xl mx-auto px-6 py-10 sm:py-14"
      data-testid="itinerary-view"
>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="eyebrow">Your journey</p>

          <h1
            className="font-display text-4xl sm:text-6xl mt-2 tracking-tight"
            data-testid="itinerary-title"
          >
            {it.title}
          </h1>

          <p className="text-slate-600 mt-4 leading-relaxed">
            {it.summary}
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            {it.destinations?.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0D5C75]/8 text-[#0D5C75] text-sm"
              >
                <MapPin size={14} />
                {d.name}, {d.country}
              </span>
            ))}

            {it.estimated_total_cost && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E76F51]/10 text-[#E76F51] text-sm font-semibold">
                {it.estimated_total_cost}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex gap-2 flex-wrap">
          {onBackToSuggestions && (
            <button
              onClick={onBackToSuggestions}
              className="btn-ghost flex items-center gap-2"
              data-testid="itinerary-back-suggestions"
            >
              ← Pick another
            </button>
          )}

          {onSave && (
            <button
              onClick={onSave}
              className="btn-primary flex items-center gap-2"
              data-testid="itinerary-save"
            >
              <Save size={16} />
              Save trip
            </button>
          )}

          {onBook && (
            <button
              onClick={onBook}
              className="btn-primary flex items-center gap-2 bg-[#E76F51] hover:bg-[#D45A3E]"
              data-testid="itinerary-book-now"
            >
              <CreditCard size={16} />
              Book Now
            </button>
          )}

          <button
            onClick={() => downloadPdf(it)}
            className="btn-secondary flex items-center gap-2"
            data-testid="itinerary-download"
          >
            Download itinerary
          </button>

          {savedId && (
            <button
              onClick={() => window.print()}
              className="btn-ghost flex items-center gap-2"
              data-testid="itinerary-print"
            >
              <Printer size={16} />
              Print
            </button>
          )}

          {savedId && (
            <button
              onClick={onDelete}
              className="btn-ghost text-[#E76F51] flex items-center gap-2"
              data-testid="itinerary-delete"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      </div>
      {/* Sticky section nav */}
      <div className="sticky top-20 z-30 mt-8 -mx-6 px-6 py-3 bg-[#FDFBF7]/90 backdrop-blur-md border-y border-slate-100">
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {visibleSections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? "bg-[#0D5C75] text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
                data-testid={`section-nav-${s.id}`}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Destinations gallery */}
      {it.destinations?.length > 0 && (
        <section
          ref={(el) => (sectionRefs.current.overview = el)}
          className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6 scroll-mt-32"
        >
          {it.destinations.map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="tp-card overflow-hidden"
              data-testid={`itinerary-dest-${i}`}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <SmartImage
  imageQuery={
    d.image_query ||
    `${d.name} ${d.country}`
  }
                  type="destination"
                  salt={`itinerary-dest-${i}`}
                  alt={d.name}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>

              <div className="p-5">
                <div className="font-display text-2xl">
                  {d.name}
                </div>

                <div className="text-slate-500 text-sm">
                  {d.country}
                </div>

                <p className="text-sm text-slate-600 mt-3">
                  {d.why}
                </p>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {/* Interactive map */}
      <section
        ref={(el) => (sectionRefs.current.map = el)}
        className="mt-14 scroll-mt-32"
        data-testid="itinerary-map-section"
      >
        <p className="eyebrow">Explore your route</p>

        <h2 className="font-display text-3xl sm:text-4xl mt-2">
          Trip map
        </h2>

        <p className="text-slate-500 mt-2 text-sm max-w-2xl">
          All your destinations, hotels, and daily stops plotted on an
          interactive map. Filter by day to see your route, or view the
          full trip at once.
        </p>

        <div className="mt-6">
          <ItineraryMap itinerary={it} />
        </div>
      </section>

      {/* Day-by-day timeline */}
      <section
        ref={(el) => (sectionRefs.current.daily = el)}
        className="mt-14 scroll-mt-32"
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Day-by-day</p>

            <h2 className="font-display text-3xl sm:text-4xl mt-2">
              Your daily rhythm
            </h2>
          </div>
        </div>

        <div className="mt-8 relative">
          <div className="absolute left-5 top-2 bottom-2 w-0.5 timeline-line" />

          <div className="space-y-4">
            {(it.days || []).map((day, idx) => (
              <DayCard
                key={idx}
                day={day}
                index={idx}
                open={openDay === idx}
                onToggle={() =>
                  setOpenDay(
                    openDay === idx ? -1 : idx
                  )
                }
                onSwap={onSwap}
                canEdit={!!onSwap}
                startDate={startDate}
                primaryDestination={it.destinations?.[0]?.name || ""}
                onUpdateDay={onUpdateDay}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Hotels */}
      {it.hotels?.length > 0 && (
        <section
          ref={(el) => (sectionRefs.current.hotels = el)}
          className="mt-14 scroll-mt-32"
        >
          <p className="eyebrow">Where to rest</p>

          <h2 className="font-display text-3xl sm:text-4xl mt-2">
            Suggested stays
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {it.hotels.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="tp-card overflow-hidden"
                data-testid={`itinerary-hotel-${i}`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <SmartImage
  imageQuery={
    h.image_query ||
    `${h.name} ${h.location}`
  }
  type="hotel"
  salt={`itinerary-hotel-${i}`}
  alt={`${h.name} hotel`}
  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
/>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="font-display text-xl">
                      {h.name}
                    </div>

                    <div className="flex items-center gap-1 text-sm text-[#E76F51] font-semibold">
                      <Star
                        size={14}
                        className="fill-[#E76F51]"
                      />
                      {h.rating}
                    </div>
                  </div>

                  <div className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                    <BedDouble size={14} />
                    {h.location}
                  </div>

                  <div className="text-[#0D5C75] font-semibold mt-2">
                    {h.price_per_night}
                  </div>

                  {h.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {h.amenities.map((a, ai) => (
                        <span key={ai} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Flights & Transport combined */}
      {(it.flights?.length > 0 || it.transport?.length > 0) && (
        <section
          ref={(el) => (sectionRefs.current.flights = el)}
          className="mt-14 scroll-mt-32"
        >
          <p className="eyebrow">Estimated options</p>

          <h2 className="font-display text-3xl sm:text-4xl mt-2">
            Flights & transport
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            {it.flights?.map((f, i) => (
              <motion.div
                key={`flight-${i}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="tp-card p-5 flex items-center gap-4"
                data-testid={`itinerary-flight-${i}`}
              >
                <div className="w-12 h-12 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center shrink-0">
                  <Plane size={22} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg truncate">
                    {f.airline} · {f.from} → {f.to}
                  </div>

                  <div className="text-sm text-slate-500">
                    {f.duration} · {f.stops} · Estimated
                  </div>
                </div>

                <div className="text-[#0D5C75] font-semibold shrink-0">
                  {f.price}
                </div>
              </motion.div>
            ))}

            {it.transport?.map((t, i) => {
              const Icon = TRANS_ICON[t.mode] || Plane;
              return (
                <motion.div
                  key={`transport-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="tp-card p-5 flex items-center gap-4"
                  data-testid={`itinerary-transport-${i}`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center shrink-0">
                    <Icon size={22} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg capitalize">
                      {t.mode} · {t.from} → {t.to}
                    </div>

                    <div className="text-sm text-slate-500">
                      {t.provider} · {t.duration}
                    </div>
                  </div>

                  <div className="text-[#0D5C75] font-semibold shrink-0">
                    {t.price}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Landmarks */}
      {it.landmarks?.length > 0 && (
        <section
          ref={(el) => (sectionRefs.current.landmarks = el)}
          className="mt-14 scroll-mt-32"
        >
          <p className="eyebrow">Not to miss</p>

          <h2 className="font-display text-3xl sm:text-4xl mt-2">
            Famous landmarks
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {it.landmarks.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="tp-card overflow-hidden"
                data-testid={`itinerary-landmark-${i}`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <SmartImage
  imageQuery={
    l.image_query ||
    `${l.name} ${l.location}`
  }
  type="landmark"
  salt={`itinerary-landmark-${i}`}
  alt={l.name}
  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
/>
                </div>

                <div className="p-5">
                  <div className="font-display text-xl">
                    {l.name}
                  </div>

                  <div className="text-slate-500 text-sm">
                    {l.location}
                  </div>

                  <p className="text-sm text-slate-600 mt-2">
                    {l.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Tips */}
      {it.tips?.length > 0 && (
  <section
    ref={(el) => (sectionRefs.current.tips = el)}
    className="mt-14 scroll-mt-32"
  >
    <div className="p-8 !bg-[#0D5C75] !text-white rounded-2xl shadow-lg">

      <p className="text-[#F2B48A] text-xs uppercase tracking-[0.2em] font-bold">
        Insider tips
      </p>

      <h2 className="font-display text-3xl mt-2 !text-white font-semibold">
        Before you go
      </h2>

      <div className="mt-6 space-y-4">
        {it.tips.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-4 bg-white/10 rounded-xl px-4 py-3 border border-white/10"
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#F2B48A] text-[#0D5C75] flex items-center justify-center font-bold text-sm">
              {i + 1}
            </span>

            <p className="!text-white text-[15px] leading-7 font-medium">
              {tip}
            </p>
          </div>
        ))}
      </div>

    </div>
  </section>
)}

      {savedId && (
        <FeedbackBlock itineraryId={savedId} />
      )}

      {/* Sticky mobile action bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 py-3 flex gap-2 justify-around shadow-lg">
        {onBackToSuggestions && (
          <button onClick={onBackToSuggestions} className="btn-ghost text-sm flex items-center gap-1" data-testid="itinerary-back-suggestions-mobile">
            ← Back
          </button>
        )}
        {onSave && (
          <button onClick={onSave} className="btn-primary text-sm flex items-center gap-1" data-testid="itinerary-save-mobile">
            <Save size={14} /> Save
          </button>
        )}
        {onBook && (
          <button onClick={onBook} className="btn-primary text-sm flex items-center gap-1 bg-[#E76F51] hover:bg-[#D45A3E]" data-testid="itinerary-book-now-mobile">
            <CreditCard size={14} /> Book
          </button>
        )}
        <button onClick={() => downloadPdf(it)} className="btn-secondary text-sm" data-testid="itinerary-download-mobile">
          PDF
        </button>
        {savedId && (
          <button onClick={onDelete} className="btn-ghost text-[#E76F51] text-sm flex items-center gap-1" data-testid="itinerary-delete-mobile">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function WeatherIcon({ type, size = 16 }) {
  switch (type) {
    case "sun":
      return <SunIcon size={size} />;
    case "partly-cloudy":
      return <CloudSun size={size} />;
    case "cloudy":
      return <Cloud size={size} />;
    case "fog":
      return <Cloud size={size} />;
    case "rain":
      return <CloudRain size={size} />;
    case "snow":
      return <Snowflake size={size} />;
    case "storm":
      return <CloudLightning size={size} />;
    default:
      return <Cloud size={size} />;
  }
}

function DayCard({
  day,
  index,
  open,
  onToggle,
  onSwap,
  canEdit,
  startDate,
  primaryDestination,
  onUpdateDay,
}) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const dayDate = useMemo(() => {
    if (!startDate) return null;
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + index);
    return d;
  }, [startDate, index]);

  const dateLabel = useMemo(() => {
    if (!dayDate) return null;
    return dayDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [dayDate]);

  const outOfRange = useMemo(() => {
    if (!dayDate) return false;
    const today = new Date(new Date().toDateString());
    const target = new Date(dayDate);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
    return diff < 0 || diff > 16;
  }, [dayDate]);

useEffect(() => {
  if (!open || !dayDate) {
    return;
  }

  const locationQuery =
    day.location ||
    primaryDestination ||
    "";

  if (!locationQuery.trim()) {
    return;
  }

  if (outOfRange) {
    setWeather({ error: "OUT_OF_RANGE" });
    setWeatherLoaded(true);
    return;
  }

  if (weatherLoaded) {
    return;
  }

  let cancelled = false;

  async function loadWeather() {
    setWeatherLoading(true);

    try {
      let result = await fetchWeatherForDate(
        locationQuery,
        dayDate
      );

      // If the day-specific location failed to geocode, fall back to the primary destination
      if (result?.error === "NO_LOCATION" && primaryDestination && primaryDestination !== locationQuery) {
        result = await fetchWeatherForDate(
          primaryDestination,
          dayDate
        );
      }

      if (!cancelled) {
        setWeather(result);
        setWeatherLoaded(true);
      }
    } catch (error) {
      if (!cancelled) {
        setWeather({ error: "FETCH_FAILED" });
        setWeatherLoaded(true);
      }
    } finally {
      if (!cancelled) {
        setWeatherLoading(false);
      }
    }
  }

  loadWeather();

  return () => {
    cancelled = true;
  };
}, [
  open,
  dayDate,
  outOfRange,
  weatherLoaded,
  day.location,
  primaryDestination,
]);

  const submitSwap = () => {
    if (!editing || !draft.trim()) return;
    onSwap(index, editing, draft);
    setEditing(null);
    setDraft("");
  };

  const advisories = weather ? getWeatherAdvisory(weather) : null;
  const disruptive = weather && isDisruptiveWeather(weather);

  const handleAdjustDay = async () => {
    if (!onSwap) return;
    setAdjusting(true);

    const reason = "Weather disruption expected; prefer suitable indoor or weather-safe activities.";
    const slots = ["morning", "afternoon", "evening"];

    for (const slot of slots) {
      const currentActivity = day[slot]?.activity || "";
      if (!currentActivity) continue;

      try {
        await onSwap(index, slot, currentActivity, reason);
      } catch {
        // Continue even if one slot fails
      }
    }

    setAdjusting(false);
    setShowAdjust(false);
  };

  return (
    <div
      className="relative pl-14"
      data-testid={`day-${index}`}
    >
      <div className="absolute left-3.5 top-6 w-4 h-4 rounded-full bg-[#E76F51] ring-4 ring-[#FDFBF7]" />

      <div className="tp-card overflow-hidden">
        <button
          onClick={onToggle}
          className="w-full text-left p-6 flex items-center justify-between hover:bg-slate-50/50"
          data-testid={`day-toggle-${index}`}
        >
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span>Day {day.day}</span>
              {dateLabel && (
                <span className="text-slate-400 font-normal normal-case tracking-normal">
                  · {dateLabel}
                </span>
              )}
            </div>

            <div className="font-display text-2xl mt-1">
              {day.title}
            </div>

            {day.location && (
              <div className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                <MapPin size={14} />
                {day.location}
              </div>
            )}
          </div>

          <div className="text-[#E76F51] font-semibold">
            {open ? "–" : "+"}
          </div>
        </button>

        <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
          <div className="px-6 pb-6 grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
            {/* Weather forecast */}
            {weatherLoading && (
              <div className="md:col-span-2 flex items-center gap-2 text-sm text-slate-400">
                <RefreshCw size={14} className="animate-spin" />
                Checking weather forecast…
              </div>
            )}

            {!weatherLoading && weatherLoaded && weather?.error === "OUT_OF_RANGE" && (
              <div className="md:col-span-2 rounded-xl p-3 bg-slate-50 border border-slate-200 flex items-center gap-2 text-sm text-slate-500">
                <Calendar size={14} className="shrink-0" />
                Weather forecast is available only for dates within the next 16 days.
              </div>
            )}

            {!weatherLoading && weatherLoaded && weather?.error === "NO_LOCATION" && (
              <div className="md:col-span-2 rounded-xl p-3 bg-slate-50 border border-slate-200 flex items-center gap-2 text-sm text-slate-500">
                <MapPin size={14} className="shrink-0" />
                Weather forecast unavailable — destination location not found.
              </div>
            )}

            {!weatherLoading && weatherLoaded && (weather?.error === "FETCH_FAILED" || weather?.error === "NO_DATA") && (
              <div className="md:col-span-2 rounded-xl p-3 bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle size={14} className="shrink-0" />
                Weather data could not be loaded. Please try again.
              </div>
            )}

            {!weatherLoading && weatherLoaded && !weather?.error && weather && (
              <div className="md:col-span-2 space-y-3">
                <div
                  className="rounded-2xl border border-sky-100 bg-sky-50 p-4"
                  data-testid={`weather-summary-${index}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white text-sky-600 flex items-center justify-center">
                      <WeatherIcon
                        type={weather.iconType}
                        size={22}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800">
                        Weather forecast
                      </div>

                      <div className="text-sm text-slate-600">
                        {weather.label || "Forecast available"}
                      </div>
                    </div>

                    {weather.tempMax != null &&
                      weather.tempMin != null && (
                        <div className="text-right">
                          <div className="text-xl font-semibold text-slate-800">
                            {Math.round(weather.tempMax)}°C
                          </div>

                          <div className="text-xs text-slate-500">
                            Low {Math.round(weather.tempMin)}°C
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {weather.precipitationProbability != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-slate-600">
                        <Droplets size={13} />
                        Rain chance: {weather.precipitationProbability}%
                      </span>
                    )}

                    {weather.windMax != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-slate-600">
                        <Wind size={13} />
                        Wind: {Math.round(weather.windMax)} km/h
                      </span>
                    )}
                  </div>
                </div>

                {advisories?.map((adv, ai) => (
                  <div
                    key={ai}
                    className="rounded-xl p-4 flex items-start gap-3 bg-amber-50 border border-amber-200"
                    data-testid={`weather-advisory-${index}-${ai}`}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center">
                      <AlertTriangle size={15} />
                    </div>

                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-800">
                        {adv.title} on Day {day.day}
                      </div>

                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                        {adv.message}
                      </p>
                    </div>
                  </div>
                ))}

                {canEdit && disruptive && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">
                      The forecast may affect outdoor activities.
                      You can ask the AI to replace them with indoor
                      or weather-safe alternatives.
                    </p>

                    {!showAdjust ? (
                      <button
                        onClick={() => setShowAdjust(true)}
                        disabled={adjusting}
                        className="text-sm font-medium px-4 py-2 rounded-full bg-[#E76F51] text-white hover:bg-[#D45A3E] disabled:opacity-50"
                        data-testid={`adjust-day-btn-${index}`}
                      >
                        Adjust this day
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600">
                          This will request weather-safe alternatives
                          for the morning, afternoon, and evening
                          activities.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleAdjustDay}
                            disabled={adjusting}
                            className="text-sm font-medium px-4 py-2 rounded-full bg-[#0D5C75] text-white hover:bg-[#0A4A5E] disabled:opacity-50 flex items-center gap-2"
                            data-testid={`adjust-confirm-${index}`}
                          >
                            {adjusting && (
                              <RefreshCw
                                size={14}
                                className="animate-spin"
                              />
                            )}

                            {adjusting
                              ? "Adjusting activities…"
                              : "Confirm adjustment"}
                          </button>

                          <button
                            onClick={() => setShowAdjust(false)}
                            disabled={adjusting}
                            className="text-sm px-4 py-2 rounded-full border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Adjust This button */}
            {canEdit && (
              <div className="md:col-span-2 flex justify-end">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-sm font-medium px-4 py-2 rounded-full border border-[#0D5C75]/20 text-[#0D5C75] hover:bg-[#0D5C75]/5 transition-colors flex items-center gap-2"
                  data-testid={`adjust-this-btn-${index}`}
                >
                  <Pencil size={14} />
                  Adjust This
                </button>
              </div>
            )}

            {showEditModal && (
              <AdjustDayModal
                day={day}
                index={index}
                onClose={() => setShowEditModal(false)}
                onSave={onUpdateDay}
              />
            )}

            <div className="space-y-4">
              {[
                ["morning", Sunrise],
                ["afternoon", Sun],
                ["evening", Moon],
              ].map(([slot, Icon]) => (
                <div
                  key={slot}
                  className="flex gap-3"
                  data-testid={`slot-${index}-${slot}`}
                >
                  <div className="w-9 h-9 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center shrink-0">
                    <Icon size={16} />
                  </div>

                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                      {slot}
                    </div>

                    {editing === slot ? (
                      <div className="mt-1 flex gap-2">
                        <input
                          value={draft}
                          onChange={(e) =>
                            setDraft(e.target.value)
                          }
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200"
                          data-testid={`swap-input-${index}-${slot}`}
                        />

                        <button
                          onClick={submitSwap}
                          className="btn-primary text-sm py-2"
                          data-testid={`swap-save-${index}-${slot}`}
                        >
                          Save
                        </button>

                        <button
                          onClick={() => {
                            setEditing(null);
                            setDraft("");
                          }}
                          className="btn-ghost text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="text-slate-700 flex-1">
                          {day[slot]?.activity}
                        </p>

                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditing(slot);
                              setDraft(
                                day[slot]?.activity || ""
                              );
                            }}
                            className="text-slate-400 hover:text-[#E76F51] transition-colors"
                            data-testid={`swap-btn-${index}-${slot}`}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    )}

                    {day[slot]?.landmark && (
                      <div className="text-xs text-[#E76F51] mt-1">
                        📍 {day[slot].landmark}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="tp-card p-5 bg-[#FDFBF7] border-slate-100 shadow-none">
              <div className="flex items-center gap-2 text-[#E76F51] font-semibold">
                <Utensils size={16} />
                Food today
              </div>

              <div className="mt-3 space-y-3 text-sm">
                {[
                  "breakfast",
                  "lunch",
                  "dinner",
                ].map((m) => (
                  <div key={m}>
                    <div className="eyebrow text-slate-500">
                      {m}
                    </div>

                    <div className="text-slate-700 mt-0.5">
                      {day.food?.[m] || "—"}
                    </div>
                  </div>
                ))}
              </div>

             <SmartImage
  imageQuery={
    day.food?.image_query ||
    day.food?.lunch ||
    day.food?.dinner ||
    day.food?.breakfast ||
    `${day.location || "local"} food`
  }
  type="food"
  salt={`food-${index}`}
  alt={`Local food in ${day.location || "destination"}`}
  className="mt-4 rounded-xl aspect-[16/9] object-cover"
/>
            </div>
          </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FeedbackBlock({ itineraryId }) {
  const [items, setItems] = useState([]);
  const [avg, setAvg] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = () => {
    api
      .get(
        `/feedback?target_type=itinerary&target_id=${itineraryId}`
      )
      .then((r) => {
        setItems(r.data.items || []);
        setAvg(r.data.average);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [itineraryId]);

  const submit = async (e) => {
    e.preventDefault();

    try {
      await api.post("/feedback", {
        target_type: "itinerary",
        target_id: itineraryId,
        rating,
        comment,
      });

      toast.success("Thanks for the feedback");

      setComment("");

      load();
    } catch {
      toast.error("Failed to submit");
    }
  };

  return (
    <section
      className="mt-14"
      data-testid="feedback-section"
    >
      <p className="eyebrow">Traveler notes</p>

      <div className="flex items-center gap-3 mt-2">
        <h2 className="font-display text-3xl sm:text-4xl">
          Feedback
        </h2>

        {avg && (
          <span className="inline-flex items-center gap-1 text-[#E76F51] font-semibold">
            <Star
              size={16}
              className="fill-[#E76F51]"
            />
            {avg} ({items.length})
          </span>
        )}
      </div>

      <form
        onSubmit={submit}
        className="tp-card p-6 mt-6 space-y-4"
        data-testid="feedback-form"
      >
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(n)}
              data-testid={`rating-${n}`}
            >
              <Star
                size={24}
                className={
                  n <= rating
                    ? "fill-[#E76F51] text-[#E76F51]"
                    : "text-slate-300"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) =>
            setComment(e.target.value)
          }
          placeholder="Share your thoughts…"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none"
          data-testid="feedback-comment"
        />

        <button
          className="btn-primary flex items-center gap-2"
          data-testid="feedback-submit"
        >
          <MessageSquare size={16} />
          Submit feedback
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {items.map((f) => (
          <div
            key={f.id}
            className="tp-card p-5"
            data-testid={`feedback-item-${f.id}`}
          >
            <div className="flex items-center gap-2">
              <div className="font-semibold">
                {f.user_name}
              </div>

              <div className="flex text-[#E76F51]">
                {Array.from({
                  length: f.rating,
                }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className="fill-[#E76F51]"
                  />
                ))}
              </div>
            </div>

            {f.comment && (
              <p className="text-slate-600 mt-2">
                {f.comment}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function downloadPdf(it) {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const margin = 42;
  const width = 510;
  let y = 54;

  const add = (
    text,
    size = 10,
    gap = 16,
    bold = false
  ) => {
    doc.setFont(
      "helvetica",
      bold ? "bold" : "normal"
    );

    doc.setFontSize(size);

    const lines = doc.splitTextToSize(
      String(text || ""),
      width
    );

    if (
      y + lines.length * (size + 3) >
      790
    ) {
      doc.addPage();
      y = 54;
    }

    doc.text(lines, margin, y);

    y +=
      lines.length * (size + 3) +
      gap;
  };

  doc.setTextColor(13, 92, 117);

  add(
    it.title || "Your Voyage",
    24,
    10,
    true
  );

  doc.setTextColor(35, 45, 52);

  add(it.summary, 11, 12);

  add(
    `Estimated total: ${
      it.estimated_total_cost || "See plan"
    }`,
    11,
    18,
    true
  );

  add(
    "DESTINATIONS",
    13,
    7,
    true
  );

  (it.destinations || []).forEach(
    (d) => {
      add(
        `${d.name}, ${d.country} — ${d.why}`,
        10,
        8
      );
    }
  );

  add(
    "DAY-BY-DAY PLAN",
    13,
    7,
    true
  );

  (it.days || []).forEach((day) => {
    add(
      `Day ${day.day}: ${day.title} (${
        day.location || ""
      })`,
      11,
      4,
      true
    );

    [
      "morning",
      "afternoon",
      "evening",
    ].forEach((slot) => {
      add(
        `${slot}: ${
          day[slot]?.activity || "—"
        }${
          day[slot]?.landmark
            ? ` · ${day[slot].landmark}`
            : ""
        }`,
        10,
        3
      );
    });

    add(
      `Food: breakfast — ${
        day.food?.breakfast || "—"
      }; lunch — ${
        day.food?.lunch || "—"
      }; dinner — ${
        day.food?.dinner || "—"
      }`,
      10,
      8
    );
  });

  add(
    "HOTELS",
    13,
    7,
    true
  );

  (it.hotels || []).forEach((h) => {
    add(
      `${h.name} · ${h.location} · ${
        h.price_per_night
      } · ${h.rating}/5 · ${(
        h.amenities || []
      ).join(", ")}`,
      10,
      6
    );
  });

  if (it.flights?.length > 0) {
    add(
      "FLIGHTS (ESTIMATED)",
      13,
      7,
      true
    );

    (it.flights || []).forEach((f) => {
      add(
        `${f.airline}: ${f.from} → ${
          f.to
        } · ${f.price} · ${
          f.duration
        } · ${f.stops}`,
        10,
        6
      );
    });
  }

  if (it.transport?.length > 0) {
    add(
      "TRANSPORT",
      13,
      7,
      true
    );

    (it.transport || []).forEach((t) => {
      add(
        `${t.mode}: ${t.from} → ${
          t.to
        } · ${t.price} · ${
          t.duration
        } · ${t.provider || ""}`,
        10,
        6
      );
    });
  }

  add(
    "LANDMARKS",
    13,
    7,
    true
  );

  (it.landmarks || []).forEach((l) => {
    add(
      `${l.name} — ${
        l.location
      }: ${l.description}`,
      10,
      6
    );
  });

  add(
    "TIPS",
    13,
    7,
    true
  );

  (it.tips || []).forEach((tip) => {
    add(`• ${tip}`, 10, 6);
  });

  const filename = (
    it.title || "voyage-itinerary"
  )
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();

  doc.save(`${filename}.pdf`);
}

function AdjustDayModal({ day, index, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: day.title || "",
    location: day.location || "",
    morning_activity: day.morning?.activity || "",
    morning_landmark: day.morning?.landmark || "",
    afternoon_activity: day.afternoon?.activity || "",
    afternoon_landmark: day.afternoon?.landmark || "",
    evening_activity: day.evening?.activity || "",
    evening_landmark: day.evening?.landmark || "",
    breakfast: day.food?.breakfast || "",
    lunch: day.food?.lunch || "",
    dinner: day.food?.dinner || "",
    notes: day.notes || "",
  }));

  const [saving, setSaving] = useState(false);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);

    const dayData = {
      title: form.title,
      location: form.location,
      morning: {
        activity: form.morning_activity,
        landmark: form.morning_landmark,
      },
      afternoon: {
        activity: form.afternoon_activity,
        landmark: form.afternoon_landmark,
      },
      evening: {
        activity: form.evening_activity,
        landmark: form.evening_landmark,
      },
      food: {
        breakfast: form.breakfast,
        lunch: form.lunch,
        dinner: form.dinner,
        image_query: day.food?.image_query || "",
      },
      notes: form.notes,
    };

    try {
      await onSave(index, dayData);
      onClose();
    } catch {
      // toast handled by caller
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#0D5C75] focus:ring-1 focus:ring-[#0D5C75]/20";
  const labelClass =
    "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      data-testid={`adjust-modal-${index}`}
    >
      <div
        className="bg-[#FDFBF7] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#FDFBF7] border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <p className="eyebrow">Edit day {day.day}</p>
            <h3 className="font-display text-xl mt-0.5">
              Adjust this day
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            data-testid={`adjust-modal-close-${index}`}
          >
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Day title</label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                className={inputClass}
                data-testid={`adjust-title-${index}`}
              />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                className={inputClass}
                data-testid={`adjust-location-${index}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-700">
              Activities
            </p>

            {[
              { slot: "morning", icon: Sunrise },
              { slot: "afternoon", icon: Sun },
              { slot: "evening", icon: Moon },
            ].map(({ slot, icon: Icon }) => (
              <div
                key={slot}
                className="rounded-xl border border-slate-100 p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 capitalize">
                  <Icon size={14} />
                  {slot}
                </div>

                <div>
                  <label className={labelClass}>Activity</label>
                  <input
                    value={form[`${slot}_activity`]}
                    onChange={(e) =>
                      update(`${slot}_activity`, e.target.value)
                    }
                    className={inputClass}
                    data-testid={`adjust-${slot}-activity-${index}`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Landmark</label>
                  <input
                    value={form[`${slot}_landmark`]}
                    onChange={(e) =>
                      update(`${slot}_landmark`, e.target.value)
                    }
                    className={inputClass}
                    data-testid={`adjust-${slot}-landmark-${index}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-700">
              Food preferences
            </p>

            <div className="grid sm:grid-cols-3 gap-3">
              {["breakfast", "lunch", "dinner"].map((meal) => (
                <div key={meal}>
                  <label className={labelClass}>{meal}</label>
                  <input
                    value={form[meal]}
                    onChange={(e) =>
                      update(meal, e.target.value)
                    }
                    className={inputClass}
                    data-testid={`adjust-${meal}-${index}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Travel notes / requirements
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Any special requirements, accessibility needs, or preferences for this day"
              data-testid={`adjust-notes-${index}`}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#FDFBF7] border-t border-slate-100 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-full border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-medium px-5 py-2 rounded-full bg-[#0D5C75] text-white hover:bg-[#0A4A5E] disabled:opacity-50 flex items-center gap-2"
            data-testid={`adjust-save-${index}`}
          >
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {saving ? "Saving\u2026" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
