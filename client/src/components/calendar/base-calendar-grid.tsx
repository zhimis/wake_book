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
    
    // Build a map of which day of the week (0-6) corresponds to which date
    const datesToDays = weekDays.reduce((map, date, index) => {
      map.set(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, index);
      return map;
    }, new Map<string, number>());
    
    timeSlots.forEach((slot: TimeSlot) => {
      const slotDate = new Date(slot.startTime);
      
      // Create a key to look up which day in our week this date belongs to
      const dateKey = `${slotDate.getFullYear()}-${slotDate.getMonth()}-${slotDate.getDate()}`;
      
      // Get the day index from our map, or fallback to traditional day-of-week calculation
      let dayIndex = datesToDays.get(dateKey);
      
      if (dayIndex !== undefined) {
        // We found an exact date match - this ensures slots are placed on the correct display day
        slotsByDay[dayIndex].push(slot);
      } else {
        // FALLBACK: Traditional day-of-week calculation (less accurate)
        const jsDay = slotDate.getDay();
        const ourSystemDay = jsDay === 0 ? 6 : jsDay - 1;
        
        // WARNING: Using this method can lead to wrong dates being included
        // We're adding debug logging to track these occurrences
        if (slotDate.getDate() === 1 && slotDate.getMonth() === 5) { // June 1st
          console.log(`[WARNING] Fallback day assignment used for June 1st slot ID ${slot.id}!`);
          console.log(`Date: ${slotDate.toISOString()}, Assigned to day index: ${ourSystemDay}`);
        }
        
        // This is the old method that may put slots on wrong dates
        slotsByDay[ourSystemDay].push(slot);
      }
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
  
  // Find a time slot for a specific day and time - IMPROVED WITH DIRECT TIME ZONE SUPPORT
  const findTimeSlot = (day: number, hour: number, minute: number) => {
    // Create a date object for the current day of the week at the specified hour:minute
    const currentWeekday = weekDays[day];
    
    // SPECIAL DEBUGGING FOR JUNE 1ST
    const isJune1st = currentWeekday.getDate() === 1 && currentWeekday.getMonth() === 5; // June is month 5 (0-indexed)
    
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] LOOKING FOR JUNE 1ST SLOT: Day=${day}, Hour=${hour}, Minute=${minute}`);
      console.log(`[findTimeSlot] Current weekday date: ${currentWeekday.toISOString()}`);
    }
    
    // Create a time string to search for
    const formattedDate = format(currentWeekday, 'yyyy-MM-dd');
    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] JUNE 1ST: Looking for slot at ${formattedDate} ${formattedTime}`);
    }
    
    // Convert local display hours to UTC for matching with database times
    // Latvia is UTC+3 in summer, so we need to subtract 3 hours for db comparison
    const utcHour = hour - 3; // This is a simple conversion, a real app would use more robust timezone conversion
    const utcDateTime = new Date(currentWeekday);
    utcDateTime.setHours(utcHour, minute, 0, 0);
    
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] JUNE 1ST: Converted to UTC time: ${utcDateTime.toISOString()}`);
      
      // Log all time slots for this day to debug
      const juneSlots = timeSlots.filter(slot => {
        const slotDate = new Date(slot.startTime);
        return slotDate.getDate() === 1 && slotDate.getMonth() === 5; // June 1st
      });
      
      console.log(`[findTimeSlot] JUNE 1ST: Found ${juneSlots.length} slots for June 1st:`);
      juneSlots.forEach(slot => {
        console.log(`  ID:${slot.id}, Start:${new Date(slot.startTime).toISOString()}, Status:${slot.status}, Booking:${slot.bookingReference || 'none'}`);
      });
    }
    
    // DIRECT UTC TIME COMPARISON WITH DATE VERIFICATION
    // Convert the display time to the exact UTC time we'd expect in the database
    let directMatchSlots = timeSlots.filter(slot => {
      const slotTime = new Date(slot.startTime);
      
      // FIRST, verify the date is the SAME as the weekday we're looking at
      // This prevents matching slots from different dates (e.g., May 25 when viewing June 1)
      if (slotTime.getFullYear() !== currentWeekday.getFullYear() ||
          slotTime.getMonth() !== currentWeekday.getMonth() ||
          slotTime.getDate() !== currentWeekday.getDate()) {
        return false;
      }
      
      // Then check the time component (hour and minute)
      const timeDiff = Math.abs(slotTime.getTime() - utcDateTime.getTime());
      
      // Consider times within 1 minute (60000 ms) as matching to account for potential rounding
      return timeDiff < 60000;
    });
    
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] JUNE 1ST: Direct UTC matching found ${directMatchSlots.length} slots:`);
      directMatchSlots.forEach(slot => {
        console.log(`  ID:${slot.id}, Start:${new Date(slot.startTime).toISOString()}, Status:${slot.status}`);
      });
    }
    
    if (directMatchSlots.length > 0) {
      // Prioritize booked slots
      const bookedDirectSlot = directMatchSlots.find(slot => slot.status === 'booked');
      if (bookedDirectSlot) {
        if (isJune1st && hour >= 11 && hour < 14) {
          console.log(`[findTimeSlot] JUNE 1ST: Returning booked direct match: ID:${bookedDirectSlot.id}`);
        }
        return bookedDirectSlot;
      }
      
      if (isJune1st && hour >= 11 && hour < 14) {
        console.log(`[findTimeSlot] JUNE 1ST: Returning first direct match: ID:${directMatchSlots[0].id}`);
      }
      return directMatchSlots[0];
    }
    
    // Traditional text-based date/time matching as fallback
    // This is already correctly checking both date AND time
    let matchingSlots = timeSlots.filter(slot => {
      const slotDate = new Date(slot.startTime);
      const slotFormattedDate = format(slotDate, 'yyyy-MM-dd');
      const slotFormattedTime = format(slotDate, 'HH:mm');
      
      // Double-check that the date matches the display date (not just any date with the same time)
      return slotFormattedDate === formattedDate && slotFormattedTime === formattedTime;
    });
    
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] JUNE 1ST: Text-based matching found ${matchingSlots.length} slots`);
    }
    
    // DEBUG: Log duplicate slots
    if (matchingSlots.length > 1) {
      console.log(`DUPLICATE SLOTS FOUND FOR ${formattedDate} ${formattedTime}:`, 
        matchingSlots.map(s => `ID:${s.id}, Status:${s.status}, Booking:${s.bookingReference || 'none'}`));
    }
    
    // If we have multiple slots for this time period (after regeneration), prioritize booked slots
    if (matchingSlots.length > 0) {
      // First try to find a booked slot
      const bookedSlot = matchingSlots.find(slot => slot.status === 'booked');
      if (bookedSlot) {
        if (isJune1st && hour >= 11 && hour < 14) {
          console.log(`[findTimeSlot] JUNE 1ST: Returning booked text match: ID:${bookedSlot.id}`);
        }
        return bookedSlot;
      }
      // Otherwise return the first one (fallback)
      if (isJune1st && hour >= 11 && hour < 14) {
        console.log(`[findTimeSlot] JUNE 1ST: Returning first text match: ID:${matchingSlots[0].id}`);
      }
      return matchingSlots[0];
    }
    
    // Method 2: Try the day bucket method as fallback (now with date verification)
    if (timeSlotsByDay && timeSlotsByDay[day]) {
      const daySlots = timeSlotsByDay[day].filter((slot: TimeSlot) => {
        const startTime = new Date(slot.startTime);
        
        // CRITICAL FIX: First verify the date matches the display date
        // This prevents booking slots from May 25th when viewing June 1st
        if (startTime.getFullYear() !== currentWeekday.getFullYear() ||
            startTime.getMonth() !== currentWeekday.getMonth() ||
            startTime.getDate() !== currentWeekday.getDate()) {
          return false;
        }
        
        // Then check the time component
        return startTime.getHours() === hour && startTime.getMinutes() === minute;
      });
      
      if (isJune1st && hour >= 11 && hour < 14) {
        console.log(`[findTimeSlot] JUNE 1ST: Day bucket method found ${daySlots.length} slots`);
      }
      
      // Again prioritize booked slots
      if (daySlots.length > 0) {
        const bookedDaySlot = daySlots.find(slot => slot.status === 'booked');
        if (bookedDaySlot) {
          if (isJune1st && hour >= 11 && hour < 14) {
            console.log(`[findTimeSlot] JUNE 1ST: Returning booked day bucket: ID:${bookedDaySlot.id}`);
          }
          return bookedDaySlot;
        }
        if (isJune1st && hour >= 11 && hour < 14) {
          console.log(`[findTimeSlot] JUNE 1ST: Returning first day bucket: ID:${daySlots[0].id}`);
        }
        return daySlots[0];
      }
    }
    
    // Method 3: Last resort - day of week calculation WITH date verification
    let fallbackSlots = timeSlots.filter(slot => {
      const date = new Date(slot.startTime);
      
      // CRITICAL FIX: First verify that the date matches the current weekday's date
      // This ensures we only get slots from the exact date displayed in the UI
      if (date.getFullYear() !== currentWeekday.getFullYear() ||
          date.getMonth() !== currentWeekday.getMonth() ||
          date.getDate() !== currentWeekday.getDate()) {
        return false;
      }
      
      const slotDay = date.getDay(); // 0 = Sunday
      // Convert to our calendar system (0 = Monday, 6 = Sunday)
      const calendarDay = slotDay === 0 ? 6 : slotDay - 1;
      
      return (
        calendarDay === day && 
        date.getHours() === hour && 
        date.getMinutes() === minute
      );
    });
    
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] JUNE 1ST: Day of week calculation found ${fallbackSlots.length} slots`);
    }
    
    // Prioritize booked slots among fallbacks as well
    if (fallbackSlots.length > 0) {
      const bookedFallbackSlot = fallbackSlots.find(slot => slot.status === 'booked');
      if (bookedFallbackSlot) {
        if (isJune1st && hour >= 11 && hour < 14) {
          console.log(`[findTimeSlot] JUNE 1ST: Returning booked fallback: ID:${bookedFallbackSlot.id}`);
        }
        return bookedFallbackSlot;
      }
      if (isJune1st && hour >= 11 && hour < 14) {
        console.log(`[findTimeSlot] JUNE 1ST: Returning first fallback: ID:${fallbackSlots[0].id}`);
      }
      return fallbackSlots[0];
    }
    
    // No slots found for this time period
    if (isJune1st && hour >= 11 && hour < 14) {
      console.log(`[findTimeSlot] JUNE 1ST: No slot found for ${formattedDate} ${formattedTime}`);
    }
    return null;
  };
  
  // Helper function to check if two slots are exactly 30 minutes apart based on start times
  const areSlotsConsecutive = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
    const time1 = new Date(slot1.startTime).getTime();
    const time2 = new Date(slot2.startTime).getTime();
    
    // Check if slot2 starts exactly 30 minutes after slot1 starts
    // 30 minutes = 30 * 60 * 1000 = 1,800,000 milliseconds
    return (time2 - time1) === 1800000;
  };
  
  // Simpler approach to finding connected time slots
  const findConnectedTimeSlots = (slot: TimeSlot) => {
    if (!slot || !slot.bookingReference) {
      return [];
    }
    
    // Just get all slots with the same booking reference
    const allSlotsWithSameBooking = timeSlots.filter(s => 
      s.bookingReference && s.bookingReference === slot.bookingReference
    );
    
    // Sort them by start time
    allSlotsWithSameBooking.sort((a, b) => {
      const aTime = new Date(a.startTime).getTime();
      const bTime = new Date(b.startTime).getTime();
      return aTime - bTime;
    });
    
    console.log(`[DEBUG] Found ${allSlotsWithSameBooking.length} slots with reference ${slot.bookingReference}`);
    
    return allSlotsWithSameBooking;
  };
  
  // Get slot position in a booking sequence - can be first, middle, or last
  const getSlotPosition = (slot: TimeSlot): 'first' | 'middle' | 'last' | null => {
    if (!slot || !slot.bookingReference) {
      return null;
    }
    
    // Find all slots with the same booking reference
    const sameBookingSlots = findConnectedTimeSlots(slot);
    
    console.log(`[DEBUG] Finding position for slot ID ${slot.id} among ${sameBookingSlots.length} slots`);
    
    if (sameBookingSlots.length <= 1) {
      return null; // Not part of a sequence
    }
    
    // Sort the slots by start time
    sameBookingSlots.sort((a, b) => {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    
    // Find this slot's position in the sorted array
    const index = sameBookingSlots.findIndex(s => s.id === slot.id);
    
    if (index === 0) {
      return 'first';
    } else if (index === sameBookingSlots.length - 1) {
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
  
  // Default render function for slot cells - DIRECT APPROACH
  const defaultRenderSlotCell = (
    slot: TimeSlot | null, 
    day: number, 
    time: string, 
    dayDate: Date,
    hour: number,
    minute: number
  ) => {
    const isAdminView = viewMode === 'admin';
    
    // SPECIAL DEBUG FOR JUNE 1ST
    const isJune1st = dayDate.getDate() === 1 && dayDate.getMonth() === 5; // June is month 5 (0-indexed)
    
    if (isJune1st) {
      console.log(`JUNE 1ST CELL: Day=${day}, Hour=${hour}, Minute=${minute}, Date=${dayDate.toISOString()}`);
      if (slot) {
        console.log(`JUNE 1ST SLOT FOUND: ID=${slot.id}, Status=${slot.status}, StartTime=${new Date(slot.startTime).toISOString()}, Reference=${slot.bookingReference || 'none'}`);
      } else {
        console.log(`JUNE 1ST NO SLOT FOUND FOR THIS CELL`);
      }
    }
    
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
    
    // ULTRA-SIMPLE APPROACH:
    // Just use the status directly from the database without any complex logic
    
    if (slot) {
      // Specially handle June 1st for debugging
      if (isJune1st && hour >= 11 && hour < 14) {
        const bookedText = slot.status === 'booked' ? "BOOKED" : "NOT BOOKED";
        console.log(`JUNE 1ST TIMESLOT CHECK: ${hour}:${minute} is ${bookedText} | ID: ${slot.id} | Ref: ${slot.bookingReference || 'none'}`);
      }
      
      // Direct styling based on database status - no fancy logic
      switch (slot.status) {
        case 'booked':
          // This is the key change - use YELLOW for booked slots
          displayClass += " bg-yellow-100 text-gray-800";
          break;
        case 'available':
          displayClass += " bg-green-100 hover:bg-green-200 cursor-pointer";
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
                  
                  // Find the time slot for this day/hour/minute cell
                  const slot = findTimeSlot(dayIndex, hour, minute);
                  
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