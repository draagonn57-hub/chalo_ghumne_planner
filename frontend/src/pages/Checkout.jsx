import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatINR, genTransactionId } from "@/lib/bookingUtils";
import {
  CreditCard, Smartphone, Building2, Wallet, Lock, Check, ArrowLeft, ShieldCheck,
} from "lucide-react";

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "netbanking", label: "Net Banking", icon: Building2 },
  { id: "wallet", label: "Wallet", icon: Wallet },
];

const BANKS = ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Punjab National Bank"];
const WALLETS = ["Paytm Wallet", "Amazon Pay", "Mobikwik", "Freecharge"];

export default function Checkout() {
  const nav = useNavigate();
  const [bookingData, setBookingData] = useState(() => {
    const raw = sessionStorage.getItem("tp_pending_booking");
    if (!raw) {
      toast.error("No booking in progress");
      nav("/dashboard");
      return null;
    }
    return JSON.parse(raw);
  });

  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);
  const [processStage, setProcessStage] = useState(0);

  // form fields
  const [card, setCard] = useState({ name: "", number: "", expiry: "", cvv: "" });
  const [upi, setUpi] = useState("");
  const [bank, setBank] = useState("");
  const [wallet, setWallet] = useState("");
  const [errors, setErrors] = useState({});

  if (!bookingData) return null;

  const total = bookingData.pricing?.grandTotal || 0;

  const validate = () => {
    const e = {};
    if (method === "card") {
      if (!card.name.trim()) e.name = "Cardholder name is required";
      if (!card.number.trim()) e.number = "Card number is required";
      else if (card.number.replace(/\s/g, "").length < 15) e.number = "Enter a valid card number";
      if (!card.expiry.trim()) e.expiry = "Expiry is required";
      if (!card.cvv.trim()) e.cvv = "CVV is required";
      else if (card.cvv.length < 3) e.cvv = "Enter a valid CVV";
    } else if (method === "upi") {
      if (!upi.trim()) e.upi = "UPI ID is required";
      else if (!/^[\w.\-]+@[\w]+$/.test(upi)) e.upi = "Enter a valid UPI ID (e.g. name@bank)";
    } else if (method === "netbanking") {
      if (!bank) e.bank = "Select a bank";
    } else if (method === "wallet") {
      if (!wallet) e.wallet = "Select a wallet";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = async () => {
    if (!validate()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setProcessing(true);
    setProcessStage(0);

    // Simulate payment processing stages
    const stageTimer = setInterval(() => {
      setProcessStage((s) => {
        if (s >= 2) {
          clearInterval(stageTimer);
          return s;
        }
        return s + 1;
      });
    }, 1200);

    // After 3.6s, create the booking
    setTimeout(async () => {
      clearInterval(stageTimer);
      const txnId = genTransactionId();
      const payload = {
        ...bookingData,
        payment_status: "demo_paid",
        transaction_id: txnId,
        booking_status: "confirmed",
      };

      try {
        const { data: saved } = await api.post("/bookings", payload);
        sessionStorage.removeItem("tp_pending_booking");
        sessionStorage.setItem("tp_last_booking", JSON.stringify(saved));
        nav(`/booking/confirmation/${saved.booking_id}`);
      } catch (err) {
        toast.error("Booking could not be saved. Please try again.");
        setProcessing(false);
        setProcessStage(0);
      }
    }, 3800);
  };

  const formatCardNumber = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:py-14" data-testid="checkout-page">
      <button onClick={() => nav(-1)} className="btn-ghost flex items-center gap-2 mb-4">
        <ArrowLeft size={16} /> Back to booking
      </button>

      <p className="eyebrow">Checkout</p>
      <h1 className="font-display text-4xl mt-2 tracking-tight">Demo Payment</h1>

      {/* Demo notice */}
      <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-[#E76F51]/8 border border-[#E76F51]/20" data-testid="demo-notice">
        <ShieldCheck size={20} className="text-[#E76F51] shrink-0 mt-0.5" />
        <p className="text-sm text-[#1A2530]">
          <span className="font-semibold">Demo Payment — No real money will be charged.</span>{" "}
          This is a simulated payment gateway for demonstration purposes only.
        </p>
      </div>

      {/* Amount */}
      <div className="tp-card p-6 mt-6 flex items-center justify-between">
        <div>
          <div className="eyebrow">Amount to pay</div>
          <div className="font-display text-4xl text-[#0D5C75] mt-1">{formatINR(total)}</div>
        </div>
        <Lock size={32} className="text-slate-300" />
      </div>

      {/* Payment method selector */}
      <div className="mt-6">
        <label className="eyebrow">Payment method</label>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const isSel = method === m.id;
            return (
              <motion.button
                key={m.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setMethod(m.id); setErrors({}); }}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${isSel ? "border-[#E76F51] bg-[#E76F51]/5" : "border-slate-200 hover:border-slate-300"}`}
                data-testid={`pay-method-${m.id}`}
              >
                <Icon size={22} className={isSel ? "text-[#E76F51]" : "text-slate-500"} />
                <span className={`text-xs font-medium text-center ${isSel ? "text-[#E76F51]" : "text-slate-600"}`}>{m.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Payment forms */}
      <div className="tp-card p-6 mt-6">
        {method === "card" && (
          <div className="space-y-4">
            <div>
              <label className="eyebrow">Cardholder name</label>
              <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E76F51] focus:outline-none" data-testid="card-name" />
              {errors.name && <div className="text-xs text-[#E76F51] mt-1">{errors.name}</div>}
            </div>
            <div>
              <label className="eyebrow">Card number</label>
              <input value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} placeholder="0000 0000 0000 0000" className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E76F51] focus:outline-none" data-testid="card-number" />
              {errors.number && <div className="text-xs text-[#E76F51] mt-1">{errors.number}</div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="eyebrow">Expiry (MM/YY)</label>
                <input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} placeholder="MM/YY" className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E76F51] focus:outline-none" data-testid="card-expiry" />
                {errors.expiry && <div className="text-xs text-[#E76F51] mt-1">{errors.expiry}</div>}
              </div>
              <div>
                <label className="eyebrow">CVV</label>
                <input type="password" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="•••" className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E76F51] focus:outline-none" data-testid="card-cvv" />
                {errors.cvv && <div className="text-xs text-[#E76F51] mt-1">{errors.cvv}</div>}
              </div>
            </div>
          </div>
        )}

        {method === "upi" && (
          <div>
            <label className="eyebrow">UPI ID</label>
            <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@bank" className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E76F51] focus:outline-none" data-testid="upi-id" />
            {errors.upi && <div className="text-xs text-[#E76F51] mt-1">{errors.upi}</div>}
          </div>
        )}

        {method === "netbanking" && (
          <div>
            <label className="eyebrow">Select bank</label>
            <select value={bank} onChange={(e) => setBank(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none" data-testid="netbanking-bank">
              <option value="">Choose your bank</option>
              {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {errors.bank && <div className="text-xs text-[#E76F51] mt-1">{errors.bank}</div>}
          </div>
        )}

        {method === "wallet" && (
          <div>
            <label className="eyebrow">Select wallet</label>
            <select value={wallet} onChange={(e) => setWallet(e.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none" data-testid="wallet-select">
              <option value="">Choose your wallet</option>
              {WALLETS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            {errors.wallet && <div className="text-xs text-[#E76F51] mt-1">{errors.wallet}</div>}
          </div>
        )}
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={processing}
        className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-60"
        data-testid="pay-button"
      >
        <Lock size={18} />
        {processing ? "Processing…" : `Pay ${formatINR(total)}`}
      </button>

      {/* Processing overlay */}
      <AnimatePresence>
        {processing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#FDFBF7]/95 backdrop-blur-sm"
            data-testid="payment-processing"
          >
            <div className="w-full max-w-md px-6">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="tp-card p-10 text-center"
              >
                <div className="space-y-6">
                  {["Processing payment…", "Verifying payment…", "Payment successful"].map((label, i) => {
                    const isDone = i < processStage;
                    const isActive = i === processStage;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0.3 }}
                        animate={{ opacity: isDone || isActive ? 1 : 0.3 }}
                        className="flex items-center gap-3 justify-center"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isDone ? "bg-[#0D5C75] text-white" : isActive ? "bg-[#E76F51]/10 border-2 border-[#E76F51] border-t-transparent rounded-full animate-spin" : "border-2 border-slate-200"
                        }`}>
                          {isDone && <Check size={16} strokeWidth={3} />}
                        </div>
                        <span className={`text-sm font-medium ${isDone ? "text-[#0D5C75]" : isActive ? "text-[#1A2530]" : "text-slate-400"}`}>
                          {label}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
