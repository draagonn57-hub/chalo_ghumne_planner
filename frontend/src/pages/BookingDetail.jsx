import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import SmartImage from "@/components/SmartImage";
import { formatINR } from "@/lib/bookingUtils";
import { SUPPORT_EMAIL, mailtoLink } from "@/lib/siteConfig";
import { ArrowLeft, Download, Calendar, Plane, BedDouble, Users, MapPin, Sparkles, Mail, RefreshCw, Train } from "lucide-react";

export default function BookingDetail() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [downloadingKind, setDownloadingKind] = useState(null);

  const handleDownload = async (kind = "confirmation") => {
    if (downloadingKind || !booking?.booking_id) return;
    setDownloadingKind(kind);
    try {
      const res = await api.get(`/bookings/${booking.booking_id}/pdf/${kind}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const kindLabel = kind === "confirmation" ? "Confirmation" : "Itinerary";
      link.setAttribute("download", `ChaloGhumne-${kindLabel}-${booking.booking_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`Could not generate PDF. Please contact ${SUPPORT_EMAIL}`);
    } finally {
      setDownloadingKind(null);
    }
  };

  useEffect(() => {
    if (!bookingId) { nav("/dashboard"); return; }
    api.get(`/bookings/${bookingId}`)
      .then((r) => setBooking(r.data))
      .catch(() => { toast.error("Booking not found"); nav("/dashboard"); })
      .finally(() => setLoading(false));
  }, [bookingId, nav]);

  const handleResendEmail = async () => {
    if (resending) return;
    setResending(true);
    try {
      await api.post(`/bookings/${bookingId}/resend-email`);
      toast.success("Confirmation email queued!");
      // Refresh booking to get updated email_status
      const r = await api.get(`/bookings/${bookingId}`);
      setBooking(r.data);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || `Could not resend email. Contact ${SUPPORT_EMAIL}.`);
    } finally {
      setResending(false);
    }
  };

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
  const train = booking.train || {};
  const hotel = booking.hotel || {};
  const room = booking.room || {};
  const pricing = booking.pricing || {};
  const travelers = booking.travelers || {};
  const transportMode = (booking.transport_mode || "flight").toLowerCase();

  const titleCase = (s) => s ? s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "";

  const maskEmail = (email) => {
    if (!email || !email.includes("@")) return "your email";
    const [local, domain] = email.split("@");
    return `${local[0]}***@${domain}`;
  };

  const statusColor = {
    confirmed: "bg-[#0D5C75]/10 text-[#0D5C75]",
    upcoming: "bg-[#E76F51]/10 text-[#E76F51]",
    completed: "bg-slate-100 text-slate-500",
    cancelled: "bg-red-100 text-red-600",
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14" data-testid="booking-detail">
      <div className="tp-card p-8 sm:p-10">
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
          {booking.origin && <div className="text-slate-500 text-sm">From {titleCase(booking.origin)}</div>}
        </DetailCard>

        {transportMode === "train" && train?.name ? (
          <DetailCard icon={Train} label="Train">
            <div className="font-semibold">{train.name || "—"} <span className="text-slate-400 text-xs font-normal">#{train.number}</span></div>
            <div className="text-slate-500 text-sm">{train.from_station} → {train.to_station}</div>
            {train.classes?.[0] && <div className="text-[#0D5C75] font-semibold text-sm mt-1">{train.classes[0].name} · {train.classes[0].price}</div>}
          </DetailCard>
        ) : (
          <DetailCard icon={Plane} label="Flight">
            <div className="font-semibold">{flight.airline || "—"}</div>
            <div className="text-slate-500 text-sm">{flight.from} → {flight.to}</div>
            <div className="text-[#0D5C75] font-semibold text-sm mt-1">{flight.price}</div>
          </DetailCard>
        )}

        <DetailCard icon={BedDouble} label="Hotel & Room">
          <div className="font-semibold">{hotel.name || "—"}</div>
          <div className="text-slate-500 text-sm">{room.label} · {booking.num_rooms} room(s) × {booking.num_nights} night(s)</div>
          {hotel.rating && <div className="text-sm text-[#E76F51] mt-1">★ {hotel.rating}/5</div>}
        </DetailCard>

        <DetailCard icon={Users} label="Travelers">
          <div className="font-semibold">{travelers.fullName || "—"}</div>
          <div className="text-slate-500 text-sm">{travelers.numTravelers || 1} traveler(s)</div>
          {travelers.passengers?.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {travelers.passengers.map((p, i) => (
                <li key={i} className="text-slate-500 text-sm">
                  {p.name || `Passenger ${i + 1}`}{p.dob ? ` · ${p.dob}` : ""}{p.gender ? ` · ${p.gender}` : ""}
                </li>
              ))}
            </ul>
          )}
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

      {/* Email status + resend */}
      <div className="mt-4 tp-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={16} className="text-[#0D5C75]" />
            {booking.email_status === "sent" && (
              <span data-testid="email-status-badge">Confirmation email sent{booking._account_email ? ` to ${maskEmail(booking._account_email)}` : ""}</span>
            )}
            {booking.email_status === "failed" && (
              <span className="text-[#E76F51]" data-testid="email-status-badge">Confirmation email could not be sent</span>
            )}
            {booking.email_status === "skipped" && (
              <span className="text-slate-400" data-testid="email-status-badge">Email notifications not configured</span>
            )}
            {(!booking.email_status || booking.email_status === "pending") && (
              <span className="text-slate-400" data-testid="email-status-badge">Email status: {booking.email_status || "—"}</span>
            )}
          </div>
          {booking.booking_status === "confirmed" && (
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
              data-testid="resend-email-btn"
            >
              <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
              {resending ? "Sending…" : "Resend confirmation email"}
            </button>
          )}
        </div>
      </div>

      {/* Support */}
      <div className="mt-3 p-4 rounded-xl bg-slate-50 text-sm text-center text-slate-600">
        Need help with this booking?{" "}
        <a
          href={mailtoLink(`Booking help — ${booking.booking_id}`)}
          className="text-[#0D5C75] hover:underline font-semibold select-text"
          data-testid="detail-support-link"
        >
          Email {SUPPORT_EMAIL}
        </a>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => handleDownload("confirmation")}
          disabled={!!downloadingKind}
          className="btn-primary flex items-center gap-2 disabled:opacity-70"
          data-testid="booking-download"
        >
          <Download size={16} className={downloadingKind === "confirmation" ? "animate-bounce" : ""} />
          {downloadingKind === "confirmation" ? "Preparing PDF..." : "Download Confirmation"}
        </button>
        {booking.itinerary && (
          <button
            onClick={() => handleDownload("itinerary")}
            disabled={!!downloadingKind}
            className="btn-secondary flex items-center gap-2 disabled:opacity-70"
            data-testid="booking-download-itinerary"
          >
            <Download size={16} className={downloadingKind === "itinerary" ? "animate-bounce" : ""} />
            {downloadingKind === "itinerary" ? "Preparing PDF..." : "Download Itinerary"}
          </button>
        )}
        <Link to="/dashboard" className="btn-ghost flex items-center gap-2">
          Back to Dashboard
        </Link>
      </div>
      </div>{/* end tp-card */}
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

