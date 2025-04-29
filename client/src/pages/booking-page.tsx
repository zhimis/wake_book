import { useEffect } from "react";
import { useLocation } from "wouter";
import { useBooking } from "@/context/booking-context";
import BookingForm from "@/components/booking-form";

const BookingPage = () => {
  const [, navigate] = useLocation();
  const { selectedTimeSlots } = useBooking();
  
  // Check if there are selected time slots without showing toast
  useEffect(() => {
    if (selectedTimeSlots.length === 0) {
      // Simply redirect back without showing notification
      navigate("/");
      return;
    }
  }, [selectedTimeSlots, navigate]);
  
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
