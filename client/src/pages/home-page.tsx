import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Clock } from "lucide-react";
import WeatherWidget from "@/components/weather-widget";

// Simplified booking calendar component
const BookingCalendar = () => {
  const [selected, setSelected] = useState<string | null>(null);
  
  const timeSlots = [
    { id: "1", time: "09:00 - 10:00", available: true },
    { id: "2", time: "10:00 - 11:00", available: true },
    { id: "3", time: "11:00 - 12:00", available: false },
    { id: "4", time: "12:00 - 13:00", available: true },
    { id: "5", time: "13:00 - 14:00", available: true },
    { id: "6", time: "14:00 - 15:00", available: false },
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <CalendarIcon className="mr-2 h-5 w-5" />
              Select Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {timeSlots.map(slot => (
                <Button 
                  key={slot.id}
                  variant={selected === slot.id ? "default" : "outline"}
                  disabled={!slot.available}
                  className="flex justify-between items-center"
                  onClick={() => setSelected(slot.id)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  <span>{slot.time}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div>
        <WeatherWidget />
      </div>
    </div>
  );
};

const HomePage = () => {
  return (
    <main className="container mx-auto px-4 py-6 md:py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Hi Wake 2.0 Booking</h1>
        <p className="text-center mb-8">Book your wakeboarding session at Adazi, Latvia's premier facility</p>
        
        <BookingCalendar />
        
        <div className="mt-8 grid gap-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-4">Facility Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Opening Hours</h4>
                  <p className="text-gray-600">Monday-Friday: 9am - 8pm</p>
                  <p className="text-gray-600">Saturday-Sunday: 8am - 10pm</p>
                </div>
                <div>
                  <h4 className="font-medium">Contact</h4>
                  <p className="text-gray-600">Phone: +371 26 123 456</p>
                  <p className="text-gray-600">Email: info@hiwake.lv</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
