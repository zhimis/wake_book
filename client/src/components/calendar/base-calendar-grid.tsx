import React, { useState, useEffect, useMemo } from "react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { TimeSlot } from "@shared/schema";
import { LATVIA_TIMEZONE, toLatviaTime } from "@/lib/utils";

// Define internal OperatingHours interface since we're only using it in this component
interface OperatingHours {
  id: number;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

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
  const { data: timeSlotsResponse, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['/api/timeslots', { startDate: startDate.toISOString(), endDate: endDate.toISOString() }],
    queryFn: async () => {
      console.log(`Fetching time slots from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const res = await fetch(`/api/timeslots?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!res.ok) throw new Error('Failed to fetch time slots');
      return res.json();
    }
  });
  
  // Extract the actual time slots array from the response
  const timeSlots = useMemo(() => {
    if (!timeSlotsResponse) return [];
    
    // The API returns { startDate, endDate, timeSlots: [] }
    if (timeSlotsResponse.timeSlots && Array.isArray(timeSlotsResponse.timeSlots)) {
      console.log(`Successfully extracted ${timeSlotsResponse.timeSlots.length} time slots from API response`);
      return timeSlotsResponse.timeSlots;
    } 
    
    // Fallback in case the API changes in the future
    if (Array.isArray(timeSlotsResponse)) {
      console.log(`Received ${timeSlotsResponse.length} time slots directly as array`);
      return timeSlotsResponse;
    }
    
    console.log("Could not extract time slots from response:", timeSlotsResponse);
    return [];
  }, [timeSlotsResponse]);

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
      return {};
    }
    
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
    });
    
    return slotsByDay;
  }, [timeSlots]);

  // Generate array of days for the current week (in Latvia time)
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      // Convert to Latvia time to ensure we have the correct day
      const localDay = addDays(startDate, i);
      const latviaDay = toLatviaTime(localDay);
      days.push(latviaDay);
    }
    return days;
  }, [startDate]);

  // Generate time slots for the grid
  const timeSlotGrid = useMemo(() => {
    if (!config || configLoading) return [];
    
    // Determine min/max hours for the calendar grid
    let minHour = 24;
    let maxHour = 0;
    
    console.log("DEBUG: FULL CONFIG DATA:", JSON.stringify(config, null, 2));
    
    // FIXED REQUIREMENTS:
    // - Admin view: always show 8:00-22:00
    // - Public view: show all rows between earliest and latest available slots
    if (viewMode === 'admin') {
      // For admin view, show fixed range 8:00-22:00
      minHour = 8;   // 8am
      maxHour = 22;  // 10pm
      console.log(`Using fixed admin time range: ${minHour}:00-${maxHour}:00`);
    } else if (fixedTimeRange) {
      // If explicitly provided time range, use that
      minHour = fixedTimeRange.start;
      maxHour = fixedTimeRange.end;
      // Time range log removed
    } else if (viewMode === 'public' && timeSlots && timeSlots.length > 0) {
      // For public view - determine range based on available time slots
      // First - get all slots that are available
      const availableSlots = timeSlots.filter((slot: TimeSlot) => slot.status === 'available');
      
      // Available slots log removed
      
      if (availableSlots.length > 0) {
        // Find the earliest and latest time slots
        let earliestHour = 24;
        let latestHour = 0;
        
        availableSlots.forEach((slot: TimeSlot) => {
          const slotDate = toLatviaTime(slot.startTime);
          const slotEndDate = toLatviaTime(slot.endTime);
          const hour = slotDate.getHours();
          const endHour = slotEndDate.getHours();
          const endMinute = slotEndDate.getMinutes();
          
          earliestHour = Math.min(earliestHour, hour);
          
          // Adjust end hour if minutes > 0
          const adjustedEndHour = endMinute > 0 ? endHour + 1 : endHour;
          latestHour = Math.max(latestHour, adjustedEndHour);
          
          console.log(`Slot at ${hour}:${slotDate.getMinutes()} to ${endHour}:${endMinute} (Latvia time)`);
        });
        
        // Set range based on available slots
        minHour = Math.max(8, earliestHour); // Don't go earlier than 8am
        maxHour = Math.min(23, latestHour);  // Don't go later than 11pm
        
        // Public view range log removed
      } else if (config?.operatingHours && Array.isArray(config.operatingHours)) {
        // Fallback to operating hours if no available slots
        // No available slots log removed
        
        // Find all non-closed days
        const activeDays = config.operatingHours.filter((oh: OperatingHours) => !oh.isClosed);
        
        if (activeDays.length === 0) {
          // If all days are closed, use default 10am-6pm range
          minHour = 10;
          maxHour = 18;
          // Default range log removed
        } else {
          // Process the active operating hours
          activeDays.forEach((oh: OperatingHours) => {
            const openHour = parseInt(oh.openTime.split(':')[0]);
            const closeHour = parseInt(oh.closeTime.split(':')[0]);
            const closeMinute = parseInt(oh.closeTime.split(':')[1]);
            
            minHour = Math.min(minHour, openHour);
            
            // Fix for 24 hour display - if closeHour is 24 (midnight), keep it as 24
            let adjustedCloseHour = closeHour;
            if (closeHour === 0 && (oh.closeTime === "00:00" || oh.closeTime === "0:00" || oh.closeTime === "00:00:00")) {
              adjustedCloseHour = 24;
            }
            
            // Add 1 to the close hour if there are minutes, to include the partial hour
            maxHour = Math.max(maxHour, adjustedCloseHour + (closeMinute > 0 ? 1 : 0));
          });
        }
      } else {
        // Fallback if no config or time slots
        minHour = 10;
        maxHour = 21;
        console.log("No config or time slots available, using default 10:00-21:00 range");
      }
    } else {
      // Fallback if no other method applied
      minHour = 10;
      maxHour = 21;
      console.log("Using default time range: 10:00-21:00");
    }
    
    // Ensure maxHour is at least minHour + 1 to show something
    if (maxHour <= minHour) {
      maxHour = minHour + 1;
    }
    
    console.log(`FINAL HOUR RANGE: ${minHour}:00 - ${maxHour}:00`);
    
    // Create time slots at 30-minute intervals
    const times = [];
    for (let hour = minHour; hour < maxHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        times.push({ hour, minute });
      }
    }
    
    return times;
  }, [config, configLoading, fixedTimeRange, timeSlots, viewMode]);

  // Find matching time slot for a given day and time
  const findTimeSlot = (day: number, hour: number, minute: number): TimeSlot | null => {
    if (!timeSlotsByDay[day]) return null;
    
    // Filter slots for the requested time
    const matchingSlots = timeSlotsByDay[day].filter((slot: TimeSlot) => {
      // Convert the UTC slot time to Latvia timezone
      const slotLatviaDate = toLatviaTime(slot.startTime);
      
      // Extract hours and minutes from the Latvia time
      const slotHour = slotLatviaDate.getHours();
      const slotMinute = slotLatviaDate.getMinutes();
      
      // Check if this slot matches the requested hour and minute
      return slotHour === hour && slotMinute === minute;
    });
    
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
          {formatInTimeZone(toLatviaTime(startDate), LATVIA_TIMEZONE, 'MMM d')} - {formatInTimeZone(toLatviaTime(endDate), LATVIA_TIMEZONE, 'MMM d, yyyy')}
          <span className="text-xs text-gray-500 ml-2">(Latvia time)</span>
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
                <div>{formatInTimeZone(day, LATVIA_TIMEZONE, 'EEE')}</div>
                <div>{formatInTimeZone(day, LATVIA_TIMEZONE, 'd MMM')}</div>
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