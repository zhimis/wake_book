import { Card, CardContent } from "@/components/ui/card";
import BookingCalendar from "@/components/booking-calendar";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

const HomePage = () => {
  const [location] = useLocation();
  const [calendarKey, setCalendarKey] = useState(0);
  const mountRef = useRef(false);
  
  // Track if we're coming from the confirmation page to force a refresh
  const wasMounted = useRef(false);
  
  // Check if we have a refresh parameter in the URL
  useEffect(() => {
    const hasRefreshParam = location.includes('refresh=');
    
    if (!wasMounted.current) {
      console.log("HomePage: First time mounting, initializing...");
      wasMounted.current = true;
      
      // Even on first mount, check for refresh parameter
      if (hasRefreshParam) {
        console.log("HomePage: Detected refresh parameter on first mount, will force refresh");
        forceCalendarRefresh();
      }
    } else if (hasRefreshParam) {
      console.log("HomePage: Returning from confirmation with refresh parameter");
      forceCalendarRefresh();
    } else {
      console.log("HomePage: Navigation detected without refresh parameter");
    }
  }, [location]);
  
  // Helper function to force a calendar refresh
  const forceCalendarRefresh = () => {
    try {
      // Clear cache completely and immediately
      console.log("HomePage: REMOVING all time slots queries from cache");
      queryClient.removeQueries({ queryKey: ['/api/timeslots'] });
      
      // Prefetch new data immediately
      console.log("HomePage: Prefetching fresh time slot data");
      queryClient.prefetchQuery({
        queryKey: ['/api/timeslots'],
        queryFn: async () => {
          console.log("HomePage: Making direct API call to /api/timeslots");
          const res = await fetch('/api/timeslots');
          if (!res.ok) {
            console.error("HomePage: Error fetching time slots:", res.status);
            throw new Error('Failed to fetch time slots');
          }
          const data = await res.json();
          console.log("HomePage: Received fresh time slots data:", data.timeSlots?.length || 0, "slots");
          return data;
        }
      }).then(() => {
        // Force immediate remount once data is loaded
        console.log("HomePage: Data loaded, forcing calendar remount");
        setTimeout(() => setCalendarKey(prev => prev + 1), 50);
      }).catch(err => {
        console.error("HomePage: Error prefetching time slots:", err);
      });
    } catch (error) {
      console.error("HomePage: Error in force refresh:", error);
    }
  };
  
  // Continue listening for booking update events
  useEffect(() => {
    interface BookingUpdatedEvent extends Event {
      detail?: {
        bookingId?: number;
        reference?: string;
        action?: string;
        timestamp?: number;
      };
    }
    
    const handleBookingUpdate = (event: BookingUpdatedEvent) => {
      console.log("🔄 BookingUpdated event received", event.detail);
      
      // Directly trigger full cache reset and remount 
      try {
        console.log("Event handler: Clearing and refetching time slots data");
        
        // Clear existing cache
        queryClient.removeQueries({ queryKey: ['/api/timeslots'] });
        
        // Force immediate remount with new key
        setCalendarKey(prev => prev + 1);
      } catch (error) {
        console.error("Error handling booking update event:", error);
      }
    };
    
    // Add event listener
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