import { Switch, Route, useLocation } from "wouter";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import BookingPage from "@/pages/booking-page";
import ConfirmationPage from "@/pages/confirmation-page";
import AdminLoginPage from "@/pages/admin-login-page";
import AdminPage from "@/pages/admin-page";
import AdminDashboardPage from "@/pages/admin-dashboard-page";
import AdminBookingsPage from "@/pages/admin-bookings-page";
import Header from "./components/header";
import Footer from "./components/footer";
import { BookingProvider } from "./context/booking-context";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { useEffect } from "react";

function App() {
  const [location, navigate] = useLocation();
  
  // Redirect from /admin to /admin/dashboard for better UX
  useEffect(() => {
    if (location === "/admin") {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab");
      
      // Only redirect if no tab parameter is specified
      if (!tab) {
        navigate("/admin/dashboard");
      }
    }
  }, [location, navigate]);
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AuthProvider>
        <BookingProvider>
          <Header />
          <div className="flex-grow">
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/booking" component={BookingPage} />
              <Route path="/confirmation/:reference" component={ConfirmationPage} />
              <Route path="/admin/login" component={AdminLoginPage} />
              <ProtectedRoute path="/admin" component={AdminPage} />
              <ProtectedRoute path="/admin/dashboard" component={AdminDashboardPage} />
              <ProtectedRoute path="/admin/bookings" component={AdminBookingsPage} />
              <Route component={NotFound} />
            </Switch>
          </div>
          <Footer />
        </BookingProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
