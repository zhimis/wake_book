import React, { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { TimeSlot, OperatingHours } from "@shared/schema";

export interface BaseCalendarProps {
  // For derived components to control behavior
  viewMode: 'public' | 'admin';
  
  // Optional render props for customization
  renderTimeCell?: (time: string, hour: number, minute: number) => React.ReactNode;
  renderSlotCell?: (
    slot: TimeSlot | null, 
    day: number, 
    time: string, 
    dayDate: Date, 
    hour: number, 
    minute: number
  ) => React.ReactNode;
  
  // Optional callbacks
  onSlotClick?: (slot: TimeSlot | null, day: number, hour: number, minute: number, dayDate: Date) => void;
  onDateChange?: (startDate: Date, endDate: Date) => void;

  // Optional props to control the initial date and behavior
  initialDate?: Date;
  fixedTimeRange?: { start: number; end: number };
}

export interface TimeSlotByDay {
  [key: number]: TimeSlot[];
}

const BaseCalendarGrid: React.FC<BaseCalendarProps> = ({
  viewMode,
  renderTimeCell,
  renderSlotCell,
  onSlotClick,
  onDateChange,
  initialDate = new Date(),
  fixedTimeRange
}) => {
  // State for calendar navigation
  const [currentDate, setCurrentDate] = useState(initialDate);
  
  // Calculate week start/end dates (using Monday as first day of week)
  const startDate = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return start;
  }, [currentDate]);
  
  const endDate = useMemo(() => {
    return endOfWeek(startDate, { weekStartsOn: 1 });
  }, [startDate]);

  // Notify parent when date range changes
  useEffect(() => {
    if (onDateChange) {
      onDateChange(startDate, endDate);
    }
  }, [startDate, endDate, onDateChange]);

  // Fetch time slots for the current week
  const { data: timeSlots, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['/api/timeslots', { startDate: startDate.toISOString(), endDate: endDate.toISOString() }],
    queryFn: async () => {
      console.log(`Fetching time slots from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const res = await fetch(`/api/timeslots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!res.ok) throw new Error('Failed to fetch time slots');
      return res.json();
    }
  });

  // Fetch operating hours and pricing rules
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['/api/config'],
    queryFn: async () => {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json();
    }
  });

  // Organize time slots by day of the week (0-6 where 0 is Monday in our case)
  const timeSlotsByDay: TimeSlotByDay = useMemo(() => {
    if (!timeSlots || !Array.isArray(timeSlots)) {
      console.log("No time slots available or not an array", timeSlots);
      return {};
    }
    
    console.log(`Processing ${timeSlots.length} time slots`);
    
    const slotsByDay: TimeSlotByDay = {};
    
    // Initialize empty arrays for each day of the week
    for (let i = 0; i < 7; i++) {
      slotsByDay[i] = [];
    }
    
    timeSlots.forEach((slot: TimeSlot) => {
      const slotDate = new Date(slot.startTime);
      // Calculate day of week (0-6), where 0 is Monday
      const dayOfWeek = (slotDate.getDay() + 6) % 7; // Convert Sunday(0) to 6, Monday(1) to 0, etc.
      
      slotsByDay[dayOfWeek].push(slot);
      
      // Log some details for debugging
      if (slot.status === 'available') {
        console.log(`Available slot: day=${dayOfWeek}, time=${format(slotDate, 'HH:mm')}, price=${slot.price}`);
      }
    });
    
    // Log summary of slots by day
    for (let i = 0; i < 7; i++) {
      console.log(`Day ${i} (${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}): ${slotsByDay[i].length} slots`);
    }
    
    return slotsByDay;
  }, [timeSlots]);

  // Generate array of days for the current week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDate, i));
    }
    return days;
  }, [startDate]);

  // Generate time slots for the grid
  const timeSlotGrid = useMemo(() => {
    if (!config || configLoading) return [];
    
    // Determine min/max hours from operating hours or use fixed range if provided
    let minHour = 24;
    let maxHour = 0;
    
    if (fixedTimeRange) {
      minHour = fixedTimeRange.start;
      maxHour = fixedTimeRange.end;
    } else if (config?.operatingHours && Array.isArray(config.operatingHours)) {
      // Find all non-closed days
      const activeDays = config.operatingHours.filter(oh => !oh.isClosed);
      
      if (activeDays.length === 0) {
        // If all days are closed, use default 10am-6pm range
        minHour = 10;
        maxHour = 18;
        console.log("No active operating hours found, using default 10:00-18:00 range");
      } else {
        // Process the active operating hours
        activeDays.forEach((oh: OperatingHours) => {
          const openHour = parseInt(oh.openTime.split(':')[0]);
          const closeHour = parseInt(oh.closeTime.split(':')[0]);
          const closeMinute = parseInt(oh.closeTime.split(':')[1]);
          
          minHour = Math.min(minHour, openHour);
          maxHour = Math.max(maxHour, closeHour + (closeMinute > 0 ? 1 : 0));
          
          console.log(`Day ${oh.dayOfWeek}: ${oh.openTime}-${oh.closeTime} => hours ${openHour}-${closeHour}`);
        });
      }
    } else {
      // Fallback to reasonable defaults if no config is available
      minHour = 10; // 10am
      maxHour = 18; // 6pm
      console.log("No config available, using default 10:00-18:00 range");
    }
    
    console.log(`Using hour range: ${minHour}:00 - ${maxHour}:00`);
    
    // Create time slots at 30-minute intervals
    const times = [];
    for (let hour = minHour; hour < maxHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        times.push({ hour, minute });
      }
    }
    
    return times;
  }, [config, configLoading, fixedTimeRange]);

  // Find matching time slot for a given day and time
  const findTimeSlot = (day: number, hour: number, minute: number): TimeSlot | null => {
    if (!timeSlotsByDay[day]) return null;
    
    // Add debug logging to see what's happening
    const matchingSlots = timeSlotsByDay[day].filter((slot: TimeSlot) => {
      const slotDate = new Date(slot.startTime);
      const slotHour = slotDate.getHours();
      const slotMinute = slotDate.getMinutes();
      
      return slotHour === hour && slotMinute === minute;
    });
    
    if (matchingSlots.length > 0) {
      console.log(`Matching slots for ${hour}:${minute} - ${matchingSlots.length} slots found`);
      matchingSlots.forEach((slot, index) => {
        console.log(`Slot ${index}: day=${day}, hour=${hour}, minute=${minute}, status=${slot.status}, date=${format(new Date(slot.startTime), 'EEE, MMM d')}`);
      });
    }
    
    return matchingSlots[0] || null;
  };

  // Format time for display (00:00 format)
  const formatTime = (hour: number, minute: number): string => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Navigation handlers
  const goToPreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Default renderers
  const defaultRenderTimeCell = (time: string) => {
    return <div className="text-sm font-medium text-gray-500">{time}</div>;
  };

  const defaultRenderSlotCell = (
    slot: TimeSlot | null, 
    day: number, 
    time: string,
    dayDate: Date,
    hour: number,
    minute: number
  ) => {
    return (
      <div 
        className={`h-10 border border-gray-200 ${slot ? 'bg-blue-50' : 'bg-gray-50'}`}
        onClick={() => handleSlotClick(slot, day, hour, minute, dayDate)}
      >
        {slot && <div className="text-xs text-center">{slot.status}</div>}
      </div>
    );
  };

  // Handle slot click with optional callback
  const handleSlotClick = (
    slot: TimeSlot | null, 
    day: number, 
    hour: number, 
    minute: number,
    dayDate: Date
  ) => {
    if (onSlotClick) {
      onSlotClick(slot, day, hour, minute, dayDate);
    }
  };

  if (timeSlotsLoading || configLoading) {
    return (
      <div className="p-4 flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b">
        <div className="text-lg font-semibold">
          {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            <Calendar className="h-4 w-4 mr-2" />
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CardContent className="p-0 overflow-auto">
        <div className="min-w-full">
          {/* Day headers */}
          <div className="grid grid-cols-8 bg-gray-50">
            <div className="p-2 border-b border-r"></div>
            {weekDays.map((day, index) => (
              <div 
                key={index} 
                className={`p-2 border-b text-center ${isSameDay(day, new Date()) ? 'bg-blue-50 font-bold' : ''}`}
              >
                <div>{format(day, 'EEE')}</div>
                <div>{format(day, 'd MMM')}</div>
              </div>
            ))}
          </div>

          {/* Time slots grid */}
          <div>
            {timeSlotGrid.map(({ hour, minute }, timeIndex) => (
              <div key={timeIndex} className="grid grid-cols-8">
                {/* Time column */}
                <div className="p-2 border-r flex items-center justify-end">
                  {renderTimeCell 
                    ? renderTimeCell(formatTime(hour, minute), hour, minute)
                    : defaultRenderTimeCell(formatTime(hour, minute))
                  }
                </div>

                {/* Day columns */}
                {weekDays.map((day, dayIndex) => {
                  const dayOfWeek = (day.getDay() + 6) % 7; // Convert to 0-6 where 0 is Monday
                  const slot = findTimeSlot(dayOfWeek, hour, minute);
                  
                  return (
                    <div key={dayIndex} className="border-r last:border-r-0">
                      {renderSlotCell 
                        ? renderSlotCell(slot, dayOfWeek, formatTime(hour, minute), day, hour, minute)
                        : defaultRenderSlotCell(slot, dayOfWeek, formatTime(hour, minute), day, hour, minute)
                      }
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BaseCalendarGrid;