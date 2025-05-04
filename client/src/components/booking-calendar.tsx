import React, { useState, useEffect, useMemo } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { Link } from "wouter";
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
import { apiRequest } from "@/lib/queryClient";
import { TimeSlot as SchemaTimeSlot } from "@shared/schema";
import CalendarDay from "@/components/calendar-day";
import AdminTimeSlot from "@/components/admin/admin-time-slot";

type TimeSlotStatus = "available" | "booked" | "selected";

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
  reservationExpiry: Date | null;
  isPast?: boolean; // Flag to identify if this slot is in the past
  originalStartTime?: Date; // Original database date before week mapping
  originalEndTime?: Date; // Original database date before week mapping
}

interface BookingCalendarProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  isAdmin?: boolean;
  onAdminSlotSelect?: (timeSlot: SchemaTimeSlot) => void;
  adminSelectedSlots?: SchemaTimeSlot[]; // Allow admin component to pass selected slots
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
    reservationExpiry: slot.reservationExpiry,
    isPast: slot.isPast // Pass the isPast flag to AdminTimeSlot
  };
}

// Simplified booking calendar with mock data
const BookingCalendar = ({ isAdmin = false, onAdminSlotSelect, adminSelectedSlots = [] }: BookingCalendarProps) => {
  // Initialize currentDate to be the ACTUAL current date in Latvia timezone
  // This ensures the calendar shows the correct week
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Use Latvia timezone for initial state to ensure proper week calculation
    const todayInLatvia = toLatviaTime(new Date());
    console.log(`Initializing calendar with date: ${todayInLatvia.toISOString()} (Latvia time)`);
    return todayInLatvia;
  });
  
  // Use the booking context
  const { selectedTimeSlots, toggleTimeSlot, clearSelectedTimeSlots } = useBooking();
  // No longer fetching weather data per client request
  const { toast } = useToast();
  
  // Date range for the current week view
  // For admin view, include yesterday in the date range
  const startDate = isAdmin ? subDays(currentDate, 1) : currentDate;
  const endDate = addDays(currentDate, 6);
  
  // Navigation functions
  const goToPreviousWeek = () => {
    // For public calendar, prevent going to past weeks
    if (!isAdmin) {
      // Get today's date in Latvia timezone, reset to start of day
      const today = toLatviaTime(new Date());
      today.setHours(0, 0, 0, 0);
      
      // Calculate previous week date in Latvia timezone
      const prevWeekDate = toLatviaTime(subDays(currentDate, 7));
      prevWeekDate.setHours(0, 0, 0, 0);
      
      // If previous week would be before today, don't allow navigation
      if (prevWeekDate < today) {
        return;
      }
    }
    
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    setCurrentDate(subDays(currentDate, 7));
  };
  
  const goToNextWeek = () => {
    // Check if next week would be beyond visibility limit for regular users
    if (!isAdmin) {
      // Use Latvia timezone to ensure consistent visibility limits
      const threeWeeksFromToday = toLatviaTime(addDays(new Date(), 21)); // Typical visibility window
      const nextWeekDate = toLatviaTime(addDays(currentDate, 7));
      
      // If already viewing a week that's far in the future, show a toast notification
      if (nextWeekDate > threeWeeksFromToday) {
        toast({
          title: "Limited Visibility",
          description: "Booking schedule is only available up to 3 weeks in advance.",
          variant: "destructive"
        });
      }
    }
    
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    setCurrentDate(addDays(currentDate, 7));
  };
  
  const goToToday = () => {
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    // Use current date but ensure it's consistent with our timezone handling
    const todayInLatvia = toLatviaTime(new Date());
    setCurrentDate(todayInLatvia);
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
  
  // Determine if we're viewing a week beyond the calendar's configured visibility range
  const isFutureWeekBeyondVisibility = useMemo(() => {
    // If we have time slots, this week is within the visibility range
    if (dbTimeSlots?.timeSlots?.length > 0) {
      return false;
    }
    
    // If we're still loading, we don't know yet
    if (timeSlotsLoading) {
      return false;
    }
    
    // If we have data but no time slots, this could be a future week beyond visibility
    // A simple check: current date is more than 3 weeks in the future (typical visibility setting)
    // Use Latvia timezone for both dates to ensure proper comparison
    const todayInLatvia = toLatviaTime(new Date());
    const threeWeeksFromNow = addDays(todayInLatvia, 21);
    // Convert current date to Latvia time for comparison
    const currentDateInLatvia = toLatviaTime(currentDate);
    
    return currentDateInLatvia > threeWeeksFromNow;
  }, [dbTimeSlots, timeSlotsLoading, currentDate]);
  
  // Function to check if a UI slot is selected 
  const isSlotSelected = (uiSlotId: string): boolean => {
    // Parse the string ID to a number and compare directly
    const id = parseInt(uiSlotId);
    
    // For admin mode, use adminSelectedSlots instead of the booking context
    if (isAdmin) {
      const isAdminSelected = adminSelectedSlots.some(slot => slot.id === id);
      console.log(`Admin isSlotSelected checking id: ${id}, found in selected: ${isAdminSelected}, admin selected slots: `, 
                adminSelectedSlots.map(s => s.id));
      return isAdminSelected;
    }
    
    // For regular mode, use the booking context
    const isSelected = selectedTimeSlots.some(slot => slot.id === id);
    
    console.log(`Regular isSlotSelected checking id: ${id}, found in selected: ${isSelected}, selected slots: `, 
                selectedTimeSlots.map(s => s.id));
    
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
      // Admin view shows yesterday + current week
      
      // Get yesterday's date for the first column
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Get the current week's Monday (for consistent week view)
      const latvianDayIndexForToday = getLatvianDayIndexFromDate(today);
      const mondayDate = addDays(today, -latvianDayIndexForToday);
      
      console.log(`Admin view - Week calculation:
        Today: ${formatInLatviaTime(today, "EEE, MMM d")}
        Yesterday: ${formatInLatviaTime(yesterday, "EEE, MMM d")}
        Monday of this week: ${formatInLatviaTime(mondayDate, "EEE, MMM d")}
      `);
      
      // First column: yesterday
      daysArray.push({
        date: yesterday,
        name: formatInLatviaTime(yesterday, "EEE"),
        day: formatInLatviaTime(yesterday, "d"),
        latvianDayIndex: getLatvianDayIndexFromDate(yesterday) // Will be a consistent day index
      });
      
      // Next 7 columns: current week (Mon-Sun)
      for (let i = 0; i < 7; i++) {
        const date = addDays(mondayDate, i);
        daysArray.push({
          date,
          name: formatInLatviaTime(date, "EEE"),
          day: formatInLatviaTime(date, "d"),
          latvianDayIndex: i // Monday=0, Sunday=6 in Latvian system
        });
      }
      
      // Log the final days array for debugging
      daysArray.forEach((day, idx) => {
        console.log(`Admin day ${idx}: ${formatInLatviaTime(day.date, "EEE, MMM d")}, Latvian index: ${day.latvianDayIndex}`);
      });
    } else {
      // Regular user view just shows the current week based on currentDate
      // Get the Latvian day index for the current date (0=Monday, 1=Tuesday, etc)
      const latvianDayIndexForToday = getLatvianDayIndexFromDate(currentDate);
      
      // Calculate the date for Monday (start of Latvian week)
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
          status: dbSlot.status,
          reservationExpiry: dbSlot.reservationExpiry
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
      const reservationExpiry = dbSlot.reservationExpiry ? new Date(dbSlot.reservationExpiry) : null;
      
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
        reservationExpiry,
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
    // Adjust the hour to account for timezone difference (convert to local time for display)
    const matchingSlots = timeSlots.filter(slot => 
      // Check if the hour and minute match after timezone adjustment
      slot.hour === hour && slot.minute === minute);
    
    // Create an array of slots (7 for regular view, 8 for admin) - all initially undefined
    const slotsForWeek = Array(isAdmin ? 8 : 7).fill(undefined);
    
    // Log to debug for important hours
    if ((hour === 13 || hour === 14 || hour === 15 || hour === 16) && minute === 0) {
      console.log(`Matching slots for ${hour}:${minute} - ${matchingSlots.length} slots found`);
      matchingSlots.forEach((slot, idx) => {
        console.log(`Slot ${idx}: day=${slot.latvianDayIndex}, hour=${slot.hour}, minute=${slot.minute}, status=${slot.status}`);
      });
    }
    
    // Place slots in the correct day position based on latvianDayIndex
    matchingSlots.forEach(slot => {
      if (slot.latvianDayIndex === undefined) {
        console.error("Slot is missing latvianDayIndex:", slot);
        return;
      }
      
      // Default display index is the same as Latvian index
      let displayIndex = slot.latvianDayIndex;
      
      // For admin view with 8 columns (yesterday + this week)
      if (isAdmin) {
        // Get current date in Latvia time to identify yesterday
        const latviaToday = toLatviaTime(new Date());
        const yesterday = new Date(latviaToday);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // For slots from yesterday (shown in column 0) and today's week
        const slotDate = new Date(slot.startTime);
        
        // If slot is from yesterday, put it in column 0
        if (isDateYesterday(slotDate, latviaToday)) {
          displayIndex = 0;
        } else {
          // For current week slots (shift by 1 to make room for yesterday)
          displayIndex = slot.latvianDayIndex + 1;
        }
      }
      
      // Make sure the index is valid for our array
      if (displayIndex >= 0 && displayIndex < slotsForWeek.length) {
        slotsForWeek[displayIndex] = slot;
      } else {
        console.error(`Invalid display index: ${displayIndex} for slot with latvianDayIndex: ${slot.latvianDayIndex}`, slot);
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
  const handleSlotToggle = (slotId: string, status: TimeSlotStatus) => {
    // Find the actual slot object
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;
    
    // Check if the slot is in the past
    if (slot.isPast && !isAdmin) {
      // Regular users cannot interact with past slots
      console.log(`Cannot select past slot ${slotId}`);
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
    
    // Navigate to booking page right away without showing a toast
  };
  
  // Get CSS class for time slot based on status and whether it's in the past
  const getSlotClass = (status: TimeSlotStatus, isSelected: boolean, isPast: boolean = false) => {
    // If admin mode and selected, force use of our special CSS class
    if (isAdmin && isSelected) {
      // Return the global admin-selected-slot class to override everything else with more subtle styling
      return "admin-selected-slot border-2 border-red-400 bg-red-100 text-red-900 font-semibold transform scale-105 z-50 shadow-md";
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
    
    // For regular user view (future slots)
    if (!isAdmin) {
      // Regular user selected slots styling
      if (isSelected) {
        return "bg-primary text-primary-foreground hover:bg-primary/90";
      }
      
      // Regular user slot status styling
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
              onClick={goToPreviousWeek}
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={goToToday}
              className="h-8 px-2 text-xs"
              title="Go to today"
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={goToNextWeek}
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-visible">
        {/* Time and day headers */}
        <div className="flex pl-1">
          {/* Time column header */}
          <div className="w-10 flex-shrink-0"></div>
          
          {/* Day columns headers - adjusted cols based on admin view */}
          <div className={`flex-1 grid ${isAdmin ? 'grid-cols-8' : 'grid-cols-7'} gap-1`}>
            {/* Slice to show correct number of days (8 for admin, 7 for regular) */}
            {days.slice(0, isAdmin ? 8 : 7).map((day, index) => {
              // Check if this day is today using Latvia timezone
              const latviaToday = toLatviaTime(new Date());
              const dayInLatvia = toLatviaTime(day.date);
              
              // Compare year, month, and day
              const isCurrentDay = 
                dayInLatvia.getFullYear() === latviaToday.getFullYear() &&
                dayInLatvia.getMonth() === latviaToday.getMonth() &&
                dayInLatvia.getDate() === latviaToday.getDate();
              
              // Check if this day is in the past
              const isPastDay = dayInLatvia < new Date(
                latviaToday.getFullYear(), 
                latviaToday.getMonth(), 
                latviaToday.getDate()
              );
              
              // Set classes based on date status
              let containerClass = 'text-center py-2';
              let dayNameClass = 'font-medium text-sm';
              let dayNumberClass = 'text-xs';
              
              if (isCurrentDay) {
                containerClass += ' bg-blue-50 rounded-md';
                dayNameClass += ' text-blue-700';
                dayNumberClass += ' text-blue-600';
              } else if (isPastDay) {
                containerClass += ' bg-gray-50';
                dayNameClass += ' text-gray-600';
                dayNumberClass += ' text-gray-500';
              } else {
                dayNumberClass += ' text-muted-foreground';
              }
              
              return (
                <div key={index} className={containerClass}>
                  <div className={dayNameClass}>
                    {day.name}
                  </div>
                  <div className={dayNumberClass}>{day.day}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Future week message */}
        {!isAdmin && isFutureWeekBeyondVisibility && (
          <div className="py-8 px-4 text-center bg-blue-50 rounded-md mt-4">
            <h3 className="text-lg font-medium text-blue-800 mb-2">Future Availability</h3>
            <p className="text-blue-700 mb-3">
              Availability for this week will be published later. 
            </p>
            <p className="text-sm text-blue-600">
              For special requests or inquiries for this period, please call:
              <a 
                href="tel:+37125422219" 
                className="block mt-1 font-bold hover:underline"
              >
                +371 25422219
              </a>
            </p>
          </div>
        )}
        
        {/* Calendar grid with time slots */}
        <div className="mt-2">
          {(!isFutureWeekBeyondVisibility || isAdmin) && allTimeStrings.map(timeString => {
            const [hourStr, minuteStr] = timeString.split(':');
            const hour = parseInt(hourStr);
            const minute = parseInt(minuteStr);
            const slots = getTimeSlotsForTime(hour, minute);
            
            // Add hourly separator
            if (minute === 0) {
              return (
                <div key={`time-block-${timeString}`}>
                  <div className="flex w-full mb-1 mt-2 first:mt-0">
                    <div className="w-10 flex-shrink-0"></div>
                    <div className="flex-1 border-t border-gray-200"></div>
                  </div>
                  
                  <div className="flex mb-1 items-start">
                    {/* Time column */}
                    <div className="w-10 flex-shrink-0 pt-2 pr-1 text-right">
                      <span className="text-xs font-medium text-gray-500">{timeString}</span>
                    </div>
                    
                    {/* Slots for this time - dynamic grid */}
                    <div className={`flex-1 grid ${isAdmin ? 'grid-cols-8' : 'grid-cols-7'} gap-1`}>
                      {Array.from({ length: isAdmin ? 8 : 7 }).map((_, idx) => {
                        const slot = slots[idx];
                        
                        // Find the corresponding day to check if it's today using Latvia timezone
                        const day = days.find(d => d.latvianDayIndex === idx);
                        const isCurrentDay = day ? (
                          // Compare year, month and day in Latvia timezone
                          (() => {
                            const latviaToday = toLatviaTime(new Date());
                            const dayInLatvia = toLatviaTime(day.date);
                            return dayInLatvia.getFullYear() === latviaToday.getFullYear() &&
                                  dayInLatvia.getMonth() === latviaToday.getMonth() &&
                                  dayInLatvia.getDate() === latviaToday.getDate();
                          })()
                        ) : false;
                        
                        // If slot is undefined, render an empty placeholder
                        if (!slot) {
                          // For admin mode, make unallocated slots clickable for selection
                          if (isAdmin) {
                            // Create a dummy slot for unallocated time periods to allow selection
                            // Use the actual day's date from our days array to ensure proper date is used
                            const dayData = days[idx];
                            if (!dayData) {
                              console.error(`Could not find day data for index ${idx}`);
                              return null;
                            }
                            
                            // Start with the correct date for this column from the days array
                            const dummyDate = new Date(dayData.date);
                            
                            // Set hours and minutes based on the time string
                            const [dummyHour, dummyMinute] = timeString.split(':').map(Number);
                            dummyDate.setHours(dummyHour, dummyMinute, 0, 0);
                            
                            // End time is 30 minutes later
                            const dummyEndDate = new Date(dummyDate);
                            dummyEndDate.setMinutes(dummyEndDate.getMinutes() + 30);
                            
                            // Check if this slot is in the past (for correct styling)
                            const now = new Date();
                            // First check if it's a past day
                            const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            const slotOnlyDate = new Date(dummyDate.getFullYear(), dummyDate.getMonth(), dummyDate.getDate());
                            const isPastDay = slotOnlyDate < todayDate;
                            // Then check if it's today but in the past
                            const isToday = slotOnlyDate.getTime() === todayDate.getTime();
                            const isPastTime = isToday && dummyDate < now;
                            // Combined condition
                            const isPast = isPastDay || isPastTime;
                            
                            // Create a dummy slot with "unallocated" status and unique ID
                            const dummySlot: SchemaTimeSlot = {
                              id: -1 * (Date.now() + idx + dummyHour + dummyMinute), // Negative ID to ensure uniqueness
                              startTime: dummyDate,
                              endTime: dummyEndDate,
                              price: 25, // Default price
                              status: "unallocated",
                              reservationExpiry: null,
                              isPast: isPast // Important: pass the isPast flag
                            };
                            
                            const isSelected = adminSelectedSlots?.some(s => 
                              s.startTime.getTime() === dummySlot.startTime.getTime() && 
                              s.endTime.getTime() === dummySlot.endTime.getTime()
                            );
                            
                            return (
                              <div 
                                key={`unallocated-${idx}-${timeString}`}
                                className={`h-14 rounded-md border border-gray-200 cursor-pointer flex items-center justify-center ${isCurrentDay ? 'bg-blue-50' : 'bg-gray-50'} ${isSelected ? 'border-2 border-primary' : ''}`}
                                onClick={() => onAdminSlotSelect?.(dummySlot)}
                              >
                                {isSelected && (
                                  <Badge className="w-3 h-3 p-0 bg-primary flex items-center justify-center">✓</Badge>
                                )}
                              </div>
                            );
                          }
                          
                          // For regular user mode, render non-clickable placeholder
                          return (
                            <div 
                              key={`empty-${idx}-${timeString}`} 
                              className={`h-14 rounded-md border border-gray-200 ${isCurrentDay ? 'bg-blue-50' : 'bg-gray-50'}`}
                            ></div>
                          );
                        }
                        
                        const isSelected = isSlotSelected(slot.id);
                        return isAdmin ? (
                          <AdminTimeSlot
                            key={slot.id}
                            slot={toSchemaTimeSlot(slot)}
                            isSelected={isSelected}
                            onClick={() => handleSlotToggle(slot.id, slot.status)}
                          />
                        ) : (
                          <Button
                            key={slot.id}
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-14 py-0 px-1 justify-center items-center text-center text-xs",
                              getSlotClass(slot.status, isSelected, slot.isPast || false)
                            )}
                            disabled={slot.status !== "available" && !isAdmin}
                            onClick={() => handleSlotToggle(slot.id, slot.status)}
                          >
                            <div className="text-center w-full">
                              <Badge variant="outline" className="px-1 h-4 text-[10px]">
                                €{slot.price}
                              </Badge>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={`time-block-${timeString}`} className="flex mb-1 items-start">
                  {/* Time column */}
                  <div className="w-10 flex-shrink-0 pt-2 pr-1 text-right">
                    <span className="text-xs font-medium text-gray-500">{timeString}</span>
                  </div>
                  
                  {/* Slots for this time - dynamic grid */}
                  <div className={`flex-1 grid ${isAdmin ? 'grid-cols-8' : 'grid-cols-7'} gap-1`}>
                    {Array.from({ length: isAdmin ? 8 : 7 }).map((_, idx) => {
                      const slot = slots[idx];
                      
                      // Find the corresponding day to check if it's today using Latvia timezone
                      const day = days.find(d => d.latvianDayIndex === idx);
                      const isCurrentDay = day ? (
                        // Compare year, month and day in Latvia timezone
                        (() => {
                          const latviaToday = toLatviaTime(new Date());
                          const dayInLatvia = toLatviaTime(day.date);
                          return dayInLatvia.getFullYear() === latviaToday.getFullYear() &&
                                dayInLatvia.getMonth() === latviaToday.getMonth() &&
                                dayInLatvia.getDate() === latviaToday.getDate();
                        })()
                      ) : false;
                      
                      // If slot is undefined, render an empty placeholder
                      if (!slot) {
                        // For admin mode, make unallocated slots clickable for selection
                        if (isAdmin) {
                          // Create a dummy slot for unallocated time periods to allow selection
                          // Use the actual day's date from our days array to ensure proper date is used
                          const dayData = days[idx];
                          if (!dayData) {
                            console.error(`Could not find day data for index ${idx}`);
                            return null;
                          }
                          
                          // Start with the correct date for this column from the days array
                          const dummyDate = new Date(dayData.date);
                          
                          // Set hours and minutes based on the time string
                          const [dummyHour, dummyMinute] = timeString.split(':').map(Number);
                          dummyDate.setHours(dummyHour, dummyMinute, 0, 0);
                          
                          // End time is 30 minutes later
                          const dummyEndDate = new Date(dummyDate);
                          dummyEndDate.setMinutes(dummyEndDate.getMinutes() + 30);
                          
                          // Check if this slot is in the past (for correct styling)
                          const now = new Date();
                          // First check if it's a past day
                          const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          const slotOnlyDate = new Date(dummyDate.getFullYear(), dummyDate.getMonth(), dummyDate.getDate());
                          const isPastDay = slotOnlyDate < todayDate;
                          // Then check if it's today but in the past
                          const isToday = slotOnlyDate.getTime() === todayDate.getTime();
                          const isPastTime = isToday && dummyDate < now;
                          // Combined condition
                          const isPast = isPastDay || isPastTime;
                          
                          // Create a dummy slot with "unallocated" status and unique ID
                          const dummySlot: SchemaTimeSlot = {
                            id: -1 * (Date.now() + idx + dummyHour + dummyMinute), // Negative ID to ensure uniqueness
                            startTime: dummyDate,
                            endTime: dummyEndDate,
                            price: 25, // Default price
                            status: "unallocated",
                            reservationExpiry: null,
                            isPast: isPast // Important: pass the isPast flag
                          };
                          
                          const isSelected = adminSelectedSlots?.some(s => 
                            s.startTime.getTime() === dummySlot.startTime.getTime() && 
                            s.endTime.getTime() === dummySlot.endTime.getTime()
                          );
                          
                          return (
                            <div 
                              key={`unallocated-${idx}-${timeString}`}
                              className={`h-14 rounded-md border border-gray-200 cursor-pointer flex items-center justify-center ${isCurrentDay ? 'bg-blue-50' : 'bg-gray-50'} ${isSelected ? 'border-2 border-primary' : ''}`}
                              onClick={() => onAdminSlotSelect?.(dummySlot)}
                            >
                              {isSelected && (
                                <Badge className="w-3 h-3 p-0 bg-primary flex items-center justify-center">✓</Badge>
                              )}
                            </div>
                          );
                        }
                        
                        // For regular user mode, render non-clickable placeholder
                        return (
                          <div 
                            key={`empty-${idx}-${timeString}`} 
                            className={`h-14 rounded-md border border-gray-200 ${isCurrentDay ? 'bg-blue-50' : 'bg-gray-50'}`}
                          ></div>
                        );
                      }
                      
                      const isSelected = isSlotSelected(slot.id);
                      
                      return isAdmin ? (
                        <AdminTimeSlot
                          key={slot.id}
                          slot={toSchemaTimeSlot(slot)}
                          isSelected={isSelected}
                          onClick={() => handleSlotToggle(slot.id, slot.status)}
                        />
                      ) : (
                        <Button
                          key={slot.id}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-14 py-0 px-1 justify-center items-center text-center text-xs",
                            getSlotClass(slot.status, isSelected, slot.isPast || false),
                            isCurrentDay && !isSelected && slot.status === "available" ? "border-blue-300" : ""
                          )}
                          disabled={slot.status !== "available" && !isAdmin}
                          onClick={() => handleSlotToggle(slot.id, slot.status)}
                        >
                          <div className="text-center w-full">
                            <Badge variant="outline" className="px-1 h-4 text-[10px]">
                              €{slot.price}
                            </Badge>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            }
          })}
        </div>
        
      </CardContent>
      
      {/* Selection summary - Moved to bottom of calendar */}
      {selectedTimeSlots.length > 0 && (
        <div className="px-4 py-3 border-t">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-sm">Selected Slots: {selectedTimeSlots.length}</h4>
              <p className="text-xs text-muted-foreground">
                {getSelectedTimeRange()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Total: €{calculateTotalPrice()}</p>
              <Link href="/booking">
                <Button size="sm" className="mt-2">Proceed to Booking</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default BookingCalendar;