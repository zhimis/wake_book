import { Card, CardContent } from "@/components/ui/card";
import WeatherWidget from "@/components/weather-widget";
import BookingCalendar from "@/components/booking-calendar";

const HomePage = () => {
  return (
    <main className="container mx-auto px-4 py-0">
      <div className="max-w-6xl mx-auto">
        
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-4">
            <BookingCalendar />
          </div>
          
          <div className="w-full">
            <WeatherWidget />
            
            <div className="mt-4">
              <Card>
                <CardContent className="pt-4 px-3">
                  <h3 className="text-lg font-semibold mb-3">Facility Information</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Opening Hours</h4>
                      <p className="text-gray-600 text-xs">Monday-Friday: 8am - 10pm</p>
                      <p className="text-gray-600 text-xs">Saturday-Sunday: 8am - 10pm</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Contact</h4>
                      <p className="text-gray-600 text-xs">Phone: +371 26 123 456</p>
                      <p className="text-gray-600 text-xs">Email: info@hiwake.lv</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-blue-800 font-medium text-sm mb-2">Booking Instructions</h4>
              <ul className="text-blue-700 text-xs space-y-1">
                <li>• Select consecutive time slots</li>
                <li>• Prices vary by time and weekends</li>
                <li>• Green slots are available</li>
                <li>• Yellow slots are reserved</li>
                <li>• Red slots are booked</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
