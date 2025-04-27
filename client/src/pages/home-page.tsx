import HeroSection from "@/components/hero-section";
import ParkFeatures from "@/components/park-features";

const HomePage = () => {
  return (
    <main className="container mx-auto px-4 py-6 md:py-8">
      <HeroSection />
      
      <div className="my-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Welcome to WakeBook</h2>
        <p>Your wakeboarding park booking system is being set up. Once completed, you'll be able to:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>View and select available time slots</li>
          <li>Make reservations for wakeboarding sessions</li>
          <li>Manage your bookings</li>
          <li>View weather forecasts</li>
        </ul>
      </div>
      
      <ParkFeatures />
    </main>
  );
};

export default HomePage;
