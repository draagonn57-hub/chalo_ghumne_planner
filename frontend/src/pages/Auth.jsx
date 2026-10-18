import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { mailtoLink } from "@/lib/siteConfig";
import { toast } from "sonner";

export function GoogleSignInButton({ onResponse, text = "continue_with", disabled = false }) {
  const containerRef = useRef(null);
  const clientId =
    process.env.REACT_APP_GOOGLE_CLIENT_ID ||
    "84500475860-kt6nbrh7k16b804utd9f39c2m44kg95q.apps.googleusercontent.com";

  useEffect(() => {
    // Attach response handler to window so declarative callback also functions
    window.handleGoogleCredentialResponse = onResponse;

    const renderBtn = () => {
      if (window.google?.accounts?.id && containerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: onResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Render Google standard button inside container
          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: text,
            shape: "rectangular",
            logo_alignment: "left",
            width: containerRef.current.offsetWidth || 360,
          });
        } catch (e) {
          console.warn("GIS render error:", e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      renderBtn();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          renderBtn();
        }
      }, 150);

      // Ensure script tag is present
      if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = renderBtn;
        document.head.appendChild(script);
      }

      return () => clearInterval(interval);
    }
  }, [onResponse, text, clientId]);

  return (
    <div className="w-full">
      {/* Declarative GIS container with real data-client_id */}
      <div
        id="g_id_onload"
        data-client_id="84500475860-kt6nbrh7k16b804utd9f39c2m44kg95q.apps.googleusercontent.com"
        data-context="signin"
        data-ux_mode="popup"
        data-callback="handleGoogleCredentialResponse"
        data-auto_prompt="false"
      ></div>

      <div
        ref={containerRef}
        id="google-signin-btn"
        data-testid="google-signin-btn"
        data-client_id="84500475860-kt6nbrh7k16b804utd9f39c2m44kg95q.apps.googleusercontent.com"
        className="w-full flex justify-center min-h-[44px]"
      >
        <button
          type="button"
          onClick={() => {
            if (window.google?.accounts?.id) {
              window.google.accounts.id.prompt();
            } else {
              toast.info("Connecting to Google Identity Services...");
            }
          }}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium text-sm shadow-sm cursor-pointer"
          data-testid="google-signin-fallback"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>{disabled ? "Signing in…" : text === "signup_with" ? "Sign up with Google" : "Continue with Google"}</span>
        </button>
      </div>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white/80 px-2 text-slate-500 font-semibold backdrop-blur-sm rounded">
            Or continue with email
          </span>
        </div>
      </div>
    </div>
  );
}

