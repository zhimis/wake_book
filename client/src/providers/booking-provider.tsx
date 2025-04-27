import { createContext, useContext, useState, ReactNode } from 'react';

interface TimeSlot {
  id: number;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
}

interface BookingContextType {
  selectedTimeSlots: TimeSlot[];
  addTimeSlot: (timeSlot: TimeSlot) => void;
  removeTimeSlot: (timeSlotId: number) => void;
  clearTimeSlots: () => void;
}

const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);

  const addTimeSlot = (timeSlot: TimeSlot) => {
    setSelectedTimeSlots(prev => [...prev, timeSlot]);
  };

  const removeTimeSlot = (timeSlotId: number) => {
    setSelectedTimeSlots(prev => 
      prev.filter(slot => slot.id !== timeSlotId)
    );
  };

  const clearTimeSlots = () => {
    setSelectedTimeSlots([]);
  };

  return (
    <BookingContext.Provider 
      value={{ 
        selectedTimeSlots, 
        addTimeSlot, 
        removeTimeSlot, 
        clearTimeSlots 
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}