import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TimeSlot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useBookings() {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);
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
  
  // Reserve time slots mutation
  const reserveTimeSlotsMutation = useMutation({
    mutationFn: async (timeSlotIds: number[]) => {
      const res = await apiRequest("POST", "/api/timeslots/reserve", { timeSlotIds });
      return await res.json();
    },
    onSuccess: (data) => {
      // Update reservation expiry
      setReservationExpiry(new Date(data.expiryTime));
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      
      toast({
        title: "Time Slots Selected",
        description: "Your selected time slots have been temporarily held for 10 minutes.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Selection Failed",
        description: error.message,
        variant: "destructive",
      });
      
      // Clear selected time slots on error
      setSelectedTimeSlots([]);
    }
  });
  
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
  
  // Clear selected time slots
  const clearSelectedTimeSlots = useCallback(() => {
    if (selectedTimeSlots.length > 0 && reservationExpiry) {
      // Release selected time slots
      const timeSlotIds = selectedTimeSlots.map(slot => slot.id);
      releaseTimeSlotsMutation.mutate(timeSlotIds);
    }
    
    setSelectedTimeSlots([]);
    setReservationExpiry(null);
  }, [selectedTimeSlots, reservationExpiry, releaseTimeSlotsMutation]);
  
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
  
  // Handle temporary hold for time slots when selection changes
  useEffect(() => {
    if (selectedTimeSlots.length > 0 && !reservationExpiry) {
      const timeSlotIds = selectedTimeSlots.map(slot => slot.id);
      reserveTimeSlotsMutation.mutate(timeSlotIds);
    }
  }, [selectedTimeSlots, reservationExpiry, reserveTimeSlotsMutation]);
  
  // Handle hold expiry
  useEffect(() => {
    if (reservationExpiry && new Date() > reservationExpiry) {
      clearSelectedTimeSlots();
      
      toast({
        title: "Selection Expired",
        description: "Your time slot selection has expired. Please select time slots again.",
        variant: "destructive",
      });
    }
  }, [reservationExpiry, clearSelectedTimeSlots, toast]);
  
  return {
    timeSlots: data?.timeSlots || [],
    isLoading,
    error,
    selectedTimeSlots,
    reservationExpiry,
    toggleTimeSlot,
    clearSelectedTimeSlots,
    setReservationExpiry
  };
}
