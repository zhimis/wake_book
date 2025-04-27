import { Switch, Route } from "wouter";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import Header from "./components/header";
import Footer from "./components/footer";

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <div className="flex-grow">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/admin/login">
            <div className="container mx-auto p-8">
              <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
              <p>The admin section is under maintenance.</p>
            </div>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
      <Footer />
    </div>
  );
}

export default App;
