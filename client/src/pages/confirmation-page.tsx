import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatTimeSlot, formatPrice, toLatviaTime, formatInLatviaTime } from "@/lib/utils";
import { CheckCircle, Calendar, Map, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ConfirmationPage = () => {
  const { reference } = useParams();
  const [, navigate] = useLocation();
  
  // Fetch booking details
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/bookings/${reference}`],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${reference}`);
      if (!res.ok) throw new Error('Failed to fetch booking');
      return res.json();
    }
  });
  
  // Add to calendar functionality
  const handleAddToCalendar = () => {
    if (!data) return;
    
    const timeSlots = data.timeSlots;
    if (timeSlots.length === 0) return;
    
    // Sort time slots by start time
    const sortedSlots = [...timeSlots].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    // Convert to Latvia time for display in calendar
    const startTime = toLatviaTime(new Date(firstSlot.startTime));
    const endTime = toLatviaTime(new Date(lastSlot.endTime));
    
    // Create Google Calendar URL
    const title = `Wakeboarding Session - HiWake 2.0`;
    const details = `Booking Reference: ${data.booking.reference}\nName: ${data.booking.customerName}\nPhone: ${data.booking.phoneNumber}\nEquipment Rental: ${data.booking.equipmentRental ? 'Yes' : 'No'}`;
    const location = 'Pulksteņezers, 2163 Ādaži Siguļi, Carnikava, LV-2163';
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')}/${endTime.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '')}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    
    window.open(googleCalendarUrl, '_blank');
  };
  
  const handleReturnToHome = () => {
    navigate("/");
  };
  
  // If loading
  if (isLoading) {
    return (
      <main className="container mx-auto px-0.5 py-2">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-2">
              <div className="text-center mb-6">
                <Skeleton className="w-16 h-16 mx-auto rounded-full mb-4" />
                <Skeleton className="h-8 w-48 mx-auto mb-2" />
                <Skeleton className="h-4 w-64 mx-auto" />
              </div>
              <Skeleton className="h-64 w-full mb-6" />
              <Skeleton className="h-8 w-full mb-3" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }
  
  // If error or no data
  if (error || !data) {
    return (
      <main className="container mx-auto px-0.5 py-2">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-2 text-center">
              <h2 className="text-2xl font-heading font-bold text-gray-800 mb-4">Booking Not Found</h2>
              <p className="text-gray-600 mb-6">
                The booking reference you provided was not found or there was an error fetching the booking details.
              </p>
              <Button onClick={handleReturnToHome}>
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }
  
  const { booking, timeSlots, totalPrice } = data;
  
  // Sort time slots by start time
  const sortedTimeSlots = [...timeSlots].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  
  // Format times for display - using Latvia timezone
  const bookingDate = sortedTimeSlots.length > 0 ? formatDate(toLatviaTime(sortedTimeSlots[0].startTime)) : '';
  const bookingTime = sortedTimeSlots.length > 0 ? 
    formatTimeSlot(
      toLatviaTime(sortedTimeSlots[0].startTime), 
      toLatviaTime(sortedTimeSlots[sortedTimeSlots.length - 1].endTime)
    ) : '';
  
  return (
    <main className="container mx-auto px-0.5 py-2">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-2">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-success bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-gray-800 mb-2">Booking Confirmed!</h2>
              <p className="text-gray-600">Your wakeboarding session has been successfully booked.</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-heading font-semibold text-lg mb-3">Booking Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking Reference:</span>
                  <span className="font-medium">{booking.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{booking.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{bookingDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium">{bookingTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Equipment Rental:</span>
                  <span className="font-medium">{booking.equipmentRental ? 'Yes (+$30)' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold">{formatPrice(totalPrice)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-primary mt-0.5 mr-2" />
                <p className="text-sm text-gray-600">
                  A confirmation email has been sent to your email address. Please arrive 15 minutes before your session to complete check-in.
                </p>
              </div>
              <div className="flex items-start">
                <Map className="h-5 w-5 text-primary mt-0.5 mr-2" />
                <p className="text-sm text-gray-600">
                  Our wakeboarding park is located at Pulksteņezers, 2163 Ādaži Siguļi, Carnikava, LV-2163. Free parking is available on site.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col space-y-3">
              <Button
                className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                onClick={handleAddToCalendar}
              >
                <Calendar className="h-5 w-5 mr-2" />
                Add to Calendar
              </Button>
              <Button
                variant="outline"
                onClick={handleReturnToHome}
              >
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ConfirmationPage;
