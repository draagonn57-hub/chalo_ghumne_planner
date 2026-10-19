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
            shape: "pill",
            logo_alignment: "left",
            width: containerRef.current.offsetWidth || 380,
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
      {/* Declarative GIS container */}
      <div
        id="g_id_onload"
        data-client_id={clientId}
        data-context="signin"
        data-ux_mode="popup"
        data-callback="handleGoogleCredentialResponse"
        data-auto_prompt="false"
      ></div>

      <div
        ref={containerRef}
        id="google-signin-btn"
        data-testid="google-signin-btn"
        data-client_id={clientId}
        className="w-full flex justify-center min-h-[46px]"
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
          className="relative w-full h-[46px] sm:h-[48px] px-4 flex items-center justify-center rounded-full bg-white hover:bg-slate-50/90 border border-slate-200/90 transition-colors text-slate-700 font-medium text-[14px] sm:text-[15px] shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="google-signin-fallback"
        >
          <div className="absolute left-4 sm:left-5 flex items-center justify-center pointer-events-none">
            <svg className="w-[19px] h-[19px] flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>
          <span>{disabled ? "Signing in…" : text === "signup_with" ? "Sign up with Google" : "Continue with Google"}</span>
        </button>
      </div>

      {/* Understated Divider matching Image 1 & Section 6 */}
      <div className="flex items-center my-5 sm:my-6 gap-3">
        <div className="flex-1 h-px bg-slate-200/90" />
        <span className="text-[11px] font-semibold text-[#647B8A] uppercase tracking-wider select-none px-1">
          OR
        </span>
        <div className="flex-1 h-px bg-slate-200/90" />
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
            <div className="space-y-1.5">
              <label
                htmlFor="login-email-input"
                className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#647B8A]"
              >
                EMAIL ADDRESS
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 sm:left-4 pointer-events-none text-[#647B8A] flex items-center">
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="1.75"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoFocus
                  disabled={busy || googleBusy}
                  data-testid="login-email"
                  className="auth-input w-full pl-10 sm:pl-11 pr-4 py-3 text-sm sm:text-[15px] font-normal text-slate-800 bg-white/95 rounded-xl border border-slate-200/90 placeholder:text-slate-400 focus:outline-none focus:border-[#0D5C75] focus:ring-1 focus:ring-[#0D5C75]/25 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-[46px] sm:h-[48px] rounded-full bg-[#0D5C75] hover:bg-[#0A485C] active:scale-[0.99] text-white font-medium text-[14px] sm:text-[15px] flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[#0D5C75]"
              disabled={busy || googleBusy || !email.trim()}
              data-testid="login-submit"
            >
              <span>{busy ? "Sending code…" : "Continue with email"}</span>
              {!busy && (
                <svg
                  className="w-4 h-4 ml-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              )}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5" data-testid="otp-verify-form">
          {/* Header with entered email and option to edit */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-sm">
            <div className="truncate mr-3">
              <span className="text-[#647B8A] text-xs block">Verification code sent to</span>
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
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] sm:text-xs uppercase tracking-wider text-[#647B8A] font-semibold">
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
              className="auth-input w-full px-4 py-3 rounded-xl border border-slate-200/90 bg-white/95 text-center text-2xl font-mono tracking-[0.45em] focus:border-[#0D5C75] focus:outline-none focus:ring-1 focus:ring-[#0D5C75]/25 transition-all text-slate-900 placeholder:text-slate-300 shadow-sm"
            />
          </label>

          {/* Verify button */}
          <button
            type="submit"
            className="w-full h-[46px] sm:h-[48px] rounded-full bg-[#0D5C75] hover:bg-[#0A485C] active:scale-[0.99] text-white font-medium text-[14px] sm:text-[15px] flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-55 disabled:cursor-not-allowed"
            disabled={busy || otp.length !== 6}
            data-testid="verify-otp-btn"
          >
            {busy ? "Verifying…" : "Verify"}
          </button>

          {/* 45-second resend countdown timer */}
          <div className="flex items-center justify-between text-xs text-[#647B8A] pt-1">
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
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue planning your next journey."
      footer={
        <div className="mt-6 space-y-2 text-center text-xs sm:text-[13px] text-[#647B8A]">
          <div>
            <span>Need an account? </span>
            <Link
              to="/signup"
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors ml-1"
              data-testid="link-signup"
            >
              Create account
            </Link>
          </div>
          <div>
            <span>Having trouble signing in? </span>
            <a
              href={mailtoLink("Sign-in issue — Chalo Ghumne")}
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors ml-1"
              data-testid="auth-support-link"
            >
              Contact support
            </a>
          </div>
        </div>
      }
    >
      <EmailOtpFlow mode="login" onSuccess={() => nav(next)} />
    </AuthLayout>
  );
}

export function Signup() {
  const nav = useNavigate();

  return (
    <AuthLayout
      title="Begin your journey"
      subtitle="Sign in or create an account with your email."
      footer={
        <div className="mt-6 space-y-2 text-center text-xs sm:text-[13px] text-[#647B8A]">
          <div>
            <span>Already have an account? </span>
            <Link
              to="/login"
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors ml-1"
              data-testid="link-login"
            >
              Sign in
            </Link>
          </div>
          <div>
            <span>Having trouble signing in? </span>
            <a
              href={mailtoLink("Sign-in issue — Chalo Ghumne")}
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors ml-1"
              data-testid="auth-support-link"
            >
              Contact support
            </a>
          </div>
        </div>
      }
    >
      <EmailOtpFlow mode="signup" onSuccess={() => nav("/plan")} />
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const nav = useNavigate();

  return (
    <AuthLayout
      title="Passwordless Sign-In"
      subtitle="We now use passwordless email sign-in. Enter your email to receive a 6-digit code."
      footer={
        <div className="mt-6 space-y-2 text-center text-xs sm:text-[13px] text-[#647B8A]">
          <div>
            <Link
              to="/login"
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors"
              data-testid="link-login"
            >
              Back to Sign in
            </Link>
          </div>
          <div>
            <span>Having trouble signing in? </span>
            <a
              href={mailtoLink("Sign-in issue — Chalo Ghumne")}
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors ml-1"
              data-testid="auth-support-link"
            >
              Contact support
            </a>
          </div>
        </div>
      }
    >
      <EmailOtpFlow mode="login" onSuccess={() => nav("/dashboard")} />
    </AuthLayout>
  );
}

export function ResetPassword() {
  const nav = useNavigate();

  return (
    <AuthLayout
      title="Passwordless Sign-In"
      subtitle="Passwords are no longer needed! You can sign in anytime using your email and a 6-digit code."
      footer={
        <div className="mt-6 space-y-2 text-center text-xs sm:text-[13px] text-[#647B8A]">
          <div>
            <Link
              to="/login"
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors"
              data-testid="link-login"
            >
              Back to Sign in
            </Link>
          </div>
          <div>
            <span>Having trouble signing in? </span>
            <a
              href={mailtoLink("Sign-in issue — Chalo Ghumne")}
              className="text-[#0D5C75] font-semibold hover:underline hover:text-[#0A485C] transition-colors ml-1"
              data-testid="auth-support-link"
            >
              Contact support
            </a>
          </div>
        </div>
      }
    >
      <EmailOtpFlow mode="login" onSuccess={() => nav("/dashboard")} />
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-8 sm:py-12 overflow-y-auto">
      {/*
        Full-viewport atmospheric snow-covered mountain background:
        Center-positioned so majestic snowy peaks are visible behind and around the translucent card
      */}
      <div
        className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url('/assets/images/snow-mountain-bg.jpg')`,
          backgroundPosition: "center 32%",
        }}
        aria-hidden="true"
      />

      {/*
        Muted cinematic overlay:
        Balances brightness between Image 2 and Image 3, maintaining natural cool blue-grey tones
        and ensuring optimal text contrast without over-darkening
      */}
      <div
        className="fixed inset-0 bg-[#0A1A24]/20 pointer-events-none"
        aria-hidden="true"
      />

      {/*
        Translucent Frosted Glass Card:
        - Semi-transparent, frosted neutral glass (bg-white/85)
        - Moderate blur (backdrop-filter: blur(12px))
        - Thin low-opacity white border (border border-white/60)
        - Rounded corners: 24-30px (rounded-[24px] sm:rounded-[28px])
        - Subtle shadow separating card from mountain background
        - Max width: 440-480px (max-w-[460px])
        - Padding: 36-44px desktop (p-8 sm:p-10), 20-24px mobile (p-6)
      */}
      <div
        className="relative z-10 w-full max-w-[460px] my-auto bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 shadow-[0_16px_40px_-12px_rgba(10,30,40,0.22),0_2px_8px_rgba(10,30,40,0.06)] animate-glass-pop"
        data-testid="auth-glass-card"
      >
        {/* Top Logo - centered */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <Link
            to="/"
            className="inline-block transition-transform duration-200 hover:scale-105"
            title="Chalo Ghumne"
          >
            <img
              src="/assets/images/logo.png"
              alt="Chalo Ghumne"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-full select-none"
            />
          </Link>
        </div>

        {/* Heading & Supporting Text */}
        <div className="text-center mb-6 sm:mb-7">
          <h1 className="font-display text-[30px] sm:text-[34px] font-semibold text-[#102D3A] tracking-tight leading-tight">
            {title}
          </h1>
          <p className="font-body text-sm sm:text-[15px] text-[#647B8A] mt-2 leading-relaxed max-w-[340px] mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Form Components */}
        <div>{children}</div>

        {/* Footer links */}
        {footer}
      </div>
    </div>
  );
}
