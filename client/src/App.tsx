import { Switch, Route, useLocation } from "wouter";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import BookingPage from "@/pages/booking-page";
import ConfirmationPage from "@/pages/confirmation-page";
import AdminLoginPage from "@/pages/admin-login-page";
import AdminPage from "@/pages/admin-page";
import AdminDashboardPage from "@/pages/admin-dashboard-page";
import AdminBookingsPage from "@/pages/admin-bookings-page";
import AdminUsersPage from "@/pages/admin-users-page";
import AdminStatisticsPage from "@/pages/admin-statistics-page";
import AdminFeedbackPage from "@/pages/admin-feedback-page";
import PublicPage from "@/pages/public-page";
import NewAdminPage from "@/pages/new-admin-page";
import SystemConfigPage from "@/pages/system-config-page";
import PricesPage from "@/pages/prices-page";
import ContactsPage from "@/pages/contacts-page";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import DebugPage from "@/pages/debug";

import Header from "./components/header";
import Footer from "./components/footer";
import { FeedbackButton } from "./components/feedback-button";
import { AdminQuickBookingButton } from "./components/admin/admin-quick-booking-button";
import { BookingProvider } from "./context/booking-context";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { useEffect } from "react";

function App() {
  const [location, navigate] = useLocation();
  
  // Handle /admin URL with tab parameter
  useEffect(() => {
    if (location === "/admin") {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab");
      
      if (tab) {
        // Don't use localStorage, instead directly navigate to the proper URL
        // to avoid an infinite loop between AdminPage and App.tsx
        navigate(`/admin/dashboard?activeTab=${tab}`);
      } else {
        // Only redirect if no tab parameter is specified
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
              <Route path="/public" component={PublicPage} />
              <Route path="/prices" component={PricesPage} />
              <Route path="/contacts" component={ContactsPage} />
              <Route path="/auth" component={AuthPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/admin/login" component={AdminLoginPage} />
              <ProtectedRoute path="/admin" component={AdminPage} />
              <ProtectedRoute path="/admin/dashboard" component={AdminDashboardPage} />
              <ProtectedRoute path="/admin/bookings" component={AdminBookingsPage} />
              <ProtectedRoute path="/admin/users" component={AdminUsersPage} />
              <ProtectedRoute path="/admin/statistics" component={AdminStatisticsPage} />
              <ProtectedRoute path="/admin/feedback" component={AdminFeedbackPage} />
              <ProtectedRoute path="/admin/new" component={NewAdminPage} />
              <ProtectedRoute path="/admin/system-config" component={SystemConfigPage} />
              <ProtectedRoute path="/admin/debug" component={DebugPage} />
              <Route path="/:rest*" component={NotFound} />
            </Switch>
          </div>
          <Footer />
          <FeedbackButton />
          <AdminQuickBookingButton />
        </BookingProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
