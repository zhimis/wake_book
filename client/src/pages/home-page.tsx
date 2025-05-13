import { Card, CardContent } from "@/components/ui/card";
import BookingCalendar from "@/components/booking-calendar";
import { useState, useEffect } from "react";

const HomePage = () => {
  // This key will force the BookingCalendar to remount when it changes
  const [calendarKey, setCalendarKey] = useState(0);
  
  // Use a custom event to refresh the calendar after bookings or cancellations
  useEffect(() => {
    // Type definition for our custom event
    interface BookingUpdatedEvent extends Event {
      detail?: {
        bookingId?: number;
        reference?: string;
        action?: string;
        timestamp?: number;
      };
    }
    
    // Enhanced event handler to refresh the calendar with detailed logging
    const handleBookingUpdate = (event: BookingUpdatedEvent) => {
      console.log("🔄 Booking update detected - refreshing calendar", event.detail);
      
      // Force a query invalidation to get the latest data
      try {
        // Try to access the query client without TypeScript errors
        const anyWindow = window as any;
        if (anyWindow.reactQueryClient) {
          console.log("Manually invalidating time slots data");
          anyWindow.reactQueryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
        }
      } catch (error) {
        console.error("Error accessing query client:", error);
      }
      
      // Force calendar to remount by changing its key
      setTimeout(() => {
        console.log("Forcing calendar remount");
        setCalendarKey(prev => prev + 1);
      }, 100);
    };
    
    // Add event listener with type assertion
    window.addEventListener('booking-updated', handleBookingUpdate as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('booking-updated', handleBookingUpdate as EventListener);
    };
  }, []);
  
  return (
    <main className="container mx-auto px-0.5 py-0">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-4">
            {/* Adding a key ensures the calendar fully remounts when data is refreshed */}
            <BookingCalendar key={calendarKey} />
          </div>

          <div className="w-full">
            <div>
              <Card>
                <CardContent className="pt-2 px-2">
                  <h3 className="text-lg font-semibold mb-2">
                    Kontaktinformācija
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm">Darba laiks</h4>
                      <p className="text-gray-600 text-xs">
                        Pagaidām strādājam pēc iepriekšēja pieraksta. Online
                        rezrvācija pieejama līdz 1 dienu pirms attiecīgās
                        dienas.
                        <br /> Ja online rezervācija nav pieejama, zvaniet uz
                        norādīto tālruni.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Kontakti</h4>
                      <p className="text-gray-600 text-xs">
                        Telefons: +371 25 422 219
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Cenas:</h4>
                      <p className="text-gray-600 text-xs">
                        Pavasarā/Off-peak: 20 eur / pusstundu <br />
                        Vasarā/Peak: 25 eur / pusstundu <br />
                        Hidras noma: 7 eur /stundu (5 eur / pusstundu)
                        <br />
                        Dēļa noma: 10 eur / stundu (7 eur / pusstundu)
                        <br />
                        Pirts + kabelis + ekipējums: 60 eur / stundu.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-blue-800 font-medium text-sm mb-1">
                Booking Instructions
              </h4>
              <ul className="text-blue-700 text-xs space-y-1">
                <li>• Select consecutive time slots</li>
                <li>• Prices vary by time and weekends</li>
                <li>• Green slots are available</li>
                <li>• Yellow slots are booked</li>
                <li>• Red slots are blocked</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;