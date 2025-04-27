import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay, isAfter, isBefore } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { TimeSlot, TimeSlotStatus } from "@shared/schema";
import CalendarDay from "./calendar-day";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBooking } from "@/context/booking-context";
import { groupTimeSlotsByDay } from "@/lib/utils";

interface BookingCalendarProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  isAdmin?: boolean;
}

const BookingCalendar = ({ onDateRangeChange, isAdmin = false }: BookingCalendarProps) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start from today or the beginning of the current week (Sunday)
    const today = new Date();
    return today;
  });
  
  const currentWeekEnd = addDays(currentWeekStart, 6);
  
  const { selectedTimeSlots, toggleTimeSlot } = useBooking();
  
  // Fetch time slots for the current week
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/timeslots', currentWeekStart.toISOString(), currentWeekEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/timeslots?startDate=${currentWeekStart.toISOString()}&endDate=${currentWeekEnd.toISOString()}`);
      if (!res.ok) throw new Error('Failed to fetch time slots');
      return res.json();
    }
  });
  
  useEffect(() => {
    if (onDateRangeChange) {
      onDateRangeChange(currentWeekStart, currentWeekEnd);
    }
  }, [currentWeekStart, currentWeekEnd, onDateRangeChange]);
  
  const handlePrevWeek = () => {
    setCurrentWeekStart(prevStart => addDays(prevStart, -7));
  };
  
  const handleNextWeek = () => {
    setCurrentWeekStart(prevStart => addDays(prevStart, 7));
  };
  
  // Group time slots by day
  const daySchedules = data ? groupTimeSlotsByDay(data.timeSlots) : [];
  
  // Check if the selected time slot is in the current calendar view
  const isTimeSlotSelected = (timeSlot: TimeSlot) => {
    return selectedTimeSlots.some(selected => selected.id === timeSlot.id);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-heading font-semibold text-gray-800">Select Date & Time</h3>
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handlePrevWeek}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-gray-600">
            {format(currentWeekStart, "MMMM d")} - {format(currentWeekEnd, "MMMM d, yyyy")}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleNextWeek}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap items-center text-sm mb-4 gap-x-4 gap-y-2">
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm slot-available bg-success bg-opacity-10 border border-success mr-1"></div>
          <span>Available</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm slot-booked bg-destructive bg-opacity-10 border border-destructive mr-1"></div>
          <span>Booked</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm slot-reserved bg-warning bg-opacity-10 border border-warning mr-1"></div>
          <span>Reserved</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 rounded-sm slot-selected bg-primary-light bg-opacity-20 border-2 border-primary mr-1"></div>
          <span>Selected</span>
        </div>
      </div>
      
      {/* Calendar Grid */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : error ? (
        <div className="text-destructive p-4 text-center">
          Error loading calendar. Please try again.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full">
            {/* Time column */}
            <div className="flex flex-col min-w-[3rem] border-r border-gray-200">
              <div className="h-10 flex items-center justify-center font-medium text-gray-500"></div>
              
              {/* Time slots */}
              {daySchedules.length > 0 && daySchedules[0].slots.map((slot, index) => (
                <div 
                  key={index}
                  className="h-12 flex items-center justify-center text-sm text-gray-600 border-t border-gray-200"
                >
                  {format(new Date(slot.startTime), "h:mm")}
                </div>
              ))}
            </div>
            
            {/* Day columns */}
            {daySchedules.map((day, index) => (
              <CalendarDay 
                key={index}
                day={day}
                onTimeSlotClick={toggleTimeSlot}
                isTimeSlotSelected={isTimeSlotSelected}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
