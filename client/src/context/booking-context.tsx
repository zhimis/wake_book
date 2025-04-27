import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  ReactNode
} from "react";
import { TimeSlot } from "@shared/schema";

type BookingContextType = {
  selectedTimeSlots: TimeSlot[];
  reservationExpiry: Date | null;
  toggleTimeSlot: (timeSlot: TimeSlot) => void;
  clearSelectedTimeSlots: () => void;
  setReservationExpiry: (date: Date | null) => void;
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);
  
  // Toggle time slot selection - simplified version without toast
  const toggleTimeSlot = useCallback((timeSlot: TimeSlot) => {
    setSelectedTimeSlots(prev => {
      // Check if the slot is already selected
      const isSelected = prev.some(slot => slot.id === timeSlot.id);
      
      if (isSelected) {
        // Remove from selection
        return prev.filter(slot => slot.id !== timeSlot.id);
      } else {
        // Add to selection
        return [...prev, timeSlot];
      }
    });
  }, []);
  
  // Clear selected time slots
  const clearSelectedTimeSlots = useCallback(() => {
    setSelectedTimeSlots([]);
    setReservationExpiry(null);
  }, []);
  
  return (
    <BookingContext.Provider
      value={{
        selectedTimeSlots,
        reservationExpiry,
        toggleTimeSlot,
        clearSelectedTimeSlots,
        setReservationExpiry
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
