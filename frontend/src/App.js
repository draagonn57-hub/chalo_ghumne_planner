import "@/App.css";
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

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import Landing from "@/pages/Landing";
import { Login, Signup, ForgotPassword, ResetPassword } from "@/pages/Auth";
import Questionnaire from "@/pages/Questionnaire";
import Suggestions from "@/pages/Suggestions";
import { ItineraryPreview, ItineraryDetail } from "@/pages/Itinerary";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Destinations from "@/pages/Destinations";
import Admin from "@/pages/Admin";

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
  return (
    <>
      <Navbar />

      <main className="min-h-[calc(100vh-5rem)]">
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

          {/* ==================== TRIP PLANNING ==================== */}

          <Route
            path="/plan"
            element={
              <RequireAuth>
                <Questionnaire />
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

      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LangProvider>
          <Toaster
            position="top-right"
            richColors
          />

          <Shell />
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}