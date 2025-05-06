import React, { useState, useEffect, useMemo, useRef } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Euro,
  Loader2,
} from "lucide-react";
import { 
  cn, 
  getLatvianDayIndex, 
  getStandardDayIndex, 
  getLatvianDayName, 
  getLatvianDayIndexFromDate,
  toLatviaTime,
  fromLatviaTime,
  formatInLatviaTime,
  formatTime,
  formatTimeSlot,
  formatWithTimezone,
  LATVIA_TIMEZONE
} from "@/lib/utils";
import { useBooking } from "@/context/booking-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { TimeSlot as SchemaTimeSlot, generateTimeSlotId } from "@shared/schema";
import CalendarDay from "@/components/calendar-day";
import AdminTimeSlot from "@/components/admin/admin-time-slot";

// Define TimeSlotStatus type to be used consistently across components
export type TimeSlotStatus = "available" | "booked" | "selected" | "unallocated";

// Local TimeSlot interface with UI-specific properties
interface CalendarTimeSlot {
  id: string;
  day: number; // Days difference from current date
  latvianDayIndex?: number; // 0-6 where 0 = Monday (Latvian format)
  hour: number; // hour in 24-hour format
  minute: number; // 0 or 30
  price: number;
  status: TimeSlotStatus;
  startTime: Date;
  endTime: Date;
  storageTimezone: string; // Added storage timezone field
  isPast?: boolean; // Flag to identify if this slot is in the past
  originalStartTime?: Date; // Original database date before week mapping
  originalEndTime?: Date; // Original database date before week mapping
}

interface CustomNavigationProps {
  goToPrevious: () => void;
  goToNext: () => void;
  goToToday: () => void;
}

interface BookingCalendarProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  isAdmin?: boolean;
  onAdminSlotSelect?: (timeSlot: SchemaTimeSlot) => void;
  adminSelectedSlots?: SchemaTimeSlot[]; // Allow admin component to pass selected slots
  customNavigation?: CustomNavigationProps; // Custom navigation functions for admin view
  initialDate?: Date; // Allow parent to control the initial date
}

// Converter function to match our calendar UI slots with the DB schema
function toSchemaTimeSlot(slot: CalendarTimeSlot): SchemaTimeSlot {
  // Use the numeric ID directly 
  const id = parseInt(slot.id);
  
  // When creating a SchemaTimeSlot object for selection or display in the UI,
  // we want to use the display dates (slot.startTime, slot.endTime) to ensure consistency
  // of what's visible in the calendar and what's shown in the selected slots summary.
  
  // However, we need to keep the original database dates for API operations.
  // So we attach it as a separate property that the admin component can use.
  
  return {
    id: id,
    // For display in the UI, use the corrected date that's mapped to the current week
    startTime: slot.startTime,
    endTime: slot.endTime,
    // Attach original dates (important for API operations)
    originalStartTime: slot.originalStartTime,
    originalEndTime: slot.originalEndTime,
    price: slot.price,
    status: slot.status,
    storageTimezone: slot.storageTimezone || 'UTC', // Use the slot's timezone if available
    isPast: slot.isPast // Pass the isPast flag to AdminTimeSlot
  };
}

