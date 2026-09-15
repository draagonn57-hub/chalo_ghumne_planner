import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Sparkles,
  Users,
  Wallet,
  Clock,
  Plane,
  BedDouble,
  CreditCard,
} from "lucide-react";
import { api } from "@/lib/api";
import SmartImage from "@/components/SmartImage";
import { formatINR } from "@/lib/bookingUtils";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: i * 0.08,
      ease: [0.2, 0.9, 0.3, 1],
    },
  }),
};

const statusColor = {
  confirmed: "bg-[#0D5C75]/10 text-[#0D5C75]",
  upcoming: "bg-[#E76F51]/10 text-[#E76F51]",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
  pending: "bg-amber-100 text-amber-700",
};

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function Dashboard() {
  const [trips, setTrips] = useState(null);
  const [bookings, setBookings] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    let mounted = true;

    api
      .get("/itinerary/mine")
      .then((r) => {
        if (mounted) {
          setTrips(Array.isArray(r.data) ? r.data : []);
        }
      })
      .catch(() => {
        if (mounted) setTrips([]);
      });

    api
      .get("/bookings")
      .then((r) => {
        if (mounted) {
          setBookings(Array.isArray(r.data) ? r.data : []);
        }
      })
      .catch(() => {
        if (mounted) setBookings([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="eyebrow">Your travel journal</p>
          <h1 className="font-display text-4xl sm:text-6xl mt-2 tracking-tight">
            Saved trips
          </h1>
        </div>

        <button
          onClick={() => nav("/plan")}
          className="btn-primary flex items-center gap-2"
          data-testid="new-trip-btn"
        >
          New trip
        </button>
      </motion.div>

      {trips === null ? (
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-72 rounded-[1.25rem]" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mt-14 tp-card p-12 text-center"
          data-testid="empty-trips"
        >
          <div className="w-16 h-16 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center mx-auto">
            <Sparkles size={26} />
          </div>

          <h3 className="font-display text-3xl mt-6">
            Nothing planned yet
          </h3>

          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            Answer a quick questionnaire and we&apos;ll craft your first
            itinerary.
          </p>

          <button onClick={() => nav("/plan")} className="btn-primary mt-6">
            Plan my first trip
          </button>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          {trips.map((t, i) => {
            const dest = t.itinerary?.destinations?.[0];
            const destinations = t.itinerary?.destinations || [];
            const dayCount = t.itinerary?.days?.length || 0;

            return (
              <motion.div
                key={t.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <Link
                  to={`/itinerary/${t.id}`}
                  className="tp-card overflow-hidden block group"
                  data-testid={`trip-card-${t.id}`}
                >
                  <div className="aspect-[16/10] overflow-hidden relative">
                    <SmartImage
                      directUrl={dest?.image}
                      imageQuery={
                        dest?.image_query ||
                        dest?.name ||
                        t.title ||
                        "travel destination"
                      }
                      salt={`trip-${t.id}`}
                      alt={dest?.name || t.title || "Travel destination"}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                    <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2 text-white">
                      <MapPin size={14} />
                      <span className="text-sm font-medium drop-shadow">
                        {dest?.name || t.title || "Trip"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="eyebrow">
                      {formatDate(t.created_at)}
                    </div>

                    <h3 className="font-display text-2xl mt-2 group-hover:text-[#E76F51] transition-colors">
                      {t.title || "Untitled trip"}
                    </h3>

                    {destinations.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {destinations.slice(0, 3).map((d, di) => (
                          <span
                            key={d.id || `${d.name}-${di}`}
                            className="text-xs px-2 py-1 rounded-full bg-[#0D5C75]/8 text-[#0D5C75] inline-flex items-center gap-1"
                          >
                            <MapPin size={10} />
                            {d.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex items-center gap-4 text-sm text-slate-500 border-t border-slate-100 pt-4">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} />
                        {dayCount} {dayCount === 1 ? "day" : "days"}
                      </span>

                      {t.preferences?.companions && (
                        <span className="inline-flex items-center gap-1">
                          <Users size={14} />
                          {t.preferences.companions}
                        </span>
                      )}

                      {t.preferences?.budget && (
                        <span className="inline-flex items-center gap-1 capitalize">
                          <Wallet size={14} />
                          {t.preferences.budget}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* My Bookings */}
      {bookings !== null && bookings.length > 0 && (
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center">
              <CreditCard size={20} />
            </div>

            <div>
              <p className="eyebrow">Your bookings</p>
              <h2 className="font-display text-3xl mt-1">My Bookings</h2>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookings.map((b, i) => {
              const dest = b.destination || {};
              const bookingId = b.booking_id || b.id;
              const bookingStatus = b.booking_status || "confirmed";

              return (
                <motion.div
                  key={bookingId}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Link
                    to={`/bookings/${bookingId}`}
                    className="tp-card overflow-hidden block group"
                    data-testid={`booking-card-${bookingId}`}
                  >
                    <div className="aspect-[16/10] overflow-hidden relative">
                      <SmartImage
                        directUrl={dest.image}
                        imageQuery={
                          dest.image_query || dest.name || "travel destination"
                        }
                        salt={`booking-${bookingId}`}
                        alt={dest.name || "Booked destination"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                            statusColor[bookingStatus] || statusColor.confirmed
                          }`}
                        >
                          {bookingStatus}
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2 text-white">
                        <MapPin size={14} />
                        <span className="text-sm font-medium drop-shadow">
                          {dest.name || "Trip"}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="eyebrow font-mono">
                        {bookingId || "BOOKING"}
                      </div>

                      <h3 className="font-display text-xl mt-2 group-hover:text-[#E76F51] transition-colors">
                        {dest.name || "Your trip"}
                      </h3>

                      <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                        {b.hotel?.name && (
                          <div className="flex items-center gap-1.5">
                            <BedDouble size={14} />
                            <span className="truncate">{b.hotel.name}</span>
                          </div>
                        )}

                        {b.flight?.airline && (
                          <div className="flex items-center gap-1.5">
                            <Plane size={14} />
                            <span className="truncate">
                              {b.flight.airline}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          {b.duration_days || 0}{" "}
                          {Number(b.duration_days) === 1 ? "day" : "days"}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs text-slate-400">
                          {formatDate(b.created_at)}
                        </span>

                        <span className="font-display text-lg text-[#0D5C75]">
                          {formatINR(b.pricing?.grandTotal || 0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}