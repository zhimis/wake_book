import { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  ReactNode,
  useEffect
} from "react";
import { TimeSlot } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  
  // Release time slots mutation
  const releaseTimeSlotsMutation = useMutation({
    mutationFn: async (timeSlotIds: number[]) => {
      const res = await apiRequest("POST", "/api/timeslots/release", { timeSlotIds });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
    }
  });
  
  // Check for consecutive slots
  const areConsecutiveSlots = useCallback((slots: TimeSlot[]): boolean => {
    if (slots.length <= 1) return true;
    
    // Sort slots by start time
    const sortedSlots = [...slots].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    // Check if each slot's end time matches the next slot's start time
    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const currentEndTime = new Date(sortedSlots[i].endTime).getTime();
      const nextStartTime = new Date(sortedSlots[i + 1].startTime).getTime();
      
      if (currentEndTime !== nextStartTime) {
        return false;
      }
    }
    
    return true;
  }, []);
  
  // Toggle time slot selection
  const toggleTimeSlot = useCallback((timeSlot: TimeSlot) => {
    setSelectedTimeSlots(prev => {
      // Check if the slot is already selected
      const isSelected = prev.some(slot => slot.id === timeSlot.id);
      
      if (isSelected) {
        // Remove from selection
        const newSelection = prev.filter(slot => slot.id !== timeSlot.id);
        
        // If we have reserved slots and now removing one
        if (reservationExpiry && newSelection.length !== prev.length) {
          // If there are still slots selected, check if we need to release this one
          if (newSelection.length > 0) {
            releaseTimeSlotsMutation.mutate([timeSlot.id]);
          }
        }
        
        return newSelection;
      } else {
        // Only add if the slot is available
        if (timeSlot.status !== 'available' && !isSelected) {
          return prev;
        }
        
        // Add to selection
        const newSelection = [...prev, timeSlot];
        
        // Check if the selection is consecutive
        if (!areConsecutiveSlots(newSelection)) {
          toast({
            title: "Invalid Selection",
            description: "You can only select consecutive time slots.",
            variant: "warning",
          });
          return prev;
        }
        
        return newSelection;
      }
    });
  }, [reservationExpiry, releaseTimeSlotsMutation, areConsecutiveSlots, toast]);
  
  // Clear selected time slots
  const clearSelectedTimeSlots = useCallback(() => {
    if (selectedTimeSlots.length > 0 && reservationExpiry) {
      // Release reserved time slots
      const timeSlotIds = selectedTimeSlots.map(slot => slot.id);
      releaseTimeSlotsMutation.mutate(timeSlotIds);
    }
    
    setSelectedTimeSlots([]);
    setReservationExpiry(null);
  }, [selectedTimeSlots, reservationExpiry, releaseTimeSlotsMutation]);
  
  // Handle expired reservations
  useEffect(() => {
    if (reservationExpiry && new Date() > new Date(reservationExpiry)) {
      clearSelectedTimeSlots();
    }
  }, [reservationExpiry, clearSelectedTimeSlots]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (selectedTimeSlots.length > 0 && reservationExpiry) {
        const timeSlotIds = selectedTimeSlots.map(slot => slot.id);
        releaseTimeSlotsMutation.mutate(timeSlotIds);
      }
    };
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
