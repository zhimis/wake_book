import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import BookingPage from "@/pages/booking-page";
import ConfirmationPage from "@/pages/confirmation-page";
import AdminLoginPage from "@/pages/admin-login-page";
import AdminPage from "@/pages/admin-page";
import Header from "./components/header";
import Footer from "./components/footer";
import { BookingProvider } from "./context/booking-context";

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <BookingProvider>
        <Header />
        <div className="flex-grow">
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/booking" component={BookingPage} />
            <Route path="/confirmation/:reference" component={ConfirmationPage} />
            <Route path="/admin/login" component={AdminLoginPage} />
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </div>
        <Footer />
      </BookingProvider>
    </div>
  );
}

export default App;
