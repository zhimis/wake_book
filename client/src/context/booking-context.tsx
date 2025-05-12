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
  toggleTimeSlot: (timeSlot: TimeSlot) => void;
  clearSelectedTimeSlots: () => void;
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  
  // Toggle time slot selection - with cross-date protection
  const toggleTimeSlot = useCallback((timeSlot: TimeSlot) => {
    console.log(`[BOOKING DEBUG] Toggle slot: ${timeSlot.id}, date: ${new Date(timeSlot.startTime).toLocaleString()}`);
    
    setSelectedTimeSlots(prev => {
      // Check if the slot is already selected
      const isSelected = prev.some(slot => slot.id === timeSlot.id);
      
      if (isSelected) {
        // Remove from selection
        console.log(`[BOOKING DEBUG] Removing slot from selection: ${timeSlot.id}`);
        return prev.filter(slot => slot.id !== timeSlot.id);
      } else {
        // Add to selection
        console.log(`[BOOKING DEBUG] Adding slot to selection: ${timeSlot.id}`);
        
        // CRITICAL FIX: Enforce single-date bookings
        // Check if the date is different from already selected slots
        if (prev.length > 0) {
          const existingDate = new Date(prev[0].startTime).toDateString();
          const newDate = new Date(timeSlot.startTime).toDateString();
          
          if (existingDate !== newDate) {
            console.log(`[BOOKING DEBUG] ERROR: Preventing selection from different date!`);
            console.log(`[BOOKING DEBUG] Existing slots date: ${existingDate}`);
            console.log(`[BOOKING DEBUG] New slot date: ${newDate}`);
            
            // We don't allow mixing dates - show a toast message in the future
            // For now, just log the error and don't add the slot
            return prev;
          }
        }
        
        return [...prev, timeSlot];
      }
    });
  }, []);
  
  // Clear selected time slots
  const clearSelectedTimeSlots = useCallback(() => {
    setSelectedTimeSlots([]);
  }, []);
  
  return (
    <BookingContext.Provider
      value={{
        selectedTimeSlots,
        toggleTimeSlot,
        clearSelectedTimeSlots
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
