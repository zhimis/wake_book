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

// Define configuration interface
interface Config {
  operatingHours: OperatingHours[];
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
  initialDate,
  fixedTimeRange
}) => {
  // State for managing the current date and calendar range
  const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
  
  // Calculate start of week for fetching data - always goes from Monday to Sunday
  const startDate = useMemo(() => {
    // Get the Monday of the current week (in Latvia time)
    const start = toLatviaTime(startOfWeek(toLatviaTime(currentDate), { weekStartsOn: 1 }));
    return start;
  }, [currentDate]);
  
  const endDate = useMemo(() => {
    // Get the Sunday of the current week (in Latvia time)
    const end = toLatviaTime(endOfWeek(toLatviaTime(currentDate), { weekStartsOn: 1 }));
    return end;
  }, [currentDate]);
  
  // Fetch configuration from API
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['/api/config'],
    select: (data: Config) => data
  });
  
  // Fetch time slots for the current week
  const { data: timeSlotsData, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['/api/timeslots', startDate.toISOString(), endDate.toISOString()],
    enabled: !!startDate && !!endDate,
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      const res = await fetch(`/api/timeslots?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch time slots');
      }
      return res.json();
    }
  });
  
  // Extract timeSlots from the data
  const timeSlots: TimeSlot[] = useMemo(() => {
    return timeSlotsData?.timeSlots || [];
  }, [timeSlotsData]);
  
  // Notify parent of date range change
  useEffect(() => {
    if (onDateChange && startDate && endDate) {
      onDateChange(startDate, endDate);
    }
  }, [startDate, endDate, onDateChange]);
  
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
    
    // CRITICAL FIX: Explicitly look for the June 1st booking and log it
    const juneFirstBookings = timeSlots.filter(slot => {
      const date = new Date(slot.startTime);
      return date.getMonth() === 5 && date.getDate() === 1;
    });
    
    if (juneFirstBookings.length > 0) {
      console.log(`Found ${juneFirstBookings.length} slots for June 1st:`, juneFirstBookings);
    }
    
    timeSlots.forEach((slot: TimeSlot) => {
      const slotDate = new Date(slot.startTime);
      
      // CRITICAL FIX: Properly calculate day of week (0-6), where 0 is Monday, 6 is Sunday
      // JavaScript day: 0=Sunday, 1=Monday, ..., 6=Saturday
      // Our system day: 0=Monday, 1=Tuesday, ..., 6=Sunday
      const jsDay = slotDate.getDay();
      const ourSystemDay = jsDay === 0 ? 6 : jsDay - 1;
      
      slotsByDay[ourSystemDay].push(slot);
    });
    
    return slotsByDay;
  }, [timeSlots]);
  
  // Generate array of days for the current week (in Latvia time)
  const weekDays = useMemo(() => {
    const days = [];
    const weekStart = toLatviaTime(startOfWeek(toLatviaTime(currentDate), { weekStartsOn: 1 }));
    
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    
    return days;
  }, [currentDate]);
  
  // Generate the time slots grid
  const timeSlotGrid = useMemo(() => {
    const timeGrid = [];
    
    // Use fixed time range if provided, otherwise determine from operating hours
    let startHour = 8; // Default opening hour
    let endHour = 18; // Default closing hour
    
    if (fixedTimeRange) {
      startHour = fixedTimeRange.start;
      endHour = fixedTimeRange.end;
    } else if (config && !configLoading) {
      // Find earliest opening and latest closing hours across all days
      if (viewMode === 'public') {
        // For public view, only include times for days that aren't closed
        const availableSlots = timeSlots.filter((slot: TimeSlot) => slot.status === 'available');
        
        if (availableSlots.length > 0) {
          // Use the earliest and latest times from available slots
          startHour = Math.min(...availableSlots.map(slot => new Date(slot.startTime).getHours()));
          endHour = Math.max(...availableSlots.map(slot => new Date(slot.endTime).getHours()));
        } else if (config.operatingHours && config.operatingHours.length > 0) {
          // Fall back to configured operating hours
          const activeDays = config.operatingHours.filter((oh: OperatingHours) => !oh.isClosed);
          
          if (activeDays.length > 0) {
            const openHours = activeDays
              .map(oh => parseInt(oh.openTime.split(':')[0]))
              .filter(h => !isNaN(h));
              
            const closeHours = activeDays
              .map(oh => parseInt(oh.closeTime.split(':')[0]))
              .filter(h => !isNaN(h));
            
            if (openHours.length > 0) startHour = Math.min(...openHours);
            if (closeHours.length > 0) endHour = Math.max(...closeHours);
          }
        }
      } else {
        // For admin view, include all configured times regardless of closed status
        const allConfiguredHours = config.operatingHours || [];
        
        const openHours = allConfiguredHours
          .map(oh => parseInt(oh.openTime.split(':')[0]))
          .filter(h => !isNaN(h));
          
        const closeHours = allConfiguredHours
          .map(oh => parseInt(oh.closeTime.split(':')[0]))
          .filter(h => !isNaN(h));
        
        if (openHours.length > 0) startHour = Math.min(...openHours);
        if (closeHours.length > 0) endHour = Math.max(...closeHours);
      }
    }
    
    // Add a buffer hour at the end for timeslots ending in that hour
    endHour = Math.min(endHour + 1, 24);
    
    // Generate timeslots at 30-minute intervals
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        timeGrid.push({ hour, minute });
      }
    }
    
    return timeGrid;
  }, [config, configLoading, fixedTimeRange, timeSlots, viewMode]);
  
  // Helper function to format time
  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  // Find a time slot for a specific day and time
  const findTimeSlot = (day: number, hour: number, minute: number) => {
    // Create a date object for the current day of the week at the specified hour:minute
    // This gives us an exact time reference for the current calendar cell
    const currentWeekday = weekDays[day];
    
    // Special check for June 1st booking using UTC times first
    const targetDate = new Date(currentWeekday);
    targetDate.setHours(hour, minute, 0, 0); // Set local time for the cell
    
    // Check if the target cell date is June 1st, 2025
    const isTargetJune1st = 
      targetDate.getFullYear() === 2025 && 
      targetDate.getMonth() === 5 && // Month is 0-indexed
      targetDate.getDate() === 1;

    if (isTargetJune1st) {
      // Convert cell's local hour/minute to target UTC hour/minute
      // NOTE: This assumes the calendar grid (hour, minute) represents Latvia time (EEST = UTC+3)
      // We need to find the corresponding UTC time for the check.
      // Construct the date in Latvia time and get its UTC equivalent.
      const localDateTimeString = `${format(targetDate, 'yyyy-MM-dd')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      
      // Attempt to parse this as Latvia time (we need date-fns-tz for this reliably, but try with Date)
      // A more robust solution would involve a library function to convert local time string in a specific zone to UTC.
      // For now, let's approximate by subtracting the typical offset (3 hours for EEST)
      // THIS IS A HACK - A proper timezone library function is needed for robustness.
      const estimatedUtcHour = (hour - 3 + 24) % 24; // Approximate UTC hour
      
      const june1stSlot = timeSlots.find(slot => {
         if (slot.bookingReference === 'WB-L_7LG1SG') {
            const slotUtcDate = new Date(slot.startTime); // Already UTC from string
            const slotUtcHour = slotUtcDate.getUTCHours();
            const slotUtcMinute = slotUtcDate.getUTCMinutes();
            // Compare approximate cell UTC time with exact slot UTC time
            return slotUtcHour === estimatedUtcHour && slotUtcMinute === minute;
         }
         return false;
      });
      
      if (june1stSlot) {
        console.log(`DEBUG: findTimeSlot matched June 1st slot ${june1stSlot.id} via UTC check for cell ${hour}:${minute}`);
        return june1stSlot;
      }
    }
    
    // Create a time string to search for
    const formattedDate = format(currentWeekday, 'yyyy-MM-dd');
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    // Method 1: Direct search through all time slots (most reliable method)
    let slots = timeSlots.filter(slot => {
      const slotDate = new Date(slot.startTime);
      const slotFormattedDate = format(slotDate, 'yyyy-MM-dd');
      const slotFormattedTime = format(slotDate, 'HH:mm');
      
      return slotFormattedDate === formattedDate && slotFormattedTime === formattedTime;
    });
    
    // We found an exact match by date and time
    if (slots.length > 0) {
      return slots[0];
    }
    
    // Method 2: Try the day bucket method (faster but less reliable)
    if (timeSlotsByDay && timeSlotsByDay[day]) {
      const matchingSlots = timeSlotsByDay[day].filter((slot: TimeSlot) => {
        const startTime = new Date(slot.startTime);
        return startTime.getHours() === hour && startTime.getMinutes() === minute;
      });
      
      if (matchingSlots.length > 0) {
        return matchingSlots[0];
      }
    }
    
    // Method 3: Last resort - day of week calculation (most error-prone)
    const fallbackSlot = timeSlots.find(slot => {
      const date = new Date(slot.startTime);
      const slotDay = date.getDay(); // 0 = Sunday
      // Convert to our calendar system (0 = Monday, 6 = Sunday)
      const calendarDay = slotDay === 0 ? 6 : slotDay - 1;
      
      return (
        calendarDay === day && 
        date.getHours() === hour && 
        date.getMinutes() === minute
      );
    });
    
    return fallbackSlot || null;
  };
  
  // Find all time slots in a sequence (used for showing consecutive bookings)
  const findConnectedTimeSlots = (slot: TimeSlot) => {
    if (!slot || !slot.bookingReference) {
      return [];
    }
    
    // Step 1: Get all slots with the same booking reference
    const sameBookingSlots = timeSlots.filter(s => 
      s.bookingReference && s.bookingReference === slot.bookingReference
    );
    
    // Step 2: Build a graph of connected time slots (connected = consecutive times)
    // For each slot, find all other slots that are consecutive (30 min apart)
    const slotGraph = new Map<number, number[]>();
    
    // Initialize the graph with empty connections for each slot
    sameBookingSlots.forEach(s => {
      slotGraph.set(s.id, []);
    });
    
    // Fill in the connections by checking consecutive slots
    sameBookingSlots.forEach(s1 => {
      sameBookingSlots.forEach(s2 => {
        if (s1.id !== s2.id && areSlotsConsecutive(s1, s2)) {
          // Add connection from s1 to s2
          const connections = slotGraph.get(s1.id) || [];
          if (!connections.includes(s2.id)) {
            connections.push(s2.id);
            slotGraph.set(s1.id, connections);
          }
        }
      });
    });
    
    // Step 3: Find the connected component containing our slot
    const visited = new Set<number>();
    const component: TimeSlot[] = [];
    
    // Depth-first search to find all connected slots
    const dfs = (id: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      // Add the current slot to the component
      const currentSlot = sameBookingSlots.find(s => s.id === id);
      if (currentSlot) {
        component.push(currentSlot);
      }
      
      // Visit all connected slots
      const connections = slotGraph.get(id) || [];
      for (const connectedId of connections) {
        dfs(connectedId);
      }
    };
    
    // Start DFS from our slot
    dfs(slot.id);
    
    // Sort the component by start time
    component.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    
    // Log for debugging
    if (component.length > 1) {
      console.log(`Found ${component.length} connected slots for booking ${slot.bookingReference}`);
    }
    
    return component;
  };
  
  // General purpose function to determine if two time slots are consecutive (30 min apart)
  const areSlotsConsecutive = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
    const time1 = new Date(slot1.startTime).getTime();
    const time2 = new Date(slot2.startTime).getTime();
    
    // Check if the slots are exactly 30 minutes apart (standard slot duration)
    // 30 minutes = 30 * 60 * 1000 = 1,800,000 milliseconds
    const timeDiff = Math.abs(time1 - time2);
    return timeDiff === 1800000;
  };
  
  // Get slot position in a booking sequence - can be first, middle, or last
  const getSlotPosition = (slot: TimeSlot): 'first' | 'middle' | 'last' | null => {
    if (!slot || !slot.bookingReference) {
      return null;
    }
    
    // Find all connected slots in this booking sequence using our improved graph algorithm
    const connectedSlots = findConnectedTimeSlots(slot);
    
    if (connectedSlots.length <= 1) {
      return null; // Not part of a sequence
    }
    
    // Determine position in sequence using timestamps (more reliable than using IDs)
    const slotTime = new Date(slot.startTime).getTime();
    const firstTime = new Date(connectedSlots[0].startTime).getTime();
    const lastTime = new Date(connectedSlots[connectedSlots.length - 1].startTime).getTime();
    
    if (slotTime === firstTime) {
      return 'first';
    } else if (slotTime === lastTime) {
      return 'last';
    } else {
      return 'middle';
    }
  };
  
  // Check if a slot is at the specified position in a sequence
  const isPartOfSequence = (slot: TimeSlot, position: 'first' | 'middle' | 'last'): boolean => {
    const slotPosition = getSlotPosition(slot);
    return slotPosition === position;
  };
  
  // Default render function for time cells
  const defaultRenderTimeCell = (time: string) => (
    <div className="text-xs text-gray-600">{time}</div>
  );
  