// Simplified booking calendar with mock data
// *** FIXED VERSION - With improved navigation ***
const BookingCalendar = ({ 
  isAdmin = false, 
  onAdminSlotSelect, 
  adminSelectedSlots = [],
  customNavigation,
  onDateRangeChange,
  initialDate // New prop to allow parent to control the initial date
}: BookingCalendarProps) => {
  // Initialize currentDate with initialDate prop if provided, or today's date
  // This ensures the calendar shows the correct week or the one provided by parent
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Use provided initialDate if available, or default to today
    const startingDate = initialDate ? toLatviaTime(initialDate) : toLatviaTime(new Date());
    console.log(`Initializing calendar with date: ${startingDate.toISOString()} (Latvia time)`);
    return startingDate;
  });
  
  // Use the booking context
  const { selectedTimeSlots, toggleTimeSlot, clearSelectedTimeSlots } = useBooking();
  // No longer fetching weather data per client request
  const { toast } = useToast();
  
  // Date range for the current week view
  // For admin view, include yesterday in the date range
  const startDate = isAdmin ? subDays(currentDate, 1) : currentDate;
  const endDate = addDays(currentDate, 6);
  
  // Effect to update current date when initialDate prop changes
  useEffect(() => {
    if (initialDate) {
      const newDate = toLatviaTime(initialDate);
      console.log(`Updating calendar with new initialDate: ${formatInLatviaTime(newDate, "yyyy-MM-dd")}`);
      setCurrentDate(newDate);
    }
  }, [initialDate]); // Only run when initialDate prop changes
  
  // Notify parent component of date range changes
  // This is needed for the admin view to sync with the calendar's date range
  useEffect(() => {
    if (onDateRangeChange && initialDate === undefined) { 
      // Only notify parent if initialDate is undefined (calendar is controlling dates internally)
      // This prevents infinite loops when parent is controlling the date with initialDate prop
      console.log(`Calendar notifying parent of date range change: ${formatInLatviaTime(startDate, "yyyy-MM-dd")} to ${formatInLatviaTime(endDate, "yyyy-MM-dd")}`);
      onDateRangeChange(startDate, endDate);
    }
  }, [currentDate, onDateRangeChange, initialDate]); // Only when our internal currentDate changes, not on every render
  
  // Navigation functions
  const goToPreviousWeek = () => {
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    setCurrentDate(subDays(currentDate, 7));
    
    // Log navigation for debugging
    console.log(`BookingCalendar: Navigating to previous week: ${formatInLatviaTime(subDays(currentDate, 7), "yyyy-MM-dd")}`);
  };
  
  const goToNextWeek = () => {
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    setCurrentDate(addDays(currentDate, 7));
    
    // Log navigation for debugging
    console.log(`BookingCalendar: Navigating to next week: ${formatInLatviaTime(addDays(currentDate, 7), "yyyy-MM-dd")}`);
  };
  
  const goToToday = () => {
    // ENHANCED DEBUG: Log detailed info about Today button handling
    console.log("=== TODAY BUTTON PRESSED (BOOKING-CALENDAR) ===");
    console.log(`Component settings: isAdmin=${isAdmin}, hasCustomNav=${!!customNavigation}`);
    
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    
    // Get the actual current date (server time)
    const serverNow = new Date();
    console.log(`Server time now: ${serverNow.toISOString()}`);
    
    // Use current date but ensure it's consistent with our timezone handling
    const todayInLatvia = toLatviaTime(new Date());
    console.log(`Today in Latvia timezone: ${todayInLatvia.toISOString()}`);
    console.log(`Today in Latvia (formatted): ${formatInLatviaTime(todayInLatvia, "yyyy-MM-dd")}`);
    
    // Get day of week as JavaScript normally sees it
    const jsDayOfWeek = todayInLatvia.getDay(); // 0-6, 0=Sunday
    console.log(`JavaScript day of week: ${jsDayOfWeek} (0=Sun, 6=Sat)`);
    
    // Get Latvia day of week (0=Monday, 6=Sunday)
    const latvianDayIndex = getLatvianDayIndexFromDate(todayInLatvia);
    console.log(`Latvia day of week: ${latvianDayIndex} (0=Mon, 6=Sun)`);
    
    // Calculate Monday of this week by subtracting the day index
    const thisMonday = subDays(todayInLatvia, latvianDayIndex);
    console.log(`Monday of current week: ${thisMonday.toISOString()}`);
    console.log(`Monday of current week (formatted): ${formatInLatviaTime(thisMonday, "yyyy-MM-dd")}`);
    
    // Update the current date to this week's Monday
    setCurrentDate(thisMonday);
    console.log(`Set current date to: ${thisMonday.toISOString()}`);
    
    // If onDateRangeChange is provided, notify parent directly to ensure sync
    if (onDateRangeChange) {
      // Calculate end date (Sunday)
      const thisSunday = addDays(thisMonday, 6);
      console.log(`End of week (Sunday): ${thisSunday.toISOString()}`);
      console.log(`End of week (formatted): ${formatInLatviaTime(thisSunday, "yyyy-MM-dd")}`);
      
      // For admin view, include the day before Monday
      const adminStartDate = isAdmin ? subDays(thisMonday, 1) : thisMonday;
      console.log(`Admin view, using modified start date: ${adminStartDate.toISOString()}`);
      console.log(`Admin start (formatted): ${formatInLatviaTime(adminStartDate, "yyyy-MM-dd")}`);
      
      // Extra debug for admin view
      if (isAdmin) {
        console.log(`ADMIN VIEW DATE RANGE:`);
        console.log(`Start (Sunday): ${formatInLatviaTime(adminStartDate, "yyyy-MM-dd")}`);
        console.log(`Monday: ${formatInLatviaTime(thisMonday, "yyyy-MM-dd")}`);
        console.log(`End (Sunday): ${formatInLatviaTime(thisSunday, "yyyy-MM-dd")}`);
      }
      
      // Ensure both calendar and parent are in sync immediately
      console.log(`BookingCalendar: Going to today (${formatInLatviaTime(todayInLatvia, "yyyy-MM-dd")}) - Monday: ${formatInLatviaTime(thisMonday, "yyyy-MM-dd")}`);
      console.log(`BookingCalendar: Explicitly notifying parent of date change to: ${formatInLatviaTime(adminStartDate, "yyyy-MM-dd")} - ${formatInLatviaTime(thisSunday, "yyyy-MM-dd")}`);
      
      // Direct callback to parent with correct dates
      onDateRangeChange(adminStartDate, thisSunday);
    }
  };
  
  // Fetch time slots from the server with their actual statuses
  const { data: dbTimeSlots, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['/api/timeslots', formatInLatviaTime(startDate, 'yyyy-MM-dd'), formatInLatviaTime(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Format dates in Latvia timezone to ensure consistent data across timezones
      const formattedStartDate = formatInLatviaTime(startDate, 'yyyy-MM-dd');
      const formattedEndDate = formatInLatviaTime(endDate, 'yyyy-MM-dd');
      
      const response = await fetch(
        `/api/timeslots?startDate=${formattedStartDate}&endDate=${formattedEndDate}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch time slots');
      }
      
      return response.json();
    }
  });
  
  // Fetch configuration data including visibility settings
  const { data: configData } = useQuery({
    queryKey: ['/api/config'],
    queryFn: async () => {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      return res.json();
    }
  });
  
  // Fetch lead time settings for booking restrictions
  const { data: leadTimeSettings } = useQuery({
    queryKey: ['/api/admin/lead-time-settings'],
    queryFn: getQueryFn<any>({ on401: "returnNull" }),
    staleTime: 60000,
    retry: false,
  });
  
  // Fetch all bookings to check for booking-based lead time restrictions
  const { data: bookingsData } = useQuery({
    queryKey: ['/api/bookings'],
    queryFn: getQueryFn<any[]>({ on401: "returnEmptyArray" }),
    staleTime: 60000,
  });
  
  // Determine if we're viewing a week that has no time slots
  // This could be a future week that hasn't been generated yet
  const isFutureWeekWithNoSlots = useMemo(() => {
    // If we have time slots, this week has data
    if (dbTimeSlots?.timeSlots?.length > 0) {
      return false;
    }
    
    // If we're still loading, we don't know yet
    if (timeSlotsLoading) {
      return false;
    }
    
    // If we have data response but no time slots, this is likely a future week with no generated slots
    return true;
  }, [dbTimeSlots, timeSlotsLoading]);
  
  // Function to check if a UI slot is selected 
  const isSlotSelected = (uiSlotId: string | number): boolean => {
    // We need to normalize the ID for comparison
    const id = typeof uiSlotId === 'string' ? parseInt(uiSlotId) : uiSlotId;
    
    // For admin mode, check against adminSelectedSlots
    if (isAdmin) {
      // Directly check if the ID exists in adminSelectedSlots
      const isAdminSelected = adminSelectedSlots.some(slot => slot.id === id);
      
      // Log selection status for debugging 
      if (isAdminSelected) {
        console.log(`Admin slot SELECTED: ${id}`);
      }
      
      return isAdminSelected;
    }
    
    // For regular mode, use the booking context
    const isSelected = selectedTimeSlots.some(slot => slot.id === id);
    
    return isSelected;
  };
  
  // Create a Latvian week (Monday-Sunday) from current date
  // For admin view, we show yesterday + the current week (8 columns total)
  const days = useMemo(() => {
    const today = toLatviaTime(new Date());
    
    // For admin view, we want to show yesterday + current week (Mon-Sun)
    // For regular view, we show the current week (Mon-Sun) based on currentDate
    let daysArray = [];
    
    if (isAdmin) {
      // For admin view, we want to generate column headers in the proper Monday-to-Sunday order
      // Use the currentDate (which changes when navigating between weeks)
      
      // Get the Latvian day index for the currentDate (0=Monday, 6=Sunday)
      const latvianDayIndexForDate = getLatvianDayIndexFromDate(currentDate);
      
      // Calculate the Monday of the selected week
      const mondayDate = addDays(currentDate, -latvianDayIndexForDate);
      
      console.log(`Admin view - Week calculation:
        Selected week date: ${formatInLatviaTime(currentDate, "EEE, MMM d, yyyy")}
        Current day index (Latvia): ${latvianDayIndexForDate} 
        Monday of week: ${formatInLatviaTime(mondayDate, "EEE, MMM d, yyyy")}
      `);
      
      // Create the 7 days of the week (Mon-Sun) in order
      for (let i = 0; i < 7; i++) {
        const date = addDays(mondayDate, i);
        daysArray.push({
          date: date,
          name: formatInLatviaTime(date, "EEE"),
          day: formatInLatviaTime(date, "d"),
          latvianDayIndex: i // Monday=0, Sunday=6 in Latvian system
        });
      }
      
      // Log the generated dates for debugging
      console.log(`Admin view - Column dates in order:`);
      daysArray.forEach((day, i) => {
        console.log(`Column ${i+1}: ${formatInLatviaTime(day.date, "EEE, MMM d, yyyy")}, Latvian index: ${day.latvianDayIndex}`);
      });
    } else {
      // Regular user view just shows the current week (Mon-Sun)
      const latvianDayIndexForToday = getLatvianDayIndexFromDate(currentDate);
      const mondayDate = addDays(currentDate, -latvianDayIndexForToday);
      
      console.log(`Regular view - Week calculation:
        Current date: ${formatInLatviaTime(currentDate, "EEE, MMM d")}
        Monday of week: ${formatInLatviaTime(mondayDate, "EEE, MMM d")}
      `);
      
      // Create array of 7 days (Monday-Sunday)
      for (let i = 0; i < 7; i++) {
        const date = addDays(mondayDate, i);
        daysArray.push({
          date,
          name: formatInLatviaTime(date, "EEE"),
          day: formatInLatviaTime(date, "d"),
          latvianDayIndex: i // Monday=0, Sunday=6 in Latvian system
        });
      }
    }
    
    return daysArray;
  }, [currentDate, isAdmin]);
  
  // Build status map from database time slots
  const dbStatusMap = useMemo(() => {
    const map = new Map();
    
    if (dbTimeSlots && dbTimeSlots.timeSlots && Array.isArray(dbTimeSlots.timeSlots)) {
      console.log("Database time slots loaded:", dbTimeSlots.timeSlots.length);
      
      // Create a map of database time slot statuses by ID for quick lookup
      dbTimeSlots.timeSlots.forEach((dbSlot: SchemaTimeSlot) => {
        map.set(dbSlot.id, {
          status: dbSlot.status
        });
      });
    }
    
    return map;
  }, [dbTimeSlots]);
  
  // Generate time slots grid using ONLY slots from the database
  const timeSlots = useMemo(() => {
    const slots: CalendarTimeSlot[] = [];
    
    // Only proceed if we have database time slots
    if (!dbTimeSlots || !dbTimeSlots.timeSlots || !Array.isArray(dbTimeSlots.timeSlots)) {
      return slots;
    }

    // Create calendar time slots ONLY from database time slots
    dbTimeSlots.timeSlots.forEach((dbSlot: SchemaTimeSlot) => {
      // Convert dates from UTC to Latvia time zone
      // This is crucial to ensure times display correctly in the UI
      const startTime = toLatviaTime(dbSlot.startTime);
      const endTime = toLatviaTime(dbSlot.endTime);
      
      // Debug log to help diagnose timezone issues
      if (isAdmin) {
        console.log(`Time slot ${dbSlot.id}:`, {
          rawStart: dbSlot.startTime,
          latviaStart: formatInLatviaTime(dbSlot.startTime, "yyyy-MM-dd HH:mm:ss"),
          convertedHour: startTime.getHours()
        });
      }
      
      // Get the JS day of week for this time slot
      const jsDayOfWeek = startTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Convert to Latvian day index for UI display (0 = Monday)
      const latvianDayIndex = getLatvianDayIndexFromDate(startTime);
      
      // CRITICAL FIX: Instead of using day difference, match the slot to the current week days
      // based on Latvian day index (Monday-Sunday)
      let matchedDate: Date | null = null;
      
      // Try to find the correct day from our days array by matching the Latvian day index
      for (const dayInfo of days) {
        if (dayInfo.latvianDayIndex === latvianDayIndex) {
          // Found the day in the current week that matches this slot's day of week
          matchedDate = dayInfo.date;
          break;
        }
      }
      
      if (!matchedDate) {
        console.error(`Could not find a matching day for slot ${dbSlot.id} with Latvian day index ${latvianDayIndex}`);
        return; // Skip this slot if we can't match a day
      }
      
      // Create a new date with the correct day from our days array, but keep the original time
      const correctedStartTime = new Date(matchedDate);
      correctedStartTime.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      
      const correctedEndTime = new Date(matchedDate);
      correctedEndTime.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
      
      // Debug our mapping
      console.log(`SLOT MAPPING: Original date: ${formatInLatviaTime(startTime, "EEE, MMM d, yyyy HH:mm")}, 
                   Mapped to week day: ${formatInLatviaTime(correctedStartTime, "EEE, MMM d, yyyy HH:mm")},
                   Latvian day index: ${latvianDayIndex}`);
      
      // Get time components from the converted Latvia time
      const hour = correctedStartTime.getHours();
      const minute = correctedStartTime.getMinutes();
      
      // Use database price if available
      const price = dbSlot.price || 15;
      
      // Use database status
      const status = dbSlot.status as TimeSlotStatus;
      
      // Check if the slot is in the past
      const now = new Date();
      
      // First check if the date is in the past (before today)
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const slotDate = new Date(correctedStartTime.getFullYear(), correctedStartTime.getMonth(), correctedStartTime.getDate());
      const isPastDay = slotDate < todayDate;
      
      // Then check if it's today but the time has already passed
      const isToday = slotDate.getTime() === todayDate.getTime();
      const isPastTime = isToday && correctedEndTime < now;
      
      // IMPORTANT: For admin view, we want to show today's bookings even if they're in the past
      // So we'll only mark slots as "past" if they're from a previous day
      const isPast = isPastDay; // Do not include isPastTime for admin view
      
      // For slots during important hours, log detailed information
      if (hour >= 13 && hour <= 16) {
        console.log(`Slot ${dbSlot.id} timing:`, {
          date: formatInLatviaTime(correctedStartTime, "yyyy-MM-dd"),
          time: formatInLatviaTime(correctedStartTime, "HH:mm"),
          status: dbSlot.status,
          isPastDay,
          isToday,
          isPastTime,
          isPast
        });
      }
      
      slots.push({
        id: dbSlot.id.toString(),
        day: days.indexOf(days.find(d => d.latvianDayIndex === latvianDayIndex) || days[0]), // Fallback to first day if not found
        latvianDayIndex,
        hour,
        minute,
        price,
        status,
        startTime: correctedStartTime, // Use the corrected time that's mapped to the current week
        endTime: correctedEndTime,     // Use the corrected time that's mapped to the current week
        storageTimezone: dbSlot.storageTimezone || 'UTC', // Use database timezone or default to UTC
        isPast,
        originalStartTime: startTime, // Keep original for reference
        originalEndTime: endTime      // Keep original for reference
      });
    });
    
    return slots;
  }, [currentDate, dbTimeSlots]);
  
  // Get time slots for a specific time (e.g. "8:00")
  const getTimeSlotsForTime = (hour: number, minute: number) => {
    // Get all slots matching this time
    const matchingSlots = timeSlots.filter(slot => 
      slot.hour === hour && slot.minute === minute);
    
    // Create an array of slots (7 for both views since we're using the current week's days) 
    const slotsForWeek = Array(7).fill(undefined);
    
    // For important hours, log detailed information
    if ((hour === 13 || hour === 14 || hour === 15 || hour === 16) && minute === 0) {
      console.log(`Matching slots for ${hour}:${minute} - ${matchingSlots.length} slots found`);
      matchingSlots.forEach((slot, idx) => {
        console.log(`Slot ${idx}: day=${slot.latvianDayIndex}, hour=${slot.hour}, minute=${slot.minute}, status=${slot.status}, date=${formatInLatviaTime(slot.startTime, "EEE, MMM d")}`);
      });
    }
    
    // Place slots in the correct position
    matchingSlots.forEach(slot => {
      if (isAdmin) {
        // For admin view (7 columns, Monday-Sunday)
        // Get the actual date of the slot
        const slotDate = new Date(slot.startTime);
        
        // Find index of the column this slot belongs to by comparing dates
        const columnIndex = days.findIndex(day => {
          const dayDate = new Date(day.date);
          return dayDate.getFullYear() === slotDate.getFullYear() &&
                 dayDate.getMonth() === slotDate.getMonth() &&
                 dayDate.getDate() === slotDate.getDate();
        });
        
        if (columnIndex !== -1) {
          slotsForWeek[columnIndex] = slot;
          
          // For today's bookings, add detailed log to help debug
          const now = new Date();
          const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const slotOnlyDate = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
          const isToday = slotOnlyDate.getTime() === todayDate.getTime();
          
          if (isToday && slot.status === "booked" && (hour === 13 || hour === 14 || hour === 15 || hour === 16)) {
            console.log(`TODAY'S BOOKING: ${formatInLatviaTime(slot.startTime, "HH:mm")} placed in column ${columnIndex}, status: ${slot.status}`);
          }
        } else {
          // Log error if we can't find a matching day
          console.error(`Could not find column for slot date: ${formatInLatviaTime(slotDate, "EEE, MMM d")}`);
        }
      } else {
        // For regular view (7 columns, Monday-Sunday), use latvianDayIndex directly (0-6)
        if (slot.latvianDayIndex !== undefined && slot.latvianDayIndex >= 0 && slot.latvianDayIndex < 7) {
          slotsForWeek[slot.latvianDayIndex] = slot;
        } else {
          console.error(`Invalid latvianDayIndex: ${slot.latvianDayIndex} for slot`);
        }
      }
    });
    
    return slotsForWeek;
  };
  
  // Helper to check if a date is yesterday
  const isDateYesterday = (date: Date, today: Date): boolean => {
    const dateObj = new Date(date);
    const todayObj = new Date(today);
    
    // Reset time parts to compare only the dates
    dateObj.setHours(0, 0, 0, 0);
    todayObj.setHours(0, 0, 0, 0);
    
    // Yesterday is today - 1 day
    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(todayObj.getDate() - 1);
    
    return dateObj.getTime() === yesterdayObj.getTime();
  };
  
  // Get all time strings in format "HH:MM"
  // For admin view, show fixed time range from 8:00 to 22:00 regardless of existing slots
  const allTimeStrings = isAdmin 
    ? Array.from({ length: 29 }, (_, i) => {
        const hour = Math.floor(i / 2) + 8; // Start at 8:00
        const minute = (i % 2) * 30; // Alternate between 0 and 30 minutes
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      })
    : Array.from(new Set(timeSlots.map(slot => 
        `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
      ))).sort();
  
  // Format time from hour and minute, using the Latvia timezone
  const formatTimeFromComponents = (hour: number, minute: number) => {
    // Create a date object with the given hour and minute
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    
    // Format it using our utility function that handles Latvia timezone
    return formatTime(date, false);
  };
  
  // Toggle slot selection
  // Function to check if a slot is restricted by lead time settings
  const isSlotRestrictedByLeadTime = (slot: CalendarTimeSlot): boolean => {
    // If we're in admin mode, no lead time restrictions apply
    if (isAdmin) return false;
    
    // If lead time settings aren't loaded yet or no restrictions, allow booking
    if (!leadTimeSettings) return false;
    if (leadTimeSettings.restrictionMode === "off") return false;
    
    // If operator is on-site, override all restrictions
    if (leadTimeSettings.operatorOnSite) return false;
    
    // Get current date and slot date
    const now = new Date();
    const slotDate = new Date(slot.startTime);
    
    // Calculate the date difference in days (accounting for time of day)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const slotDay = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
    
    // Calculate days difference
    const diffTime = slotDay.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Get lead time in days
    const leadTimeDays = leadTimeSettings.leadTimeDays || 0;
    
    // The key issue: With a lead time of 1 day, slots 1 day ahead should be restricted
    // In other words, if lead time is 1 day and today is 6th, then 7th should be restricted
    // Since diffDays would be 1, we need to use <= instead of <
    const isWithinLeadTime = diffDays <= leadTimeDays;
    
    console.log(`Lead time check: Slot date=${formatInLatviaTime(slotDate, 'yyyy-MM-dd')}, Today=${formatInLatviaTime(today, 'yyyy-MM-dd')}, Days difference=${diffDays}, Lead time required=${leadTimeDays}, Restricted=${isWithinLeadTime}, Mode=${leadTimeSettings.restrictionMode}`);
    
    // If in "booking_based" mode, we need to check if there are any bookings for this day
    if (leadTimeSettings.restrictionMode === "booking_based" && isWithinLeadTime) {
      // TODO: Check if there are any bookings for this day
      // For now, we'll enforce the restriction
      return true;
    }
    
    // For "enforced" mode, simply check if we're within lead time
    return leadTimeSettings.restrictionMode === "enforced" && isWithinLeadTime;
  };
  
  // Function to check if a day is affected by lead time restrictions
  const isDayRestrictedByLeadTime = (date: Date): boolean => {
    // If we're in admin mode, no lead time restrictions apply
    if (isAdmin) return false;
    
    // If lead time settings aren't loaded yet or no restrictions, allow booking
    if (!leadTimeSettings) return false;
    if (leadTimeSettings.restrictionMode === "off") return false;
    
    // If operator is on-site, override all restrictions
    if (leadTimeSettings.operatorOnSite) return false;
    
    // Get current date and calculate difference
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Calculate days difference
    const diffTime = dayDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Get lead time in days
    const leadTimeDays = leadTimeSettings.leadTimeDays || 0;
    // Make sure to use the same logic as isSlotRestrictedByLeadTime
    return diffDays <= leadTimeDays;
  };

  const handleSlotToggle = (slotId: string, status: TimeSlotStatus) => {
    // Find the actual slot object - compare both as strings
    const slot = timeSlots.find(s => String(s.id) === slotId);
    if (!slot) return;
    
    // Check if the slot is in the past
    if (slot.isPast && !isAdmin) {
      // Regular users cannot interact with past slots
      console.log(`Cannot select past slot ${slotId}`);
      return;
    }
    
    // Check lead time restrictions (for non-admin users)
    if (!isAdmin && isSlotRestrictedByLeadTime(slot)) {
      // Use a more subtle, non-destructive toast
      toast({
        title: "Booking needs planning",
        description: "For bookings this close to the date, please contact us directly to check availability.",
        variant: "default", // Use default style instead of destructive
        duration: 5000,
      });
      return;
    }
    
    // Convert our UI slot to a schema slot before passing to context
    const schemaSlot = toSchemaTimeSlot(slot);
    
    // If in admin mode, pass to admin handler which will handle logic based on status
    if (isAdmin && onAdminSlotSelect) {
      onAdminSlotSelect(schemaSlot);
      return;
    }
    
    // For regular users, only allow selecting available slots
    if (status !== "available") return;
    
    // Update booking context
    toggleTimeSlot(schemaSlot);
  };
  
  // Import useLocation from wouter
  const [_, navigate] = useLocation();
  
  // Proceed to booking form without reserving slots
  const proceedToBooking = () => {
    if (selectedTimeSlots.length === 0) {
      toast({
        title: "No Time Slots Selected",
        description: "Please select at least one time slot before proceeding.",
        variant: "destructive"
      });
      return;
    }
    
    // Navigate to booking page
    navigate("/booking");
  };
  
  // Get CSS class for time slot based on status, selection, past status, and lead time restriction
  const getSlotClass = (status: TimeSlotStatus, isSelected: boolean, isPast: boolean = false, slot?: CalendarTimeSlot) => {
    // If admin mode and selected, force use of our special CSS class
    if (isAdmin && isSelected) {
      // Use a very prominent style for admin selected slots to ensure they stand out
      return "!border-4 !border-blue-500 !bg-blue-100 !text-blue-900 !font-semibold !z-50 !shadow-md";
    }
    
    // Handle past slots differently
    if (isPast) {
      // For both admin and user views, show past slots with different styling
      switch (status) {
        case "available":
          return "bg-gray-300 text-gray-700 border-gray-400 cursor-not-allowed opacity-60";
        case "booked":
          return "bg-amber-700 bg-opacity-20 text-amber-900 border-amber-700 cursor-not-allowed opacity-60";
        default:
          return "bg-gray-400 text-gray-800 border-gray-500 cursor-not-allowed opacity-60";
      }
    }
    
    // Check if this slot is restricted by lead time (only for non-admin view)
    const isRestricted = !isAdmin && slot && isSlotRestrictedByLeadTime(slot);
    
    // For regular user view (future slots)
    if (!isAdmin) {
      // Regular user selected slots styling
      if (isSelected) {
        return "bg-primary text-primary-foreground hover:bg-primary/90";
      }
      
      // Lead time restricted slot has paler styling
      if (isRestricted) {
        switch (status) {
          case "available":
            return "bg-blue-50 text-blue-400 border-blue-100 cursor-help opacity-60"; // Pale blue for restricted slots
          case "booked":
            return "bg-amber-50 text-amber-400 border-amber-100 cursor-not-allowed opacity-60"; 
          default:
            return "bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed opacity-60";
        }
      }
      
      // Regular user slot status styling (non-restricted)
      switch (status) {
        case "available":
          return "bg-green-100 text-green-800 hover:bg-green-200";
        case "booked":
          return "bg-amber-100 text-amber-800 cursor-not-allowed opacity-70";
        default:
          return "bg-gray-100 text-gray-800";
      }
    }
    
    // Admin slot status styling (not selected, future slots)
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 hover:bg-green-200 hover:scale-105 transition-transform";
      case "booked":
        return "bg-amber-100 text-amber-800 hover:bg-amber-200 hover:scale-105 transition-transform";
      default:
        return "bg-gray-100 text-gray-800 hover:scale-105 transition-transform";
    }
  };
  
  // Calculate total price
  const calculateTotalPrice = () => {
    return selectedTimeSlots.reduce((total, slot) => total + slot.price, 0);
  };
  
  // Get selected time range for display
  const getSelectedTimeRange = () => {
    if (selectedTimeSlots.length === 0) return null;
    
    // Sort the slots by their start time
    const selected = [...selectedTimeSlots].sort((a, b) => 
      a.startTime && b.startTime 
        ? a.startTime.getTime() - b.startTime.getTime() 
        : 0
    );
    
    if (selected.length === 0) return null;
    
    // Ensure we're using the correct days from our days array for display consistency
    // This fixes mismatches between calendar header dates and selection summary

    // First, create a map of Latvia day indices to dates from our days array
    const dayMap = new Map();
    days.forEach(day => {
      dayMap.set(day.latvianDayIndex, day.date);
    });
    
    // Group slots by date for clearer display, using the consistent day map
    const slotsByDate = selected.reduce((acc, slot) => {
      if (!slot.startTime) return acc;
      
      // Get the Latvian day index for this slot
      const latvianDayIndex = getLatvianDayIndexFromDate(slot.startTime);
      
      // Use the matching date from our days array if available
      const displayDate = dayMap.get(latvianDayIndex) || slot.startTime;
      
      // Format the date part only (e.g. "Mon, May 5")
      const dateKey = formatInLatviaTime(displayDate, "EEE, MMM d");
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      
      acc[dateKey].push(slot);
      return acc;
    }, {} as Record<string, typeof selected>);
    
    // Create a formatted list of dates and their time ranges
    return Object.entries(slotsByDate).map(([date, slots]) => {
      // Sort slots by start time
      slots.sort((a, b) => 
        a.startTime && b.startTime
          ? a.startTime.getTime() - b.startTime.getTime()
          : 0
      );
      
      const firstSlot = slots[0];
      const lastSlot = slots[slots.length - 1];
      
      if (!firstSlot.startTime || !lastSlot.endTime) return null;
      
      // Format time only (e.g. "14:00-15:30")
      const timeRange = `${formatInLatviaTime(firstSlot.startTime, "HH:mm")}-${formatInLatviaTime(lastSlot.endTime, "HH:mm")}`;
      
      return `${date}: ${timeRange}`;
    }).join(", ");
  };

  // Show loading state while time slots are being fetched
  if (timeSlotsLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-1 pt-2 px-2">
          <div className="flex justify-center items-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Loading calendar...</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-1 pt-2 px-2">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {formatInLatviaTime(days[0].date, "MMMM d")} - {formatInLatviaTime(days[6].date, "MMMM d, yyyy")} 
            <span className="text-xs text-muted-foreground ml-1">({LATVIA_TIMEZONE})</span>
          </p>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={customNavigation ? customNavigation.goToPrevious : goToPreviousWeek}
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={customNavigation?.goToToday || goToToday}
              className="h-8 px-2 text-xs"
              title="Go to today"
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={customNavigation ? customNavigation.goToNext : goToNextWeek}
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* If we're viewing a week with no time slots */}
        {isFutureWeekWithNoSlots && !isAdmin ? (
          <div className="flex flex-col justify-center items-center py-8 my-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <CalendarIcon className="h-10 w-10 text-muted-foreground mb-2" />
            <h3 className="text-lg font-medium">No time slots available</h3>
            <p className="text-sm text-muted-foreground mb-3 text-center max-w-lg">
              There are no time slots available for this week yet.
              Please check back later or select an earlier date.
            </p>
            <Button variant="outline" onClick={customNavigation?.goToToday || goToToday}>
              Go to current week
            </Button>
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-0 border border-gray-200 rounded">
              {/* Column Headers */}
              <div className="p-2 border-r border-gray-200"></div>
              {days.map((day, i) => (
                <div 
                  key={i}
                  className={cn(
                    "p-2 text-center font-medium text-xs border-b border-r border-gray-200",
                    isToday(day.date) && "bg-blue-50"
                  )}
                >
                  <div className={isToday(day.date) ? "text-blue-500" : "text-muted-foreground"}>
                    {day.name}
                  </div>
                  <div className={isToday(day.date) ? "text-blue-600" : ""}>
                    {day.day}
                  </div>
                  {/* No longer using badges for restricted days */}
                </div>
              ))}

              {/* Time Rows */}
              {allTimeStrings.map((timeStr) => {
                const [hourStr, minuteStr] = timeStr.split(":");
                const hour = parseInt(hourStr);
                const minute = parseInt(minuteStr);
                
                // Get slots for this time across all days
                const slotsForTime = getTimeSlotsForTime(hour, minute);
                
                return (
                  <React.Fragment key={timeStr}>
                    {/* Time Label */}
                    <div className="p-2 text-xs font-medium text-muted-foreground flex items-center justify-end h-14 border-r border-b border-gray-200">
                      {formatTimeFromComponents(hour, minute)}
                    </div>
                    
                    {/* Slots for each day */}
                    {Array.from({ length: days.length }).map((_, dayIndex) => {
                      const slot = slotsForTime[dayIndex];
                      
                      if (!slot) {
                        // No slot exists for this day and time
                        if (isAdmin && onAdminSlotSelect) {
                          // Create a temporary empty slot for admin
                          const dayDate = days[dayIndex].date;
                          
                          // Create the time for this slot
                          const slotDate = new Date(dayDate);
                          slotDate.setHours(hour, minute, 0, 0);
                          
                          // Create an end time (30 minutes later)
                          const endDate = new Date(slotDate);
                          endDate.setMinutes(endDate.getMinutes() + 30);
                          
                          // Use our universal time slot ID generator from schema.ts
                          // This ensures all slots for the same time period have the same ID
                          // regardless of whether they're from database or empty slots
                          const slotId = generateTimeSlotId(slotDate, 30, false); // Use local time
                          
                          // For React's key property, we need a unique string
                          // We use the universal ID as the base for consistency
                          const cellKey = `empty-${slotId}`;
                          
                          // We still need a numeric ID for compatibility with existing code
                          // so we'll create a negative hash of the string ID
                          const tempId = -1 * Math.abs(slotId.split("").reduce((a: number, b: string) => {
                            a = ((a << 5) - a) + b.charCodeAt(0);
                            return a & a;
                          }, 0));
                          
                          // For checking selection of empty slots, we can use the universal ID for consistency
                          // This is more reliable than matching by time components as we did before
                          const isEmptySlotSelected = adminSelectedSlots.some(slot => {
                            // For database slots with positive IDs, we don't match here
                            if (slot.id > 0) return false;
                            
                            // Generate a universal ID for the slot in the selection
                            const selectedSlotId = generateTimeSlotId(new Date(slot.startTime), 30, false);
                            
                            // Direct string comparison of universal IDs
                            const exactMatch = selectedSlotId === slotId;
                            
                            if (exactMatch) {
                              console.log(`MATCHED EMPTY SLOT: Universal ID ${slotId} matches selected slot`);
                            }
                            
                            return exactMatch;
                          });
                          
                          // Define a function to handle click on the empty slot
                          const handleEmptySlotClick = () => {
                            // Create a schema-compatible time slot object
                            const tempSlot: SchemaTimeSlot = {
                              id: tempId, // Use numeric ID
                              startTime: slotDate,
                              endTime: endDate,
                              status: 'available', // Treat as available for simplicity
                              price: 0, // No price set yet
                              storageTimezone: 'UTC'
                            };
                            
                            console.log(`Empty slot ${cellKey} with ID ${tempId} clicked`);
                            // Pass to the admin handler
                            onAdminSlotSelect(tempSlot);
                          };
                          
                          // Simplified class handling for empty slots - always use a distinct class name
                          const emptySlotClasses = isEmptySlotSelected
                            ? "empty-slot-selected h-14 border-4 border-blue-500 bg-blue-100 text-blue-900 font-semibold z-50 flex items-center justify-center cursor-pointer"
                            : "empty-slot-unselected h-14 border-r border-b border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-center";
                          
                          // Render a clickable empty slot for admin
                          return (
                            <div 
                              key={cellKey} 
                              className={emptySlotClasses}
                              onClick={handleEmptySlotClick}
                              data-id={tempId}
                            >
                              {isAdmin && (
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                  </svg>
                                </span>
                              )}
                            </div>
                          );
                        }
                        
                        // For regular users or non-interactive admin view, show empty cell
                        return <div key={`empty-regular-${dayIndex}-${hour}-${minute}`} className="h-14 border-r border-b border-gray-200"></div>;
                      }
                      
                      // Determine if this slot is "selected" (i.e., in the booking context's selection or admin's selection)
                      const isSelected = isSlotSelected(slot.id);
                      
                      if (isAdmin) {
                        // For admin interface, return the special AdminTimeSlot component
                        return (
                          <AdminTimeSlot
                            key={`slot-${slot.id}-${dayIndex}`}
                            slot={slot}
                            isSelected={isSelected}
                            getSlotClass={getSlotClass}
                            onToggle={handleSlotToggle}
                          />
                        );
                      } else {
                        // For regular user, show slot with price and selection tracking
                        return (
                          <div
                            key={`regular-slot-${slot.id}-${dayIndex}`}
                            className={cn(
                              "h-14 border-r border-b border-gray-200 flex flex-col justify-center items-center p-1 relative cursor-pointer",
                              getSlotClass(slot.status, isSelected, !!slot.isPast, slot)
                            )}
                            onClick={() => handleSlotToggle(slot.id, slot.status)}
                            title={isSlotRestrictedByLeadTime(slot) ? "For bookings this close to the date, please contact us directly" : undefined}
                          >
                            <div className="text-xs font-medium">{(slot.price).toFixed(0)}€</div>
                          </div>
                        );
                      }
                    })}
                  </React.Fragment>
                );
              })}
            </div>
            
            {/* Calendar Legend */}
            {!isAdmin && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded mr-2 bg-green-100 border border-green-200"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded mr-2 bg-amber-100 border border-amber-200"></div>
                  <span>Booked</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded mr-2 bg-primary border"></div>
                  <span>Selected</span>
                </div>
                {leadTimeSettings && leadTimeSettings.restrictionMode !== "off" && !leadTimeSettings.operatorOnSite && (
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded mr-2 bg-blue-50 border border-blue-100 opacity-60"></div>
                    <span>Restricted - contact us directly to check availability</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Lead time information for users */}
            {!isAdmin && leadTimeSettings && leadTimeSettings.restrictionMode !== "off" && !leadTimeSettings.operatorOnSite && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>For bookings within {leadTimeSettings.leadTimeDays} day{leadTimeSettings.leadTimeDays !== 1 ? 's' : ''} of today, please contact us directly by phone or email to verify availability.</p>
              </div>
            )}
            
            {/* Selected Time Slots (Regular user view only) */}
            {!isAdmin && selectedTimeSlots.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md border">
                <h3 className="font-medium text-sm mb-1">Selected Time Slots</h3>
                <div className="text-sm">{getSelectedTimeRange()}</div>
                <div className="mt-2 flex justify-between items-center">
                  <div className="font-medium">
                    Total: {calculateTotalPrice().toFixed(2)} €
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearSelectedTimeSlots}
                    >
                      Clear
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={proceedToBooking}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Proceed to Booking
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCalendar;