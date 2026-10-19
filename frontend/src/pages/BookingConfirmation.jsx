import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatINR } from "@/lib/bookingUtils";
import { SUPPORT_EMAIL, mailtoLink } from "@/lib/siteConfig";
import { CircleCheck as CheckCircle2, Download, Hop as Home, Calendar, Plane, BedDouble, Users, MapPin, ArrowRight, Sparkles, Mail, Train } from "lucide-react";

export default function BookingConfirmation() {
  const { bookingId } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading || !booking?.booking_id) return;
    setDownloading(true);
    try {
      const res = await api.get(`/bookings/${booking.booking_id}/pdf/confirmation`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `ChaloGhumne-Confirmation-${booking.booking_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`Could not generate PDF. Please contact ${SUPPORT_EMAIL}`);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const raw = sessionStorage.getItem("tp_last_booking");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.booking_id === bookingId || !bookingId) {
          setBooking(parsed);
          // Safely coerce email_status to string
          const es = parsed.email_status;
          setEmailStatus(typeof es === "string" ? es : null);
          setLoading(false);
          // If still pending, poll once after 5s
          if (parsed.email_status === "pending" || parsed.email_status === "sending") {
            setTimeout(() => {
              api.get(`/bookings/${parsed.booking_id}`)
                .then((r) => {
                  const newEs = r.data.email_status;
                  setEmailStatus(typeof newEs === "string" ? newEs : null);
                  setBooking(r.data);
                })
                .catch(() => {});
            }, 5000);
          }
          return;
        }
      } catch { /* fall through */ }
    }
    if (bookingId) {
      api.get(`/bookings/${bookingId}`)
        .then((r) => {
          setBooking(r.data);
          const es = r.data.email_status;
          setEmailStatus(typeof es === "string" ? es : null);
        })
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
  const train = booking.train || {};
  const hotel = booking.hotel || {};
  const room = booking.room || {};
  const pricing = booking.pricing || {};
  const travelers = booking.travelers || {};
  const transportMode = (booking.transport_mode || "flight").toLowerCase();

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14" data-testid="booking-confirmation">
      <div className="tp-card p-8 sm:p-10">
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

        {/* Email status notice */}
        {emailStatus === "sent" && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#0D5C75]" data-testid="email-status-sent">
            <Mail size={16} />
            <span>Confirmation email with PDF sent to your Gmail ✓</span>
          </div>
        )}
        {(emailStatus === "pending" || emailStatus === "sending") && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500" data-testid="email-status-pending">
            <Mail size={16} className="animate-pulse" />
            <span>Sending confirmation email to your Gmail…</span>
          </div>
        )}
        {emailStatus === "failed" && (
          <div className="mt-4 text-sm text-[#E76F51] text-center" data-testid="email-status-failed">
            Email delivery failed.{" "}
            <Link to={`/bookings/${booking.booking_id}`} className="underline font-semibold">Resend from your booking page</Link>.
          </div>
        )}
        {emailStatus === "skipped" && (
          <div className="mt-4 text-sm text-slate-400 text-center" data-testid="email-status-skipped">
            Email notifications are not configured on this instance.
          </div>
        )}
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
            {booking.origin && <div className="text-slate-500">From {booking.origin.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</div>}
          </Section>

          {transportMode === "train" && train?.name ? (
            <Section icon={Train} label="Train">
              <div>{train.name || "—"} <span className="text-slate-400 text-xs">#{train.number}</span></div>
              <div className="text-slate-500">{train.from_station} → {train.to_station}</div>
              {train.classes?.[0] && <div className="text-slate-500">{train.classes[0].name} · {train.classes[0].price}</div>}
            </Section>
          ) : (
            <Section icon={Plane} label="Flight">
              <div>{flight.airline || "—"}</div>
              <div className="text-slate-500">{flight.from} → {flight.to} · {flight.price}</div>
            </Section>
          )}

          <Section icon={BedDouble} label="Hotel & Room">
            <div>{hotel.name || "—"}</div>
            <div className="text-slate-500">{room.label} · {booking.num_rooms} room(s) × {booking.num_nights} night(s)</div>
          </Section>

          <Section icon={Users} label="Travelers">
            <div>{travelers.fullName || "—"}</div>
            <div className="text-slate-500">{travelers.numTravelers || 1} traveler(s)</div>
            {travelers.passengers?.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {travelers.passengers.map((p, i) => (
                  <li key={i} className="text-slate-500 text-sm">
                    {p.name || `Passenger ${i + 1}`}{p.dob ? ` · ${p.dob}` : ""}{p.gender ? ` · ${p.gender}` : ""}
                  </li>
                ))}
              </ul>
            )}
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

      {/* Support */}
      <div className="mt-4 p-4 rounded-xl bg-slate-50 text-sm text-center text-slate-600" data-testid="booking-support-note">
        Need help with this booking?{" "}
        <a
          href={mailtoLink(`Booking help — ${booking.booking_id}`)}
          className="text-[#0D5C75] hover:underline font-semibold select-text"
          data-testid="confirmation-support-link"
        >
          Email {SUPPORT_EMAIL}
        </a>
        <span className="text-slate-400"> · Booking ID: {booking.booking_id}</span>
      </div>

      {/* Actions */}
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <Link to={`/bookings/${booking.booking_id}`} className="btn-secondary flex items-center justify-center gap-2" data-testid="view-booking-btn">
          View Booking <ArrowRight size={16} />
        </Link>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-70"
          data-testid="download-confirmation"
        >
          <Download size={16} className={downloading ? "animate-bounce" : ""} />
          {downloading ? "Preparing PDF..." : "Download Confirmation"}
        </button>
        <Link to="/dashboard" className="btn-ghost flex items-center justify-center gap-2" data-testid="go-dashboard">
          <Home size={16} /> Go to Dashboard
        </Link>
        <Link to="/" className="btn-ghost flex items-center justify-center gap-2">
          Back to Home
        </Link>
      </div>
      </div>{/* end tp-card */}
    </div>
  );
}

function InfoRow({ label, value, mono, highlight, capitalize }) {
  // Safely convert value to string to prevent React "Objects are not valid as child" errors
  const safeValue = value === null || value === undefined
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono" : ""} ${highlight ? "text-[#0D5C75] font-semibold" : "text-slate-800"} ${capitalize ? "capitalize" : ""}`}>
        {safeValue}
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

