import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { formatINR } from "@/lib/bookingUtils";
import { CircleCheck as CheckCircle2, Download, Hop as Home, Calendar, Plane, BedDouble, Users, MapPin, ArrowRight, Sparkles } from "lucide-react";

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("tp_last_booking");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.booking_id === bookingId || !bookingId) {
          setBooking(parsed);
          setLoading(false);
          return;
        }
      } catch { /* fall through */ }
    }
    if (bookingId) {
      api.get(`/bookings/${bookingId}`)
        .then((r) => setBooking(r.data))
        .catch(() => {
          toast.error("Booking not found");
          nav("/dashboard");
        })
        .finally(() => setLoading(false));
    } else {
      nav("/dashboard");
      setLoading(false);
    }
  }, [bookingId, nav]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-10 space-y-4">
        <div className="skeleton h-12 w-1/3" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (!booking) return null;

  const dest = booking.destination || {};
  const flight = booking.flight || {};
  const hotel = booking.hotel || {};
  const room = booking.room || {};
  const pricing = booking.pricing || {};
  const travelers = booking.travelers || {};

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14" data-testid="booking-confirmation">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-[#0D5C75] text-white flex items-center justify-center mx-auto"
        >
          <CheckCircle2 size={44} />
        </motion.div>
        <h1 className="font-display text-4xl sm:text-5xl mt-6 tracking-tight">
          Booking Confirmed
        </h1>
        <p className="text-slate-600 mt-3 text-lg">
          Your trip to {dest.name || "your destination"} is confirmed.
        </p>
      </motion.div>

      {/* Booking details card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="tp-card p-6 sm:p-8 mt-8"
      >
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Booking ID" value={booking.booking_id} mono />
          <InfoRow label="Transaction ID" value={booking.transaction_id || "—"} mono />
          <InfoRow label="Payment" value="Demo Payment Successful" highlight />
          <InfoRow label="Status" value={booking.booking_status || "confirmed"} capitalize />
        </div>

        <div className="border-t border-slate-100 mt-6 pt-6 space-y-4">
          <Section icon={MapPin} label="Destination">
            <div className="font-display text-2xl">{dest.name}</div>
            <div className="text-slate-500">{dest.country}</div>
          </Section>

          <Section icon={Calendar} label="Trip">
            <div>{booking.duration_days || 0} days</div>
            {booking.origin && <div className="text-slate-500">From {booking.origin}</div>}
          </Section>

          <Section icon={Plane} label="Flight">
            <div>{flight.airline || "—"}</div>
            <div className="text-slate-500">{flight.from} → {flight.to} · {flight.price}</div>
          </Section>

          <Section icon={BedDouble} label="Hotel & Room">
            <div>{hotel.name || "—"}</div>
            <div className="text-slate-500">{room.label} · {booking.num_rooms} room(s) × {booking.num_nights} night(s)</div>
          </Section>

          <Section icon={Users} label="Travelers">
            <div>{travelers.fullName || "—"}</div>
            <div className="text-slate-500">{travelers.numTravelers || 1} traveler(s) · {travelers.email}</div>
          </Section>

          {booking.addons?.length > 0 && (
            <Section icon={Sparkles} label="Add-ons">
              {booking.addons.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.name}</span>
                  <span className="text-slate-500">{formatINR(a.price)}</span>
                </div>
              ))}
            </Section>
          )}
        </div>

        {/* Price breakdown */}
        <div className="border-t border-slate-100 mt-6 pt-6 space-y-2 text-sm">
          <PriceRow label="Subtotal" value={formatINR(pricing.subtotal)} />
          <PriceRow label="Taxes & fees" value={formatINR(pricing.taxes)} />
          <PriceRow label="Discount" value={`− ${formatINR(pricing.discount)}`} />
          <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
            <span className="font-display text-lg">Total Paid</span>
            <span className="font-display text-2xl text-[#0D5C75]">{formatINR(pricing.grandTotal)}</span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-[#E76F51]/8 text-xs text-center text-[#1A2530]">
          Demo Payment — No real money was charged. Transaction ID: {booking.transaction_id}
        </div>
      </motion.div>

      {/* Actions */}
      <div className="mt-8 grid sm:grid-cols-2 gap-3">
        <Link to={`/bookings/${booking.booking_id}`} className="btn-secondary flex items-center justify-center gap-2" data-testid="view-booking-btn">
          View Booking <ArrowRight size={16} />
        </Link>
        <button onClick={() => downloadConfirmationPdf(booking)} className="btn-primary flex items-center justify-center gap-2" data-testid="download-confirmation">
          <Download size={16} /> Download Confirmation
        </button>
        <Link to="/dashboard" className="btn-ghost flex items-center justify-center gap-2" data-testid="go-dashboard">
          <Home size={16} /> Go to Dashboard
        </Link>
        <Link to="/" className="btn-ghost flex items-center justify-center gap-2">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight, capitalize }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono" : ""} ${highlight ? "text-[#0D5C75] font-semibold" : "text-slate-800"} ${capitalize ? "capitalize" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <div className="eyebrow">{label}</div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function PriceRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

function downloadConfirmationPdf(booking) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const width = 510;
  let y = 54;

  const add = (text, size = 10, gap = 16, bold = false, color = [35, 45, 52]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text || ""), width);
    if (y + lines.length * (size + 3) > 790) { doc.addPage(); y = 54; }
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + gap;
  };

  // Branding header
  doc.setFillColor(13, 92, 117);
  doc.rect(0, 0, 595, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Voyage", margin, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Booking Confirmation", margin, 56);
  y = 100;

  add("BOOKING CONFIRMED", 20, 8, true, [13, 92, 117]);
  add(`Booking ID: ${booking.booking_id}`, 12, 6, true);
  add(`Transaction ID: ${booking.transaction_id || "—"}`, 10, 6);
  add(`Status: ${booking.booking_status || "confirmed"} · Payment: Demo Payment Successful`, 10, 14);

  const dest = booking.destination || {};
  add("TRIP DETAILS", 13, 7, true, [13, 92, 117]);
  add(`Destination: ${dest.name || "—"}, ${dest.country || ""}`, 10, 6);
  add(`Duration: ${booking.duration_days || 0} days`, 10, 6);
  if (booking.origin) add(`Origin: ${booking.origin}`, 10, 14);

  const flight = booking.flight || {};
  add("FLIGHT", 13, 7, true, [13, 92, 117]);
  add(`${flight.airline || "—"}: ${flight.from || ""} → ${flight.to || ""}`, 10, 6);
  add(`Duration: ${flight.duration || "—"} · Stops: ${flight.stops || "—"} · Price: ${flight.price || "—"}`, 10, 14);

  const hotel = booking.hotel || {};
  const room = booking.room || {};
  add("HOTEL & ROOM", 13, 7, true, [13, 92, 117]);
  add(`${hotel.name || "—"} · ${hotel.location || ""}`, 10, 6);
  add(`Room: ${room.label || "—"} · Rooms: ${booking.num_rooms || 1} · Nights: ${booking.num_nights || 1}`, 10, 6);
  add(`Rating: ${hotel.rating || "—"}/5 · Price/night: ${hotel.price_per_night || "—"}`, 10, 14);

  if (booking.addons?.length > 0) {
    add("ADD-ONS", 13, 7, true, [13, 92, 117]);
    booking.addons.forEach((a) => add(`• ${a.name} — ${formatINR(a.price)}`, 10, 5));
    y += 8;
  }

  const travelers = booking.travelers || {};
  add("TRAVELER DETAILS", 13, 7, true, [13, 92, 117]);
  add(`Contact: ${travelers.fullName || "—"} · ${travelers.email || ""} · ${travelers.phone || ""}`, 10, 6);
  add(`Travelers: ${travelers.numTravelers || 1}`, 10, 14);

  const p = booking.pricing || {};
  add("PRICE BREAKDOWN", 13, 7, true, [13, 92, 117]);
  add(`Subtotal: ${formatINR(p.subtotal)}`, 10, 5);
  add(`Taxes & fees: ${formatINR(p.taxes)}`, 10, 5);
  add(`Discount: − ${formatINR(p.discount)}`, 10, 5);
  add(`Grand Total: ${formatINR(p.grandTotal)}`, 13, 10, true, [13, 92, 117]);

  add("Demo Payment — No real money was charged. This is a simulated transaction for demonstration purposes only.", 9, 8, false, [231, 111, 81]);

  doc.save(`booking-${booking.booking_id}.pdf`);
}
