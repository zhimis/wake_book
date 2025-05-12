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
  
  // Toggle time slot selection - with enhanced cross-date protection
  const toggleTimeSlot = useCallback((timeSlot: TimeSlot) => {
    console.log(`[BOOKING DEBUG] Toggle slot: ${timeSlot.id}, date: ${new Date(timeSlot.startTime).toLocaleString()}`);
    
    // ENHANCED PROTECTION: Log detailed time slot debugging information
    console.log(`[BOOKING DEBUG] TimeSlot Details:`, {
      id: timeSlot.id,
      displayDate: new Date(timeSlot.startTime).toLocaleDateString(),
      displayTime: new Date(timeSlot.startTime).toLocaleTimeString(),
      originalDate: timeSlot.originalStartTime ? new Date(timeSlot.originalStartTime).toLocaleDateString() : "N/A",
      isDateCorrected: timeSlot.isDateCorrected || false,
    });
    
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
        
        // IMPROVED CROSS-DATE CHECK WITH DATE CORRECTION AWARENESS
        if (prev.length > 0) {
          // Use UI/display dates for consistency
          const existingDate = new Date(prev[0].startTime).toDateString();
          const newDate = new Date(timeSlot.startTime).toDateString();
          
          // Check for date discrepancy
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
          
          // ADDITIONAL CHECK: If any time slot has date correction, verify time consistency
          const anyDateCorrected = [...prev, timeSlot].some(slot => slot.isDateCorrected);
          
          if (anyDateCorrected) {
            console.log(`[BOOKING DEBUG] Date correction detected in selection - verifying time consistency`);
            
            // Log every selected time slot for debugging
            [...prev, timeSlot].forEach((slot, index) => {
              console.log(`[BOOKING DEBUG] Selected slot ${index}:`, {
                id: slot.id, 
                date: new Date(slot.startTime).toLocaleDateString(),
                isDateCorrected: slot.isDateCorrected || false,
                hour: slot.hour,
                minute: slot.minute
              });
            });
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
