import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { TimeSlot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useBookings() {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const { toast } = useToast();
  
  // Fetch time slots for the current week
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/timeslots'],
    queryFn: async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 6);
      
      const res = await fetch(`/api/timeslots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!res.ok) throw new Error('Failed to fetch time slots');
      return res.json();
    }
  });
  
  // Clear selected time slots
  const clearSelectedTimeSlots = useCallback(() => {
    setSelectedTimeSlots([]);
  }, []);
  
  // Toggle time slot selection
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
  
  return {
    timeSlots: data?.timeSlots || [],
    isLoading,
    error,
    selectedTimeSlots,
    toggleTimeSlot,
    clearSelectedTimeSlots
  };
}
