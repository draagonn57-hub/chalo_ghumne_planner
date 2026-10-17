import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function GoogleSignInButton({ onResponse, text = "continue_with", disabled = false }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const clientId =
      process.env.REACT_APP_GOOGLE_CLIENT_ID ||
      "your-google-client-id.apps.googleusercontent.com";

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
  }, [onResponse, text]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        id="google-signin-btn"
        data-testid="google-signin-btn"
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

export function Login() {
  const { login, setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const next = new URLSearchParams(loc.search).get("next") || "/dashboard";
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

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
        nav("/dashboard");
      } catch (err) {
        console.error("Google login error:", err);
        toast.error(err?.response?.data?.detail || "Google sign-in failed");
      } finally {
        setGoogleBusy(false);
      }
    },
    [nav, setUser]
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back");
      nav(next);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue planning your next journey.">
      <GoogleSignInButton onResponse={handleGoogleSuccess} text="continue_with" disabled={googleBusy} />

      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="login-email" />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="login-password" />
        <button className="btn-primary w-full" disabled={busy || googleBusy} data-testid="login-submit">{busy ? "Signing in…" : "Sign in"}</button>
        <div className="flex items-center justify-between text-sm pt-2">
          <Link to="/forgot" className="text-[#0D5C75] hover:underline" data-testid="link-forgot">Forgot password?</Link>
          <Link to="/signup" className="text-[#0D5C75] hover:underline" data-testid="link-signup">Create account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { signup, setUser } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

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

        toast.success(`Account ready! Welcome, ${data.user?.name || "Traveler"}!`);
        nav("/dashboard");
      } catch (err) {
        console.error("Google signup error:", err);
        toast.error(err?.response?.data?.detail || "Google signup failed");
      } finally {
        setGoogleBusy(false);
      }
    },
    [nav, setUser]
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signup(form.name, form.email, form.password);
      toast.success("Account created");
      nav("/plan");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Begin your journey" subtitle="Create a free account to save trips and access your history.">
      <GoogleSignInButton onResponse={handleGoogleSuccess} text="signup_with" disabled={googleBusy} />

      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="signup-name" />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="signup-email" />
        <Field label="Password (min 6 chars)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="signup-password" />
        <button className="btn-primary w-full" disabled={busy || googleBusy} data-testid="signup-submit">{busy ? "Creating…" : "Create account"}</button>
        <p className="text-sm text-center text-slate-500 pt-2">Already have an account? <Link to="/login" className="text-[#0D5C75] hover:underline" data-testid="link-login">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      if (data.reset_token) setResetToken(data.reset_token);
      toast.success(data.message);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send a reset link.">
      <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
        <Field label="Email" type="email" value={email} onChange={setEmail} testid="forgot-email" />
        <button className="btn-primary w-full" disabled={busy} data-testid="forgot-submit">{busy ? "Sending…" : "Send reset link"}</button>
      </form>
      {resetToken && (
        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm" data-testid="reset-token-box">
          <div className="font-semibold text-amber-900">DEV MODE — email is MOCKED</div>
          <div className="mt-2 text-amber-800">Your reset token (paste on the reset page):</div>
          <code className="mt-2 block break-all bg-white p-2 rounded" data-testid="reset-token-value">{resetToken}</code>
          <Link to={`/reset?token=${resetToken}`} className="inline-block mt-3 text-[#0D5C75] font-semibold hover:underline" data-testid="use-token-link">Use this token →</Link>
        </div>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const loc = useLocation();
  const nav = useNavigate();
  const [token, setToken] = useState(new URLSearchParams(loc.search).get("token") || "");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pwd });
      toast.success("Password reset. Sign in.");
      nav("/login");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Paste your reset token and choose a new password.">
      <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
        <Field label="Reset token" value={token} onChange={setToken} testid="reset-token" />
        <Field label="New password" type="password" value={pwd} onChange={setPwd} testid="reset-password" />
        <button className="btn-primary w-full" disabled={busy} data-testid="reset-submit">{busy ? "Saving…" : "Reset password"}</button>
      </form>
    </AuthLayout>
  );
}

function Field({ label, type = "text", value, onChange, testid }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} required
        data-testid={testid}
        className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none transition-colors"
      />
    </label>
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
