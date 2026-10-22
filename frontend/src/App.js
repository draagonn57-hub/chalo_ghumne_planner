import "@/App.css";
import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { LangProvider } from "@/lib/LangContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { captureUtm } from "@/lib/utmTracking";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DynamicBackground from "@/components/DynamicBackground";
import BackToTop from "@/components/BackToTop";
import ScrollProgressBar from "@/components/ScrollProgressBar";
import FloatingContact from "@/components/FloatingContact";
import CookieConsent from "@/components/CookieConsent";

import Landing from "@/pages/Landing";
import { Login, Signup, ForgotPassword, ResetPassword } from "@/pages/Auth";
import ModeSelect from "@/pages/ModeSelect";
import Questionnaire from "@/pages/Questionnaire";
import ManualDestination from "@/pages/ManualDestination";
import Suggestions from "@/pages/Suggestions";
import { ItineraryPreview, ItineraryDetail } from "@/pages/Itinerary";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Destinations from "@/pages/Destinations";
import Admin from "@/pages/Admin";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsAndConditions from "@/pages/TermsAndConditions";
import CookiePolicy from "@/pages/CookiePolicy";
import CancellationPolicy from "@/pages/CancellationPolicy";

// Booking system
import Booking from "@/pages/Booking";
import Checkout from "@/pages/Checkout";
import BookingConfirmation from "@/pages/BookingConfirmation";
import BookingDetail from "@/pages/BookingDetail";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null;

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${loc.pathname}`}
        replace
      />
    );
  }

  return children;
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function Shell() {
  const location = useLocation();
  const isLanding = location.pathname === "/";
  const isItineraryPage = location.pathname.startsWith("/itinerary");
  // Auth pages manage their own gradient overlay on top of the global background
  const isAuthPage = ["/login", "/signup", "/forgot", "/reset"].includes(location.pathname);

  // Capture UTM params on mount (Feature 13)
  useEffect(() => {
    captureUtm();
  }, []);

  return (
    <div className={`relative min-h-screen${isItineraryPage ? " itinerary-shell" : ""}`}
         style={isItineraryPage ? { background: "#EDE0CE" } : {}}>
      {/*
        Global cycling background — only shown on non-Landing, non-Itinerary, and non-Auth pages.
        Landing has its own DynamicBackground inside the hero section.
        Itinerary pages have botanical beige background via CSS module.
        Auth pages have dedicated snow mountain background.
      */}
      {!isLanding && !isItineraryPage && !isAuthPage && (
        <DynamicBackground
          mode="cycle"
          overlayClassName=""
          className="fixed"
        />
      )}

      {/* Scroll progress bar (Feature 7) */}
      <ScrollProgressBar />

      {/* All content renders above the background */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Skip-to-content link (Feature 11) — first focusable element */}
        <a href="#main-content" className="skip-link">Skip to content</a>

        {!isAuthPage && <Navbar />}
        {/* Cookie consent banner — shown until user makes a choice */}
        <CookieConsent />

        {/*
          - Landing: its own background inside the hero, solid white sections below — no global bg
          - Auth pages: dedicated full-viewport snow-covered mountain background with centered glass card
          - All other pages: glassy overlay so cycling bg shows through frosted glass
        */}
        <main id="main-content" className={isAuthPage ? "flex-1 min-h-screen" : "flex-1 min-h-[calc(100vh-5rem)]"}>
          <Routes>

          {/* ==================== PUBLIC ==================== */}

          <Route
            path="/"
            element={<Landing />}
          />

          <Route
            path="/destinations"
            element={<Destinations />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/signup"
            element={<Signup />}
          />

          <Route
            path="/forgot"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset"
            element={<ResetPassword />}
          />

          {/* ==================== LEGAL ==================== */}

          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/cancellation-policy" element={<CancellationPolicy />} />

          {/* ==================== TRIP PLANNING ==================== */}

          <Route
            path="/plan"
            element={
              <RequireAuth>
                <ModeSelect />
              </RequireAuth>
            }
          />

          <Route
            path="/plan/questionnaire"
            element={
              <RequireAuth>
                <Questionnaire />
              </RequireAuth>
            }
          />

          <Route
            path="/plan/choose"
            element={
              <RequireAuth>
                <ManualDestination />
              </RequireAuth>
            }
          />

          <Route
            path="/plan/recommended"
            element={
              <RequireAuth>
                <Suggestions mode="recommended" />
              </RequireAuth>
            }
          />

          <Route
            path="/itinerary/suggestions"
            element={
              <RequireAuth>
                <Suggestions />
              </RequireAuth>
            }
          />

          <Route
            path="/itinerary/preview"
            element={
              <RequireAuth>
                <ItineraryPreview />
              </RequireAuth>
            }
          />

          <Route
            path="/itinerary/:id"
            element={
              <RequireAuth>
                <ItineraryDetail />
              </RequireAuth>
            }
          />

          {/* ==================== USER ==================== */}

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          {/* ==================== ADMIN ==================== */}

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />

          {/* ==================== BOOKING ==================== */}

          {/* Start a new booking */}
          <Route
            path="/booking"
            element={
              <RequireAuth>
                <Booking />
              </RequireAuth>
            }
          />

          {/* Booking directly from an itinerary */}
          <Route
            path="/booking/itinerary/:itineraryId"
            element={
              <RequireAuth>
                <Booking />
              </RequireAuth>
            }
          />

          {/* Demo payment gateway */}
          <Route
            path="/booking/checkout"
            element={
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            }
          />

          {/* Successful booking confirmation */}
          <Route
            path="/booking/confirmation/:bookingId"
            element={
              <RequireAuth>
                <BookingConfirmation />
              </RequireAuth>
            }
          />

          {/* View an existing booking */}
          <Route
            path="/bookings/:bookingId"
            element={
              <RequireAuth>
                <BookingDetail />
              </RequireAuth>
            }
          />

          {/* ==================== FALLBACK ==================== */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
        </main>

        {!isAuthPage && <Footer />}
      </div>

      {/* Floating UI (Features 3, 18) — outside the main flow, always on top */}
      <BackToTop />
      <FloatingContact />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LangProvider>
          <ThemeProvider>
            <Toaster
              position="top-right"
              richColors
            />

            <Shell />
          </ThemeProvider>
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}