export function EmailOtpFlow({ mode = "login", onSuccess }) {
  const { sendOtp, verifyOtp, setUser } = useAuth();
  const [step, setStep] = useState("email"); // "email" | "otp"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(45);

  // 45-second countdown timer for Step 2
  useEffect(() => {
    if (step !== "otp" || countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, countdown]);

  const handleGoogleSuccess = useCallback(
    async (response) => {
      try {
        setGoogleBusy(true);
        const token = response?.credential || response?.token || response?.id_token;
        if (!token) {
          toast.error("Google sign-in did not return a credential");
          return;
        }

        const { data } = await api.post("/auth/google", {
          credential: token,
          token: token,
        });

        localStorage.setItem("tp_token", data.token);
        if (setUser) setUser(data.user);

        toast.success(`Welcome back, ${data.user?.name || "Traveler"}!`);
        onSuccess?.(data.user);
      } catch (err) {
        console.error("Google login error:", err);
        toast.error(err?.response?.data?.detail || "Google sign-in failed");
      } finally {
        setGoogleBusy(false);
      }
    },
    [onSuccess, setUser]
  );

  // Step 1: Send OTP to email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter a valid email address");
      return;
    }

    setBusy(true);
    try {
      await sendOtp(cleanEmail);
      setCountdown(45);
      setStep("otp");
      toast.success(`Verification code sent to ${cleanEmail}`);
    } catch (err) {
      console.error("Send OTP error:", err);
      toast.error(err?.response?.data?.detail || "Failed to send verification code");
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    try {
      await sendOtp(email.trim().toLowerCase());
      setCountdown(45);
      toast.success("New verification code sent!");
    } catch (err) {
      console.error("Resend OTP error:", err);
      toast.error(err?.response?.data?.detail || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setBusy(true);
    try {
      const data = await verifyOtp(email.trim().toLowerCase(), cleanOtp);
      toast.success(`Welcome, ${data.user?.name || "Traveler"}!`);
      onSuccess?.(data.user);
    } catch (err) {
      console.error("Verify OTP error:", err);
      toast.error(err?.response?.data?.detail || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {step === "email" ? (
        <>
          <GoogleSignInButton
            onResponse={handleGoogleSuccess}
            text={mode === "signup" ? "signup_with" : "continue_with"}
            disabled={googleBusy || busy}
          />

          <form onSubmit={handleSendOtp} className="space-y-4" data-testid="login-form">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoFocus
                disabled={busy || googleBusy}
                data-testid="login-email"
                className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none transition-colors text-slate-900 placeholder:text-slate-400"
              />
            </label>

            <button
              type="submit"
              className="btn-primary w-full cursor-pointer flex items-center justify-center gap-2"
              disabled={busy || googleBusy || !email.trim()}
              data-testid="login-submit"
            >
              {busy ? "Sending code…" : "Continue with email"}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5" data-testid="otp-verify-form">
          {/* Header with entered email and option to edit */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            <div className="truncate mr-3">
              <span className="text-slate-500 text-xs block">Verification code sent to</span>
              <span className="font-semibold text-slate-800 text-sm truncate block" data-testid="sent-email-display">
                {email}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setOtp("");
              }}
              className="text-xs font-semibold text-[#0D5C75] hover:text-[#0A485C] underline px-2 py-1 rounded transition-colors cursor-pointer flex-shrink-0"
              data-testid="edit-email-btn"
            >
              Edit email
            </button>
          </div>

          {/* 6-digit verification code input */}
          <label className="block">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                6-Digit Verification Code
              </span>
              <span className="text-xs text-slate-400">Valid for 10 min</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(val);
              }}
              placeholder="••••••"
              required
              autoFocus
              disabled={busy}
              data-testid="otp-input"
              className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-center text-2xl font-mono tracking-[0.45em] focus:border-[#E76F51] focus:outline-none transition-colors text-slate-900 placeholder:text-slate-300"
            />
          </label>

          {/* Verify button */}
          <button
            type="submit"
            className="btn-primary w-full cursor-pointer flex items-center justify-center gap-2"
            disabled={busy || otp.length !== 6}
            data-testid="verify-otp-btn"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>

          {/* 45-second resend countdown timer */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Didn't receive the code?</span>
            {countdown > 0 ? (
              <span className="font-medium text-slate-400" data-testid="countdown-timer">
                Resend in {countdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || busy}
                className="font-semibold text-[#0D5C75] hover:underline cursor-pointer"
                data-testid="resend-otp-btn"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const next = new URLSearchParams(loc.search).get("next") || "/dashboard";

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue planning your next journey.">
      <EmailOtpFlow mode="login" onSuccess={() => nav(next)} />
      <div className="flex items-center justify-center text-sm pt-4 border-t border-slate-200/70 mt-6">
        <span className="text-slate-500">Need an account? </span>
        <Link to="/signup" className="text-[#0D5C75] font-semibold hover:underline ml-1" data-testid="link-signup">
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}

export function Signup() {
  const nav = useNavigate();

  return (
    <AuthLayout title="Begin your journey" subtitle="Sign in or create an account with your email.">
      <EmailOtpFlow mode="signup" onSuccess={() => nav("/plan")} />
      <div className="flex items-center justify-center text-sm pt-4 border-t border-slate-200/70 mt-6">
        <span className="text-slate-500">Already have an account? </span>
        <Link to="/login" className="text-[#0D5C75] font-semibold hover:underline ml-1" data-testid="link-login">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const nav = useNavigate();

  return (
    <AuthLayout title="Passwordless Sign-In" subtitle="We now use passwordless email sign-in. Enter your email to receive a 6-digit code.">
      <EmailOtpFlow mode="login" onSuccess={() => nav("/dashboard")} />
      <div className="flex items-center justify-center text-sm pt-4 border-t border-slate-200/70 mt-6">
        <Link to="/login" className="text-[#0D5C75] font-semibold hover:underline" data-testid="link-login">
          Back to Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const nav = useNavigate();

  return (
    <AuthLayout title="Passwordless Sign-In" subtitle="Passwords are no longer needed! You can sign in anytime using your email and a 6-digit code.">
      <EmailOtpFlow mode="login" onSuccess={() => nav("/dashboard")} />
      <div className="flex items-center justify-center text-sm pt-4 border-t border-slate-200/70 mt-6">
        <Link to="/login" className="text-[#0D5C75] font-semibold hover:underline" data-testid="link-login">
          Back to Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden">
      {/* Gradient overlay on top of the global cycling background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0D5C75]/60 via-[#0A1E28]/40 to-[#0A1E28]/65 pointer-events-none" />

      <div className="relative z-10 min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div
          className="glass-card animate-glass-pop w-full max-w-md p-8 sm:p-10"
          data-testid="auth-glass-card"
        >
          <img
            src="/assets/images/logo.png"
            alt="Chalo Ghumne"
            className="w-14 h-14 object-contain rounded-full mb-5"
          />
          <h1 className="font-display text-4xl tracking-tight text-[#0A1E28]">
            {title}
          </h1>

          <p className="text-slate-600 mt-2">
            {subtitle}
          </p>

          <div className="mt-8">
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Having trouble signing in?{" "}
            <a
              href={mailtoLink("Sign-in issue — Chalo Ghumne")}
              className="text-[#0D5C75] hover:underline"
              data-testid="auth-support-link"
            >
              Contact support
            </a>
          </p>
        </div>

        <div className="mt-8 text-center text-white/85 max-w-md animate-fade-up">
          <p className="eyebrow text-white/70">
            Voyage
          </p>

          <p className="font-display text-lg sm:text-xl mt-2 leading-snug">
            Every great trip begins with a whisper of curiosity.
          </p>
        </div>
      </div>
    </div>
  );
}
