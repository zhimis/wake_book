import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  ReactNode
} from "react";
import { TimeSlot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { formatInLatviaTime } from "@/lib/utils";

type BookingContextType = {
  selectedTimeSlots: TimeSlot[];
  toggleTimeSlot: (timeSlot: TimeSlot) => void;
  clearSelectedTimeSlots: () => void;
};

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const { toast } = useToast();
  
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
            
            // Show a clear user-friendly toast message
            toast({
              title: "Only one day at a time",
              description: "You can only book time slots for a single day. Please complete this booking first or clear your selection.",
              variant: "destructive",
              duration: 5000
            });
            
            return prev;
          }
        }
        
        return [...prev, timeSlot];
      }
    });
  }, [toast]);
  
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
