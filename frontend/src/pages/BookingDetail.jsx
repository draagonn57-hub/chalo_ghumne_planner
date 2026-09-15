import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import SmartImage from "@/components/SmartImage";
import { formatINR } from "@/lib/bookingUtils";
import { ArrowLeft, Download, Calendar, Plane, BedDouble, Users, MapPin, Sparkles, CircleCheck as CheckCircle2, Clock } from "lucide-react";
import { jsPDF } from "jspdf";

export default function BookingDetail() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) { nav("/dashboard"); return; }
    api.get(`/bookings/${bookingId}`)
      .then((r) => setBooking(r.data))
      .catch(() => { toast.error("Booking not found"); nav("/dashboard"); })
      .finally(() => setLoading(false));
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

  const statusColor = {
    confirmed: "bg-[#0D5C75]/10 text-[#0D5C75]",
    upcoming: "bg-[#E76F51]/10 text-[#E76F51]",
    completed: "bg-slate-100 text-slate-500",
    cancelled: "bg-red-100 text-red-600",
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14" data-testid="booking-detail">
      <button onClick={() => nav("/dashboard")} className="btn-ghost flex items-center gap-2 mb-4">
        <ArrowLeft size={16} /> Back to dashboard
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusColor[booking.booking_status] || statusColor.confirmed}`} data-testid="booking-status">
            {booking.booking_status || "confirmed"}
          </span>
          <span className="text-sm text-slate-400 font-mono">{booking.booking_id}</span>
        </div>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 tracking-tight">
          {dest.name || "Your trip"}
        </h1>
        <p className="text-slate-500 mt-2 flex items-center gap-1">
          <MapPin size={16} /> {dest.country}
        </p>
      </motion.div>

      {/* Hero image */}
      {dest.image || dest.image_query || dest.name ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-6 rounded-[1.25rem] overflow-hidden aspect-[16/7]"
        >
          <SmartImage
            directUrl={dest.image}
            imageQuery={dest.image_query || dest.name}
            salt={`booking-detail-${booking.booking_id}`}
            alt={dest.name}
            className="w-full h-full object-cover"
          />
        </motion.div>
      ) : null}

      {/* Details grid */}
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        <DetailCard icon={Calendar} label="Trip">
          <div className="font-display text-xl">{booking.duration_days || 0} days</div>
          {booking.origin && <div className="text-slate-500 text-sm">From {booking.origin}</div>}
        </DetailCard>

        <DetailCard icon={Plane} label="Flight">
          <div className="font-semibold">{flight.airline || "—"}</div>
          <div className="text-slate-500 text-sm">{flight.from} → {flight.to}</div>
          <div className="text-[#0D5C75] font-semibold text-sm mt-1">{flight.price}</div>
        </DetailCard>

        <DetailCard icon={BedDouble} label="Hotel & Room">
          <div className="font-semibold">{hotel.name || "—"}</div>
          <div className="text-slate-500 text-sm">{room.label} · {booking.num_rooms} room(s) × {booking.num_nights} night(s)</div>
          {hotel.rating && <div className="text-sm text-[#E76F51] mt-1">★ {hotel.rating}/5</div>}
        </DetailCard>

        <DetailCard icon={Users} label="Travelers">
          <div className="font-semibold">{travelers.fullName || "—"}</div>
          <div className="text-slate-500 text-sm">{travelers.email} · {travelers.phone}</div>
          <div className="text-slate-500 text-sm">{travelers.numTravelers || 1} traveler(s)</div>
        </DetailCard>
      </div>

      {/* Add-ons */}
      {booking.addons?.length > 0 && (
        <div className="mt-4 tp-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-[#E76F51]" />
            <h3 className="font-display text-xl">Add-on services</h3>
          </div>
          <div className="space-y-2">
            {booking.addons.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span className="text-slate-700">{a.name}</span>
                <span className="text-slate-500">{formatINR(a.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price breakdown */}
      <div className="mt-4 tp-card p-6">
        <h3 className="font-display text-xl mb-4">Price breakdown</h3>
        <div className="space-y-2 text-sm">
          <PriceRow label="Flight" value={formatINR(pricing.flight)} />
          <PriceRow label="Hotel" value={formatINR(pricing.hotelTotal)} />
          <PriceRow label="Add-ons" value={formatINR(pricing.addonsTotal)} />
          <PriceRow label="Subtotal" value={formatINR(pricing.subtotal)} />
          <PriceRow label="Taxes & fees" value={formatINR(pricing.taxes)} />
          <PriceRow label="Discount" value={`− ${formatINR(pricing.discount)}`} />
          <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
            <span className="font-display text-lg">Total Paid</span>
            <span className="font-display text-2xl text-[#0D5C75]">{formatINR(pricing.grandTotal)}</span>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-[#E76F51]/8 text-xs text-center">
          Demo Payment · Transaction: {booking.transaction_id || "—"} · No real money was charged
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => downloadPdf(booking)} className="btn-primary flex items-center gap-2" data-testid="booking-download">
          <Download size={16} /> Download Confirmation
        </button>
        <Link to="/dashboard" className="btn-ghost flex items-center gap-2">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function DetailCard({ icon: Icon, label, children }) {
  return (
    <div className="tp-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center">
          <Icon size={18} />
        </div>
        <span className="eyebrow">{label}</span>
      </div>
      {children}
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

function downloadPdf(booking) {
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

  const dest = booking.destination || {};
  add(`${dest.name || "Your trip"}, ${dest.country || ""}`, 20, 8, true, [13, 92, 117]);
  add(`Booking ID: ${booking.booking_id}`, 12, 6, true);
  add(`Transaction: ${booking.transaction_id || "—"} · Status: ${booking.booking_status || "confirmed"}`, 10, 14);

  add("TRIP", 13, 7, true, [13, 92, 117]);
  add(`Duration: ${booking.duration_days || 0} days${booking.origin ? ` · From ${booking.origin}` : ""}`, 10, 14);

  const flight = booking.flight || {};
  add("FLIGHT", 13, 7, true, [13, 92, 117]);
  add(`${flight.airline || "—"}: ${flight.from || ""} → ${flight.to || ""} · ${flight.price || ""}`, 10, 14);

  const hotel = booking.hotel || {};
  const room = booking.room || {};
  add("HOTEL & ROOM", 13, 7, true, [13, 92, 117]);
  add(`${hotel.name || "—"} · ${hotel.location || ""} · ★ ${hotel.rating || "—"}`, 10, 6);
  add(`Room: ${room.label || "—"} · ${booking.num_rooms || 1} room(s) × ${booking.num_nights || 1} night(s)`, 10, 14);

  if (booking.addons?.length > 0) {
    add("ADD-ONS", 13, 7, true, [13, 92, 117]);
    booking.addons.forEach((a) => add(`• ${a.name} — ${formatINR(a.price)}`, 10, 5));
    y += 8;
  }

  const travelers = booking.travelers || {};
  add("TRAVELERS", 13, 7, true, [13, 92, 117]);
  add(`${travelers.fullName || "—"} · ${travelers.email || ""} · ${travelers.phone || ""}`, 10, 6);
  add(`Travelers: ${travelers.numTravelers || 1}`, 10, 14);

  const p = booking.pricing || {};
  add("PRICE BREAKDOWN", 13, 7, true, [13, 92, 117]);
  add(`Subtotal: ${formatINR(p.subtotal)}`, 10, 5);
  add(`Taxes: ${formatINR(p.taxes)}`, 10, 5);
  add(`Discount: − ${formatINR(p.discount)}`, 10, 5);
  add(`Grand Total: ${formatINR(p.grandTotal)}`, 13, 10, true, [13, 92, 117]);

  add("Demo Payment — No real money was charged.", 9, 8, false, [231, 111, 81]);

  doc.save(`booking-${booking.booking_id}.pdf`);
}
