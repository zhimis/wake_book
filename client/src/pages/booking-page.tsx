import { useEffect } from "react";
import { useLocation } from "wouter";
import { useBooking } from "@/context/booking-context";
import { useToast } from "@/hooks/use-toast";
import BookingForm from "@/components/booking-form";

const BookingPage = () => {
  const [, navigate] = useLocation();
  const { selectedTimeSlots, reservationExpiry } = useBooking();
  const { toast } = useToast();
  
  // Check if there are selected time slots and a valid reservation
  useEffect(() => {
    if (selectedTimeSlots.length === 0) {
      toast({
        title: "No Time Slots Selected",
        description: "Please select time slots from the calendar first.",
        variant: "warning",
      });
      navigate("/");
      return;
    }
    
    // Check if reservation has expired
    if (reservationExpiry && new Date(reservationExpiry) < new Date()) {
      toast({
        title: "Reservation Expired",
        description: "Your reservation has expired. Please select time slots again.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
  }, [selectedTimeSlots, reservationExpiry, navigate, toast]);
  
  const handleCancel = () => {
    navigate("/");
  };
  
  return (
    <main className="container mx-auto px-0.5 py-2">
      <BookingForm onCancel={handleCancel} />
    </main>
  );
};

export default BookingPage;
