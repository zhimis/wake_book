import { Card, CardContent } from "@/components/ui/card";
import WeatherWidget from "@/components/weather-widget";
import BookingCalendar from "@/components/booking-calendar";

const HomePage = () => {
  return (
    <main className="container mx-auto px-4 py-6 md:py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Hi Wake 2.0 Booking</h1>
        <p className="text-center mb-8">Book your wakeboarding session at Adazi, Latvia's premier facility</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <BookingCalendar />
          </div>
          
          <div>
            <WeatherWidget />
            
            <div className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-3">Facility Information</h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Opening Hours</h4>
                      <p className="text-gray-600 text-sm">Monday-Friday: 9am - 8pm</p>
                      <p className="text-gray-600 text-sm">Saturday-Sunday: 8am - 10pm</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Contact</h4>
                      <p className="text-gray-600 text-sm">Phone: +371 26 123 456</p>
                      <p className="text-gray-600 text-sm">Email: info@hiwake.lv</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-blue-800 font-medium text-sm mb-2">Booking Instructions</h4>
              <ul className="text-blue-700 text-xs space-y-1">
                <li>• Select consecutive time slots for your session</li>
                <li>• Prices vary based on time of day and weekends</li>
                <li>• Green slots are available for booking</li>
                <li>• Yellow slots are temporarily reserved</li>
                <li>• Red slots are already booked</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
