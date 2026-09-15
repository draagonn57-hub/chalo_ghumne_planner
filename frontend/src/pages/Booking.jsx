import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import SmartImage from "@/components/SmartImage";
import {
  formatINR, parsePrice, ROOM_TYPES, buildServiceCatalog, calcPricing,
} from "@/lib/bookingUtils";
import {
  Plane, BedDouble, Star, Check, Plus, Minus, ArrowRight, ArrowLeft,
  Car, Shield, MapPin, Landmark, Mountain, Building2, Users, Calendar,
  CreditCard, ChevronRight, Lock,
} from "lucide-react";

const SERVICE_ICONS = { Car, Shield, MapPin, Landmark, Mountain, Building2 };

const STEPS = ["Flight", "Hotel", "Room", "Services", "Travelers", "Review"];

export default function Booking() {
  const nav = useNavigate();
  const { itineraryId } = useParams();
  const [itinDoc, setItinDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);

  // selections
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [roomType, setRoomType] = useState(ROOM_TYPES[0]);
  const [numRooms, setNumRooms] = useState(1);
  const [numNights, setNumNights] = useState(1);
  const [addons, setAddons] = useState([]);
  const [travelers, setTravelers] = useState({
    fullName: "", email: "", phone: "", numTravelers: 1,
    passengers: [{ name: "", dob: "", gender: "" }],
  });

  useEffect(() => {
    // Try sessionStorage first (preview itinerary), then fetch saved
    const raw = sessionStorage.getItem("tp_last_itinerary");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setItinDoc(parsed);
        initFromItinerary(parsed.itinerary || parsed);
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }
    if (itineraryId) {
      api.get(`/itinerary/${itineraryId}`)
        .then((r) => {
          setItinDoc(r.data);
          initFromItinerary(r.data.itinerary);
        })
        .catch(() => {
          toast.error("Could not load itinerary for booking");
          nav("/dashboard");
        })
        .finally(() => setLoading(false));
    } else {
      toast.error("No itinerary found to book");
      nav("/dashboard");
      setLoading(false);
    }
  }, [itineraryId, nav]);

  function initFromItinerary(it) {
    const nights = it.days?.length || 1;
    setNumNights(nights);
    if (it.flights?.length > 0) {
      setSelectedFlight({ ...it.flights[0], _source: "itinerary" });
    }
    if (it.hotels?.length > 0) {
      setSelectedHotel(it.hotels[0]);
    }
  }

  const it = itinDoc?.itinerary || itinDoc;
  const dest = it?.destinations?.[0] || {};
  const preferences = itinDoc?.preferences || {};

  const serviceCatalog = useMemo(() => buildServiceCatalog({ destinations: it?.destinations, preferences }), [it, preferences]);

  const pricing = useMemo(() => {
    const flightPrice = selectedFlight ? parsePrice(selectedFlight.price) : 0;
    const hotelPerNight = selectedHotel ? parsePrice(selectedHotel.price_per_night) : 0;
    return calcPricing({
      flightPrice,
      hotelPerNight,
      roomMultiplier: roomType.multiplier,
      numRooms,
      numNights,
      addons,
    });
  }, [selectedFlight, selectedHotel, roomType, numRooms, numNights, addons]);

  const toggleAddon = (service) => {
    setAddons((prev) => {
      const exists = prev.find((a) => a.id === service.id);
      if (exists) return prev.filter((a) => a.id !== service.id);
      return [...prev, service];
    });
  };

  const updatePassenger = (idx, field, value) => {
    setTravelers((prev) => {
      const passengers = [...prev.passengers];
      passengers[idx] = { ...passengers[idx], [field]: value };
      return { ...prev, passengers };
    });
  };

  const setNumTravelers = (n) => {
    const count = Math.max(1, Math.min(9, n));
    setTravelers((prev) => {
      let passengers = [...prev.passengers];
      while (passengers.length < count) passengers.push({ name: "", dob: "", gender: "" });
      passengers = passengers.slice(0, count);
      return { ...prev, numTravelers: count, passengers };
    });
  };

  const canProceed = () => {
    if (step === 0) return !!selectedFlight;
    if (step === 1) return !!selectedHotel;
    if (step === 2) return !!roomType && numRooms > 0;
    if (step === 3) return true;
    if (step === 4) {
      const t = travelers;
      if (!t.fullName.trim() || !t.email.trim() || !t.phone.trim()) return false;
      return t.passengers.every((p) => p.name.trim() && p.dob.trim());
    }
    return true;
  };

  const goNext = () => {
    if (!canProceed()) {
      toast.error("Please complete the current step before continuing");
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleCheckout();
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else nav(-1);
  };

  const handleCheckout = () => {
    const bookingPayload = {
      itinerary_id: itineraryId || null,
      destination: dest,
      travel_dates: { duration_days: it?.days?.length || 0, origin: preferences.origin || "" },
      duration_days: it?.days?.length || 0,
      origin: preferences.origin || "",
      flight: selectedFlight,
      hotel: selectedHotel,
      room: roomType,
      num_rooms: numRooms,
      num_nights: numNights,
      addons,
      travelers,
      pricing,
      payment_status: "pending",
      transaction_id: "",
      booking_status: "pending",
    };
    sessionStorage.setItem("tp_pending_booking", JSON.stringify(bookingPayload));
    nav("/booking/checkout");
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-10 space-y-4">
        <div className="skeleton h-12 w-1/3" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (!it) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14" data-testid="booking-page">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <button onClick={goBack} className="btn-ghost flex items-center gap-2 mb-4" data-testid="booking-back">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="eyebrow">Booking</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight">
          Book your trip to {dest.name || "your destination"}
        </h1>
        <p className="text-slate-600 mt-3">
          {it.days?.length || 0} days · {dest.country || ""}
        </p>
      </motion.div>

      {/* Step indicator */}
      <div className="mt-8 flex gap-1.5 overflow-x-auto hide-scrollbar">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              i === step ? "bg-[#0D5C75] text-white" : i < step ? "bg-[#0D5C75]/10 text-[#0D5C75] cursor-pointer" : "bg-slate-100 text-slate-400"
            }`}
            data-testid={`booking-step-${i}`}
          >
            {i < step && <Check size={14} />}
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Main content */}
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 && <FlightStep it={it} selected={selectedFlight} onSelect={setSelectedFlight} />}
              {step === 1 && <HotelStep it={it} selected={selectedHotel} onSelect={setSelectedHotel} />}
              {step === 2 && <RoomStep roomType={roomType} setRoomType={setRoomType} numRooms={numRooms} setNumRooms={setNumRooms} numNights={numNights} setNumNights={setNumNights} hotelPerNight={selectedHotel ? parsePrice(selectedHotel.price_per_night) : 0} />}
              {step === 3 && <ServicesStep catalog={serviceCatalog} addons={addons} onToggle={toggleAddon} />}
              {step === 4 && <TravelersStep travelers={travelers} setTravelers={setTravelers} setNumTravelers={setNumTravelers} updatePassenger={updatePassenger} />}
              {step === 5 && <ReviewStep dest={dest} it={it} selectedFlight={selectedFlight} selectedHotel={selectedHotel} roomType={roomType} numRooms={numRooms} numNights={numNights} addons={addons} travelers={travelers} pricing={pricing} onEdit={setStep} />}
            </motion.div>
          </AnimatePresence>

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between">
            <button onClick={goBack} className="btn-ghost flex items-center gap-2" data-testid="booking-prev">
              <ArrowLeft size={16} /> {step === 0 ? "Back to itinerary" : "Previous"}
            </button>
            <button onClick={goNext} disabled={!canProceed()} className="btn-primary flex items-center gap-2 disabled:opacity-50" data-testid="booking-next">
              {step === STEPS.length - 1 ? (
                <>Proceed to Payment <CreditCard size={18} /></>
              ) : (
                <>Continue <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </div>

        {/* Sticky summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingSummary
            selectedFlight={selectedFlight}
            selectedHotel={selectedHotel}
            roomType={roomType}
            numRooms={numRooms}
            numNights={numNights}
            addons={addons}
            pricing={pricing}
            onCheckout={handleCheckout}
            canCheckout={!!selectedFlight && !!selectedHotel}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Flight Step ── */
function FlightStep({ it, selected, onSelect }) {
  const flights = it.flights || [];
  const fallbackFlights = [
    { airline: "SkyJet Airways", from: "Delhi (DEL)", to: "Destination", duration: "2h 15m", stops: "Non-stop", price: "₹8,500", _source: "demo" },
    { airline: "Air Vista", from: "Mumbai (BOM)", to: "Destination", duration: "3h 10m", stops: "1 stop", price: "₹6,200", _source: "demo" },
  ];
  const list = flights.length > 0 ? flights : fallbackFlights;

  return (
    <div>
      <p className="eyebrow">Step 1</p>
      <h2 className="font-display text-3xl mt-2">Choose your flight</h2>
      <p className="text-slate-500 mt-2 text-sm">
        {flights.length > 0 ? "Flights from your itinerary." : "Demo flight options — your itinerary didn't include specific flights."}
      </p>
      <div className="mt-6 space-y-4">
        {list.map((f, i) => {
          const isSel = selected?.airline === f.airline && selected?.from === f.from;
          return (
            <motion.button
              key={i}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelect(f)}
              className={`tp-card p-5 w-full text-left flex items-center gap-4 transition-all ${isSel ? "ring-2 ring-[#E76F51] border-[#E76F51]" : ""}`}
              data-testid={`flight-option-${i}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isSel ? "bg-[#E76F51] text-white" : "bg-[#0D5C75]/10 text-[#0D5C75]"}`}>
                <Plane size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg">{f.airline}</div>
                <div className="text-sm text-slate-500">{f.from} → {f.to}</div>
                <div className="text-xs text-slate-400 mt-0.5">{f.duration} · {f.stops}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[#0D5C75] font-bold text-lg">{f.price}</div>
                {f._source === "demo" && <div className="text-xs text-slate-400">Demo</div>}
              </div>
              {isSel && <div className="w-7 h-7 rounded-full bg-[#E76F51] text-white flex items-center justify-center shrink-0"><Check size={16} /></div>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Hotel Step ── */
function HotelStep({ it, selected, onSelect }) {
  const hotels = it.hotels || [];
  if (hotels.length === 0) {
    return (
      <div>
        <p className="eyebrow">Step 2</p>
        <h2 className="font-display text-3xl mt-2">Choose your hotel</h2>
        <p className="text-slate-500 mt-4">No hotels in this itinerary. Please generate a new itinerary with hotels.</p>
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow">Step 2</p>
      <h2 className="font-display text-3xl mt-2">Choose your hotel</h2>
      <p className="text-slate-500 mt-2 text-sm">From your itinerary's suggested stays.</p>
      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {hotels.map((h, i) => {
          const isSel = selected?.name === h.name;
          return (
            <motion.button
              key={i}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(h)}
              className={`tp-card overflow-hidden text-left transition-all ${isSel ? "ring-2 ring-[#E76F51] border-[#E76F51]" : ""}`}
              data-testid={`hotel-option-${i}`}
            >
              <div className="aspect-[4/3] overflow-hidden relative">
                <SmartImage
                  directUrl={h.image}
                  imageQuery={h.image_query || `${h.name} hotel`}
                  salt={`booking-hotel-${i}`}
                  alt={h.name}
                  className="w-full h-full object-cover"
                />
                {isSel && (
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#E76F51] text-white flex items-center justify-center">
                    <Check size={16} />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="font-display text-xl">{h.name}</div>
                  <div className="flex items-center gap-1 text-sm text-[#E76F51] font-semibold">
                    <Star size={14} className="fill-[#E76F51]" />{h.rating}
                  </div>
                </div>
                <div className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                  <BedDouble size={14} /> {h.location}
                </div>
                <div className="text-[#0D5C75] font-semibold mt-2">{h.price_per_night}<span className="text-slate-400 text-xs font-normal"> /night</span></div>
                {h.amenities?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {h.amenities.slice(0, 4).map((a, ai) => (
                      <span key={ai} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{a}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Room Step ── */
function RoomStep({ roomType, setRoomType, numRooms, setNumRooms, numNights, setNumNights, hotelPerNight }) {
  return (
    <div>
      <p className="eyebrow">Step 3</p>
      <h2 className="font-display text-3xl mt-2">Pick your room</h2>
      <p className="text-slate-500 mt-2 text-sm">Room type affects your total price.</p>
      <div className="mt-6 space-y-4">
        {ROOM_TYPES.map((r) => {
          const isSel = roomType.id === r.id;
          const basePrice = hotelPerNight * r.multiplier;
          return (
            <motion.button
              key={r.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setRoomType(r)}
              className={`tp-card p-5 w-full text-left flex items-start gap-4 transition-all ${isSel ? "ring-2 ring-[#E76F51] border-[#E76F51]" : ""}`}
              data-testid={`room-option-${r.id}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSel ? "bg-[#E76F51] text-white" : "bg-[#0D5C75]/10 text-[#0D5C75]"}`}>
                <BedDouble size={20} />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl">{r.label}</div>
                <div className="text-sm text-slate-500 mt-1">{r.desc}</div>
                <div className="text-xs text-slate-400 mt-1">Sleeps {r.occupancy} · {r.multiplier}× base price</div>
              </div>
              <div className="text-right shrink-0">
                {hotelPerNight > 0 && <div className="text-[#0D5C75] font-bold">{formatINR(basePrice)}<span className="text-slate-400 text-xs font-normal"> /night</span></div>}
                {isSel && <div className="mt-1 inline-flex items-center gap-1 text-xs text-[#E76F51] font-semibold"><Check size={12} /> Selected</div>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Rooms & nights counters */}
      <div className="tp-card p-6 mt-6 grid sm:grid-cols-2 gap-6">
        <div>
          <label className="eyebrow">Number of rooms</label>
          <div className="mt-3 flex items-center gap-4">
            <button onClick={() => setNumRooms(Math.max(1, numRooms - 1))} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" data-testid="rooms-dec">
              <Minus size={18} />
            </button>
            <span className="font-display text-2xl w-8 text-center">{numRooms}</span>
            <button onClick={() => setNumRooms(Math.min(5, numRooms + 1))} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" data-testid="rooms-inc">
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div>
          <label className="eyebrow">Number of nights</label>
          <div className="mt-3 flex items-center gap-4">
            <button onClick={() => setNumNights(Math.max(1, numNights - 1))} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" data-testid="nights-dec">
              <Minus size={18} />
            </button>
            <span className="font-display text-2xl w-8 text-center">{numNights}</span>
            <button onClick={() => setNumNights(Math.min(30, numNights + 1))} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors" data-testid="nights-inc">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Services Step ── */
function ServicesStep({ catalog, addons, onToggle }) {
  return (
    <div>
      <p className="eyebrow">Step 4</p>
      <h2 className="font-display text-3xl mt-2">Recommended before you go</h2>
      <p className="text-slate-500 mt-2 text-sm">Add optional services to enhance your trip. Toggle any on or off.</p>
      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {catalog.map((s) => {
          const isAdded = addons.some((a) => a.id === s.id);
          const Icon = SERVICE_ICONS[s.icon] || MapPin;
          return (
            <motion.div
              key={s.id}
              layout
              whileHover={{ y: -2 }}
              className={`tp-card p-5 transition-all ${isAdded ? "ring-2 ring-[#0D5C75] border-[#0D5C75]" : ""}`}
              data-testid={`service-${s.id}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isAdded ? "bg-[#0D5C75] text-white" : "bg-[#0D5C75]/10 text-[#0D5C75]"}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-slate-500 mt-1">{s.desc}</div>
                  <div className="text-[#0D5C75] font-semibold mt-2">{formatINR(s.price)}</div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onToggle(s)}
                className={`mt-4 w-full py-2 rounded-full text-sm font-semibold transition-colors ${isAdded ? "bg-[#E76F51]/10 text-[#E76F51] hover:bg-[#E76F51]/20" : "bg-[#0D5C75] text-white hover:bg-[#0A485C]"}`}
                data-testid={`service-toggle-${s.id}`}
              >
                {isAdded ? "− Remove" : "+ Add"}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Travelers Step ── */