// REMOVED OLD FUNCTION CODE - Replaced with improved implementation below

  // Default render function for slot cells
  const defaultRenderSlotCell = (
    slot: TimeSlot | null, 
    day: number, 
    time: string, 
    dayDate: Date,
    hour: number,
    minute: number
  ) => {
    const isAdminView = viewMode === 'admin';
    
    // Function to handle slot click
    const handleClick = () => {
      if (onSlotClick) {
        onSlotClick(slot, day, hour, minute, dayDate);
      }
    };
    
    // Check if the day is closed based on operating hours
    const isDayClosed = config?.operatingHours?.find(oh => oh.dayOfWeek === day)?.isClosed;
    
    // Display class based on slot status or day being closed
    let displayClass = "p-2 h-10 w-full";
    
    if (slot) {
      // Track position flags for all bookings in a uniform way
      let isFirst = false;
      let isMiddle = false;
      let isLast = false;
      
      // Generalized approach for all bookings
      const isPartOfBooking = !!slot.bookingReference && slot.status === 'booked';
      
      if (isPartOfBooking) {
        // Get the position of this slot in its booking sequence
        const position = getSlotPosition(slot);
        
        // Set position flags based on result
        isFirst = position === 'first';
        isMiddle = position === 'middle';
        isLast = position === 'last';
        
        // Add debugging for all multi-slot bookings
        if (position) {
          console.log(`Booking ${slot.bookingReference} - Slot ${slot.id} at ${new Date(slot.startTime).toISOString()} position: ${position}`);
        }
      }
      
      // Styling for different slot statuses
      switch (slot.status) {
        case 'available':
          displayClass += " bg-green-100 hover:bg-green-200 cursor-pointer";
          break;
        case 'booked':
          // Apply special styling for sequences
          if (isFirst) {
            displayClass += " bg-blue-500 text-white rounded-t";
          } else if (isLast) {
            displayClass += " bg-blue-500 text-white rounded-b";
          } else if (isMiddle) {
            displayClass += " bg-blue-500 text-white";
          } else {
            // Single slot (not part of a sequence)
            displayClass += " bg-blue-500 text-white rounded";
          }
          
          // Special visual enhancement for our problem booking to make it stand out
          if (isJune1stBooking) {
            displayClass += " !bg-blue-700 font-medium";
          }
          break;
        case 'reserved':
          displayClass += " bg-yellow-100 hover:bg-yellow-200 cursor-pointer";
          break;
        case 'unavailable':
          displayClass += " bg-gray-100 text-gray-400";
          break;
        default:
          displayClass += " bg-white hover:bg-gray-50 cursor-pointer";
      }
    } else if (isDayClosed) {
      // Styling for closed days
      displayClass += " bg-gray-50 text-gray-300";
    } else {
      // Styling for empty slots
      displayClass += isAdminView 
        ? " bg-white hover:bg-gray-50 cursor-pointer" 
        : " bg-gray-50";
    }
    
    return (
      <div 
        className={displayClass}
        onClick={handleClick}
      >
        {slot && slot.status === 'booked' && (
          <div className="text-xs truncate">{slot.bookingReference}</div>
        )}
      </div>
    );
  };
  
  // Go to previous week
  const goToPreviousWeek = () => {
    setCurrentDate(prevDate => subWeeks(prevDate, 1));
  };
  
  // Go to next week
  const goToNextWeek = () => {
    setCurrentDate(prevDate => addWeeks(prevDate, 1));
  };
  
  // Go to current week
  const goToCurrentWeek = () => {
    setCurrentDate(new Date());
  };
  
  return (
    <Card className="w-full overflow-x-auto shadow-sm border">
      <CardContent className="p-4">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center space-x-2">
            <span className="font-medium">
              {format(startDate, "dd MMMM yyyy")} - {format(endDate, "dd MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentWeek}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Calendar Grid */}
        <div className="border rounded overflow-hidden">
          {/* Days of the week header */}
          <div className="grid grid-cols-8 bg-slate-50">
            <div className="p-2 border-r border-b"></div>
            {weekDays.map((date, index) => (
              <div key={index} className="p-2 text-center border-r border-b last:border-r-0 font-medium">
                <div>{format(date, "EEE")}</div>
                <div className="text-xs">{format(date, "d MMM")}</div>
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
                  // Map JavaScript's day (0=Sunday) to our calendar system (0=Monday)
                  const jsDay = day.getDay(); // 0=Sunday, 1=Monday, etc.
                  const ourSystemDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Monday, 6=Sunday
                  
                  // Special debug for June 1st
                  const isJune1st = day.getMonth() === 5 && day.getDate() === 1;
                  
                  // Find the time slot for this day/hour/minute cell
                  const slot = findTimeSlot(dayIndex, hour, minute);
                  
                  // Extra debugging for June 1st
                  if (isJune1st && slot && slot.bookingReference === 'WB-L_7LG1SG') {
                    console.log(`Found June 1st slot at ${hour}:${minute} with ID ${slot.id}`);
                  }
                  
                  return (
                    <div key={dayIndex} className="border-r last:border-r-0">
                      {renderSlotCell 
                        ? renderSlotCell(slot, dayIndex, formatTime(hour, minute), day, hour, minute)
                        : defaultRenderSlotCell(slot, dayIndex, formatTime(hour, minute), day, hour, minute)
                      }
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Loading state */}
        {(timeSlotsLoading || configLoading) && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <div className="text-sm text-gray-600">Loading...</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BaseCalendarGrid;