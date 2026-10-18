import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function GoogleSignInButton({ onResponse, text = "continue_with", disabled = false, hideDivider = false }) {
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

      {!hideDivider && (
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
      )}
    </div>
  );
}

export function AppleSignInButton({ onResponse, text = "continue_with", disabled = false, hideDivider = true }) {
  const [busy, setBusy] = useState(false);

  // Configuration with placeholders matching requirements
  const clientId =
    process.env.APPLE_CLIENT_ID ||
    process.env.REACT_APP_APPLE_CLIENT_ID ||
    "com.chaloghumne.web.service";

  const redirectURI =
    process.env.APPLE_REDIRECT_URI ||
    process.env.REACT_APP_APPLE_REDIRECT_URI ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/apple/callback`
      : "https://chaloghumne.com/api/auth/apple/callback");

  const scope = "name email";

  useEffect(() => {
    const initApple = () => {
      if (window.AppleID?.auth) {
        try {
          window.AppleID.auth.init({
            clientId: clientId,
            scope: scope,
            redirectURI: redirectURI,
            state: "apple_auth_state",
            usePopup: true,
          });
        } catch (e) {
          console.warn("AppleID auth init note:", e);
        }
      }
    };

    if (window.AppleID?.auth) {
      initApple();
    } else {
      if (!document.querySelector('script[src*="appleid.auth.js"]')) {
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src =
          "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
        script.async = true;
        script.onload = initApple;
        document.head.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (window.AppleID?.auth) {
            clearInterval(interval);
            initApple();
          }
        }, 150);
        return () => clearInterval(interval);
      }
    }
  }, [clientId, redirectURI, scope]);

  // Handle official Apple custom events and window postMessage
  useEffect(() => {
    const handleSuccessEvent = async (event) => {
      if (event.detail && onResponse) {
        try {
          setBusy(true);
          await onResponse(event.detail);
        } catch (err) {
          console.error("Apple sign-in handler error:", err);
        } finally {
          setBusy(false);
        }
      }
    };

    const handleFailureEvent = (event) => {
      console.warn("Apple sign-in failure event:", event.detail);
      const err = event.detail?.error;
      if (err && err !== "popup_closed_by_user" && err !== "user_cancelled_authorize") {
        toast.error(err || "Apple sign-in failed");
      }
    };

    const handleWindowMessage = async (event) => {
      if (event.data?.type === "APPLE_AUTH_SUCCESS") {
        if (onResponse) {
          try {
            setBusy(true);
            await onResponse(event.data);
          } finally {
            setBusy(false);
          }
        }
      } else if (event.data?.type === "APPLE_AUTH_ERROR") {
        toast.error(event.data.error || "Apple sign-in failed");
      }
    };

    document.addEventListener("AppleIDSignInOnSuccess", handleSuccessEvent);
    document.addEventListener("AppleIDSignInOnFailure", handleFailureEvent);
    window.addEventListener("message", handleWindowMessage);

    return () => {
      document.removeEventListener("AppleIDSignInOnSuccess", handleSuccessEvent);
      document.removeEventListener("AppleIDSignInOnFailure", handleFailureEvent);
      window.removeEventListener("message", handleWindowMessage);
    };
  }, [onResponse]);

  const handleClick = async () => {
    if (disabled || busy) return;

    if (!window.AppleID?.auth) {
      toast.info("Connecting to Apple Identity Services...");
      return;
    }

    try {
      setBusy(true);
      const response = await window.AppleID.auth.signIn();
      if (onResponse) {
        await onResponse(response);
      }
    } catch (err) {
      console.warn("Apple sign-in response / error:", err);
      const errorMsg = err?.error || err?.message;
      if (
        errorMsg === "popup_closed_by_user" ||
        errorMsg === "user_cancelled_authorize"
      ) {
        toast.info("Apple sign-in was cancelled");
      } else {
        toast.error(errorMsg || "Apple sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const isSignup = text === "signup_with";

  return (
    <div className="w-full">
      <div
        id="apple-signin-btn"
        data-testid="apple-signin-btn"
        className="w-full flex justify-center min-h-[44px]"
      >
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-colors text-slate-700 font-medium text-sm shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="apple-signin-button"
        >
          {/* Apple Logo SVG */}
          <svg
            className="w-5 h-5 flex-shrink-0 fill-current text-black"
            viewBox="0 0 170 170"
            aria-hidden="true"
          >
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.74 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.33-6.95-10.45-12.33-22.18-16.14-35.18-3.81-13-5.72-24.89-5.72-35.68 0-14.89 3.8-27.24 11.39-37.07 7.6-9.83 17.1-14.84 28.5-15.02 5.09 0 10.49 1.32 16.2 3.96 5.71 2.64 9.72 4.02 12.02 4.14 1.84 0 6.07-1.44 12.69-4.32 6.62-2.88 12.19-4.13 16.71-3.75 12.56.88 22.47 5.76 29.73 14.64-10.98 6.64-16.35 15.82-16.12 27.54.23 9.4 3.86 17.18 10.9 23.33 7.04 6.16 15.34 9.77 24.9 10.84-2.18 6.62-4.87 13.52-8.08 20.7zM119.22 31.84c0-7.72 2.76-14.89 8.28-21.52 5.53-6.63 12.27-10.32 20.24-11.08.11 1.09.16 2.06.16 2.92 0 7.6-2.94 14.88-8.82 21.84-5.88 6.96-12.72 10.63-20.52 11.02-.22-1.09-.34-2.15-.34-3.18z" />
          </svg>
          <span>
            {busy || disabled
              ? "Signing in…"
              : isSignup
              ? "Sign up with Apple"
              : "Continue with Apple"}
          </span>
        </button>
      </div>

      {!hideDivider && (
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
      )}
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
  const [appleBusy, setAppleBusy] = useState(false);

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
        nav(next);
      } catch (err) {
        console.error("Google login error:", err);
        toast.error(err?.response?.data?.detail || "Google sign-in failed");
      } finally {
        setGoogleBusy(false);
      }
    },
    [nav, next, setUser]
  );

  const handleAppleSuccess = useCallback(
    async (response) => {
      try {
        setAppleBusy(true);
        if (response?.token && response?.user) {
          localStorage.setItem("tp_token", response.token);
          if (setUser) setUser(response.user);
          toast.success(`Welcome back, ${response.user?.name || "Traveler"}!`);
          nav(next);
          return;
        }

        const idToken =
          response?.authorization?.id_token ||
          response?.id_token ||
          response?.credential ||
          response?.token;

        if (!idToken) {
          toast.error("Apple sign-in did not return a credential");
          return;
        }

        const payload = {
          id_token: idToken,
          code: response?.authorization?.code || response?.code,
          state: response?.authorization?.state || response?.state,
          user: response?.user,
        };

        const { data } = await api.post("/auth/apple/callback", payload);

        localStorage.setItem("tp_token", data.token);
        if (setUser) setUser(data.user);

        toast.success(`Welcome back, ${data.user?.name || "Traveler"}!`);
        nav(next);
      } catch (err) {
        console.error("Apple login error:", err);
        toast.error(err?.response?.data?.detail || "Apple sign-in failed");
      } finally {
        setAppleBusy(false);
      }
    },
    [nav, next, setUser]
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
      <div className="space-y-3">
        <GoogleSignInButton onResponse={handleGoogleSuccess} text="continue_with" disabled={googleBusy || appleBusy} hideDivider />
        <AppleSignInButton onResponse={handleAppleSuccess} text="continue_with" disabled={googleBusy || appleBusy} />
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

      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="login-email" />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="login-password" />
        <button className="btn-primary w-full" disabled={busy || googleBusy || appleBusy} data-testid="login-submit">{busy ? "Signing in…" : "Sign in"}</button>
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
  const [appleBusy, setAppleBusy] = useState(false);

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

  const handleAppleSuccess = useCallback(
    async (response) => {
      try {
        setAppleBusy(true);
        if (response?.token && response?.user) {
          localStorage.setItem("tp_token", response.token);
          if (setUser) setUser(response.user);
          toast.success(`Account ready! Welcome, ${response.user?.name || "Traveler"}!`);
          nav("/plan");
          return;
        }

        const idToken =
          response?.authorization?.id_token ||
          response?.id_token ||
          response?.credential ||
          response?.token;

        if (!idToken) {
          toast.error("Apple sign-in did not return a credential");
          return;
        }

        const payload = {
          id_token: idToken,
          code: response?.authorization?.code || response?.code,
          state: response?.authorization?.state || response?.state,
          user: response?.user,
        };

        const { data } = await api.post("/auth/apple/callback", payload);

        localStorage.setItem("tp_token", data.token);
        if (setUser) setUser(data.user);

        toast.success(`Account ready! Welcome, ${data.user?.name || "Traveler"}!`);
        nav("/plan");
      } catch (err) {
        console.error("Apple signup error:", err);
        toast.error(err?.response?.data?.detail || "Apple signup failed");
      } finally {
        setAppleBusy(false);
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
      <div className="space-y-3">
        <GoogleSignInButton onResponse={handleGoogleSuccess} text="signup_with" disabled={googleBusy || appleBusy} hideDivider />
        <AppleSignInButton onResponse={handleAppleSuccess} text="signup_with" disabled={googleBusy || appleBusy} />
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

      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="signup-name" />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="signup-email" />
        <Field label="Password (min 6 chars)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="signup-password" />
        <button className="btn-primary w-full" disabled={busy || googleBusy || appleBusy} data-testid="signup-submit">{busy ? "Creating…" : "Create account"}</button>
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