function TravelersStep({ travelers, setTravelers, setNumTravelers, updatePassenger }) {
  const errors = validateTravelers(travelers);
  return (
    <div>
      <p className="eyebrow">Step 5</p>
      <h2 className="font-display text-3xl mt-2">Traveler details</h2>
      <p className="text-slate-500 mt-2 text-sm">We need this for your booking confirmation.</p>

      <div className="tp-card p-6 mt-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" value={travelers.fullName} onChange={(v) => setTravelers({ ...travelers, fullName: v })} testId="traveler-name" error={errors.fullName} />
          <Field label="Email" type="email" value={travelers.email} onChange={(v) => setTravelers({ ...travelers, email: v })} testId="traveler-email" error={errors.email} />
          <Field label="Phone" value={travelers.phone} onChange={(v) => setTravelers({ ...travelers, phone: v })} testId="traveler-phone" error={errors.phone} />
          <div>
            <label className="eyebrow">Number of travelers</label>
            <div className="mt-3 flex items-center gap-4">
              <button onClick={() => setNumTravelers(travelers.numTravelers - 1)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center" data-testid="travelers-dec"><Minus size={18} /></button>
              <span className="font-display text-2xl w-8 text-center">{travelers.numTravelers}</span>
              <button onClick={() => setNumTravelers(travelers.numTravelers + 1)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center" data-testid="travelers-inc"><Plus size={18} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Passengers */}
      <div className="mt-6 space-y-4">
        <h3 className="font-display text-2xl">Passenger details</h3>
        {travelers.passengers.map((p, idx) => (
          <div key={idx} className="tp-card p-5">
            <div className="eyebrow mb-4">Passenger {idx + 1}</div>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Full name" value={p.name} onChange={(v) => updatePassenger(idx, "name", v)} testId={`passenger-name-${idx}`} error={errors.passengers?.[idx]?.name} />
              <Field label="Date of birth" type="date" value={p.dob} onChange={(v) => updatePassenger(idx, "dob", v)} testId={`passenger-dob-${idx}`} error={errors.passengers?.[idx]?.dob} />
              <div>
                <label className="eyebrow">Gender</label>
                <select
                  value={p.gender}
                  onChange={(e) => updatePassenger(idx, "gender", e.target.value)}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none"
                  data-testid={`passenger-gender-${idx}`}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function validateTravelers(t) {
  const errors = {};
  if (!t.fullName.trim()) errors.fullName = "Full name is required";
  if (!t.email.trim()) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) errors.email = "Enter a valid email";
  if (!t.phone.trim()) errors.phone = "Phone is required";
  const passengerErrors = t.passengers.map((p) => {
    const pe = {};
    if (!p.name.trim()) pe.name = "Name is required";
    if (!p.dob.trim()) pe.dob = "Date of birth is required";
    return pe;
  });
  return { ...errors, passengers: passengerErrors };
}

function Field({ label, value, onChange, type = "text", testId, error }) {
  return (
    <div>
      <label className="eyebrow">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full px-4 py-3 rounded-xl border bg-white focus:outline-none transition-colors ${error ? "border-[#E76F51]" : "border-slate-200 focus:border-[#E76F51]"}`}
        data-testid={testId}
      />
      {error && <div className="text-xs text-[#E76F51] mt-1">{error}</div>}
    </div>
  );
}

/* ── Review Step ── */
function ReviewStep({ dest, it, selectedFlight, selectedHotel, roomType, numRooms, numNights, addons, travelers, pricing, onEdit }) {
  return (
    <div>
      <p className="eyebrow">Step 6</p>
      <h2 className="font-display text-3xl mt-2">Review your booking</h2>
      <p className="text-slate-500 mt-2 text-sm">Check everything before proceeding to payment.</p>

      <div className="mt-6 space-y-4">
        <ReviewCard title="Trip" onEdit={() => onEdit(0)}>
          <Row label="Destination" value={`${dest.name || "—"}, ${dest.country || ""}`} />
          <Row label="Duration" value={`${it?.days?.length || 0} days`} />
          <Row label="Origin" value={it?.preferences?.origin || "—"} />
        </ReviewCard>

        <ReviewCard title="Flight" onEdit={() => onEdit(0)}>
          <Row label="Airline" value={selectedFlight?.airline || "—"} />
          <Row label="Route" value={selectedFlight ? `${selectedFlight.from} → ${selectedFlight.to}` : "—"} />
          <Row label="Price" value={selectedFlight?.price || "—"} />
        </ReviewCard>

        <ReviewCard title="Hotel & Room" onEdit={() => onEdit(1)}>
          <Row label="Hotel" value={selectedHotel?.name || "—"} />
          <Row label="Room" value={roomType?.label || "—"} />
          <Row label="Rooms" value={numRooms} />
          <Row label="Nights" value={numNights} />
        </ReviewCard>

        <ReviewCard title="Services" onEdit={() => onEdit(3)}>
          {addons.length > 0 ? addons.map((a) => <Row key={a.id} label={a.name} value={formatINR(a.price)} />) : <Row label="No add-ons selected" value="" />}
        </ReviewCard>

        <ReviewCard title="Travelers" onEdit={() => onEdit(4)}>
          <Row label="Contact" value={travelers.fullName} />
          <Row label="Email" value={travelers.email} />
          <Row label="Passengers" value={travelers.numTravelers} />
        </ReviewCard>

        <ReviewCard title="Price Breakdown">
          <Row label="Flight" value={formatINR(pricing.flight)} />
          <Row label={`Hotel (${numRooms} room${numRooms > 1 ? "s" : ""} × ${numNights} night${numNights > 1 ? "s" : ""})`} value={formatINR(pricing.hotelTotal)} />
          <Row label="Add-ons" value={formatINR(pricing.addonsTotal)} />
          <Row label="Subtotal" value={formatINR(pricing.subtotal)} />
          <Row label="Taxes & fees (12%)" value={formatINR(pricing.taxes)} />
          <Row label="Discount (5%)" value={`− ${formatINR(pricing.discount)}`} />
          <div className="border-t border-slate-100 mt-3 pt-3">
            <Row label="Grand Total" value={formatINR(pricing.grandTotal)} bold />
          </div>
        </ReviewCard>
      </div>
    </div>
  );
}

function ReviewCard({ title, onEdit, children }) {
  return (
    <div className="tp-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl">{title}</h3>
        {onEdit && <button onClick={onEdit} className="text-sm text-[#E76F51] font-semibold hover:underline" data-testid={`review-edit-${title.toLowerCase()}`}>Edit</button>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? "font-bold text-base" : ""}`}>
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "text-[#0D5C75]" : "text-slate-800"}>{value}</span>
    </div>
  );
}

/* ── Booking Summary (sticky sidebar) ── */
function BookingSummary({ selectedFlight, selectedHotel, roomType, numRooms, numNights, addons, pricing, onCheckout, canCheckout }) {
  return (
    <div className="tp-card p-6" data-testid="booking-summary">
      <h3 className="font-display text-2xl">Booking Summary</h3>
      <div className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Flight</span>
          <span className="font-medium">{selectedFlight ? selectedFlight.price : "Not selected"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Hotel</span>
          <span className="font-medium truncate max-w-[180px]">{selectedHotel ? selectedHotel.name : "Not selected"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Room</span>
          <span className="font-medium">{roomType?.label || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Rooms × Nights</span>
          <span className="font-medium">{numRooms} × {numNights}</span>
        </div>
        {addons.length > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Add-ons ({addons.length})</span>
            <span className="font-medium">{formatINR(pricing.addonsTotal)}</span>
          </div>
        )}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatINR(pricing.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Taxes</span><span>{formatINR(pricing.taxes)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-[#E76F51]">− {formatINR(pricing.discount)}</span></div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="font-display text-lg">Total</span>
            <span className="font-display text-2xl text-[#0D5C75]">{formatINR(pricing.grandTotal)}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onCheckout}
        disabled={!canCheckout}
        className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
        data-testid="summary-checkout"
      >
        <Lock size={16} /> Continue to Checkout
      </button>
      {!canCheckout && <p className="text-xs text-slate-400 text-center mt-2">Select a flight and hotel to continue</p>}
    </div>
  );
}
