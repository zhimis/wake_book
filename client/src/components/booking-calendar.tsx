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
  Cloud,
  CloudRain,
  Sun,
  Loader2,
} from "lucide-react";
import { 
  cn, 
  getLatvianDayIndex, 
  getStandardDayIndex, 
  getLatvianDayName, 
  getLatvianDayIndexFromDate,
  toLatviaTime,
  formatInLatviaTime
} from "@/lib/utils";
import { useWeather } from "@/hooks/use-weather";
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
  
  return {
    id: id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    price: slot.price,
    status: slot.status,
    reservationExpiry: slot.reservationExpiry
  };
}

// Simplified booking calendar with mock data
const BookingCalendar = ({ isAdmin = false, onAdminSlotSelect, adminSelectedSlots = [] }: BookingCalendarProps) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Use the booking context
  const { selectedTimeSlots, toggleTimeSlot, setReservationExpiry, clearSelectedTimeSlots } = useBooking();
  // Only fetch weather data if not in admin view
  const { forecast: weatherForecast, isLoading: weatherLoading } = !isAdmin ? useWeather() : { forecast: null, isLoading: false };
  const { toast } = useToast();
  
  // Date range for the current week view
  const startDate = currentDate;
  const endDate = addDays(currentDate, 6);
  
  // Navigation functions
  const goToPreviousWeek = () => {
    // For public calendar, prevent going to past weeks
    if (!isAdmin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const prevWeekDate = subDays(currentDate, 7);
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
      const threeWeeksFromToday = addDays(new Date(), 21); // Typical visibility window
      const nextWeekDate = addDays(currentDate, 7);
      
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
    setCurrentDate(new Date());
  };
  
  // Fetch time slots from the server with their actual statuses
  const { data: dbTimeSlots, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['/api/timeslots', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await fetch(
        `/api/timeslots?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`
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
    const threeWeeksFromNow = addDays(new Date(), 21);
    return currentDate > threeWeeksFromNow;
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
  const days = useMemo(() => {
    // Get the Latvian day index for the current date (0=Monday, 1=Tuesday, etc)
    const latvianDayIndexForToday = getLatvianDayIndexFromDate(currentDate);
    
    // Calculate the date for Monday (start of Latvian week)
    // If today is Monday (index 0), then monday is today
    // If today is Tuesday (index 1), then monday is yesterday, etc.
    const mondayDate = addDays(currentDate, -latvianDayIndexForToday);
    
    // Now create an array of 7 days starting from Monday
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(mondayDate, i);
      // Latvian day index is simply i (0=Monday, 1=Tuesday, etc)
      return {
        date,
        name: format(date, "EEE"),
        day: format(date, "d"),
        latvianDayIndex: i
      };
    });
  }, [currentDate]);
  
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
      
      // Calculate days difference with current date for UI display
      const slotYear = startTime.getFullYear();
      const slotMonth = startTime.getMonth();
      const slotDay = startTime.getDate();
      
      const curYear = currentDate.getFullYear();
      const curMonth = currentDate.getMonth();
      const curDay = currentDate.getDate();
      
      // Create date objects with time set to midnight for accurate day comparison
      const slotDateMidnight = new Date(slotYear, slotMonth, slotDay);
      const curDateMidnight = new Date(curYear, curMonth, curDay);
      
      // Calculate difference in days
      const daysDiff = Math.floor((slotDateMidnight.getTime() - curDateMidnight.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`Slot at ${startTime.toLocaleString()}, JS day: ${jsDayOfWeek}, Latvian day index: ${latvianDayIndex}, day diff: ${daysDiff}`);
      
      // Only show slots that are within the current week view (0-6 days from current date)
      if (daysDiff >= 0 && daysDiff < 7) {
        // Get time components from the converted Latvia time
        // No need for manual offset since toLatviaTime already converted it
        const hour = startTime.getHours();
        const minute = startTime.getMinutes();
        
        // Use database price if available
        const price = dbSlot.price || 15;
        
        // Use database status
        const status = dbSlot.status as TimeSlotStatus;
        const reservationExpiry = dbSlot.reservationExpiry ? new Date(dbSlot.reservationExpiry) : null;
        
        slots.push({
          id: dbSlot.id.toString(),
          day: daysDiff, // For backward compatibility
          latvianDayIndex, // The key field that should be used for display positioning
          hour,
          minute,
          price,
          status,
          startTime,
          endTime,
          reservationExpiry
        });
      }
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
    
    // Create an array of 7 slots (one for each day) - all initially undefined
    const slotsForWeek = Array(7).fill(undefined);
    
    // Place slots in the correct day position based on latvianDayIndex (0-6, Monday to Sunday)
    matchingSlots.forEach(slot => {
      // Make sure latvianDayIndex is a valid number
      if (typeof slot.latvianDayIndex === 'number' && slot.latvianDayIndex >= 0 && slot.latvianDayIndex < 7) {
        slotsForWeek[slot.latvianDayIndex] = slot;
      } else {
        console.error(`Invalid latvianDayIndex: ${slot.latvianDayIndex} for slot:`, slot);
      }
    });
    
    return slotsForWeek;
  };
  
  // Get all time strings in format "HH:MM"
  const allTimeStrings = Array.from(new Set(timeSlots.map(slot => 
    `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
  ))).sort();
  
  // Format time from hour and minute
  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };
  
  // Toggle slot selection
  const handleSlotToggle = (slotId: string, status: TimeSlotStatus) => {
    // Find the actual slot object
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;
    
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
    
    // Navigate to booking page right away
    toast({
      title: "Time Slots Selected",
      description: "Proceeding to booking form.",
      variant: "default"
    });
  };
  
  // Get CSS class for time slot based on status
  const getSlotClass = (status: TimeSlotStatus, isSelected: boolean) => {
    // If admin mode and selected, force use of our special CSS class
    if (isAdmin && isSelected) {
      // Return the global admin-selected-slot class to override everything else with more subtle styling
      return "admin-selected-slot border-2 border-red-400 bg-red-100 text-red-900 font-semibold transform scale-105 z-50 shadow-md";
    }
    
    // For regular user view
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
    
    // Admin slot status styling (not selected)
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
    
    const firstSlot = selected[0];
    const lastSlot = selected[selected.length - 1];
    
    if (!firstSlot.startTime || !lastSlot.endTime) return null;
    
    // Format using the date-fns format
    const startTimeStr = format(firstSlot.startTime, 'HH:mm');
    const endTimeStr = format(lastSlot.endTime, 'HH:mm');
    
    return `${startTimeStr} - ${endTimeStr}`;
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
            {format(days[0].date, "MMMM d")} - {format(days[6].date, "MMMM d, yyyy")}
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
          
          {/* Day columns headers */}
          <div className="flex-1 grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              // Find weather for this day if available (only for non-admin view)
              const dayStr = format(day.date, "yyyy-MM-dd");
              const dayWeather = !isAdmin ? weatherForecast?.find((w: any) => w.date === dayStr) : null;
              
              // Determine weather icon (only for non-admin view)
              const getWeatherIcon = () => {
                // Don't show weather icons in admin mode
                if (isAdmin) return null;
                
                if (!dayWeather) return <Cloud className="h-5 w-5 text-gray-400" />;
                const condition = dayWeather.condition.toLowerCase();
                
                if (condition.includes('rain') || condition.includes('shower')) {
                  return <CloudRain className="h-5 w-5 text-blue-500" />;
                } else if (condition.includes('cloud')) {
                  return <Cloud className="h-5 w-5 text-gray-400" />;
                } else {
                  return <Sun className="h-5 w-5 text-yellow-500" />;
                }
              };
              
              // Check if this day is today
              const isCurrentDay = isToday(day.date);
              
              return (
                <div key={index} className={`text-center py-2 ${isCurrentDay ? 'bg-blue-50 rounded-md' : ''}`}>
                  <div className={`font-medium text-sm ${isCurrentDay ? 'text-blue-700' : ''}`}>{day.name}</div>
                  <div className={`text-xs ${isCurrentDay ? 'text-blue-600' : 'text-muted-foreground'}`}>{day.day}</div>
                  {!isAdmin && (
                    <>
                      <div className="mt-1">{getWeatherIcon()}</div>
                      {dayWeather && (
                        <div className={`text-xs font-medium mt-1 ${isCurrentDay ? 'text-blue-600' : ''}`}>{dayWeather.temperature}°C</div>
                      )}
                    </>
                  )}
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
                    
                    {/* Slots for this time */}
                    <div className="flex-1 grid grid-cols-7 gap-1">
                      {Array.from({ length: 7 }).map((_, idx) => {
                        const slot = slots[idx];
                        
                        // Find the corresponding day to check if it's today
                        const day = days.find(d => d.latvianDayIndex === idx);
                        const isCurrentDay = day ? isToday(day.date) : false;
                        
                        // If slot is undefined, render an empty placeholder
                        if (!slot) {
                          // For admin mode, make unallocated slots clickable for selection
                          if (isAdmin) {
                            // Create a dummy slot for unallocated time periods to allow selection
                            const dummyDate = new Date(currentDate);
                            dummyDate.setDate(dummyDate.getDate() + (idx - getLatvianDayIndexFromDate(currentDate)));
                            
                            // Set hours and minutes based on the time string
                            const [dummyHour, dummyMinute] = timeString.split(':').map(Number);
                            dummyDate.setHours(dummyHour, dummyMinute, 0, 0);
                            
                            // End time is 30 minutes later
                            const dummyEndDate = new Date(dummyDate);
                            dummyEndDate.setMinutes(dummyEndDate.getMinutes() + 30);
                            
                            // Create a dummy slot with "unallocated" status and unique ID
                            const dummySlot: SchemaTimeSlot = {
                              id: -1 * (Date.now() + idx + dummyHour + dummyMinute), // Negative ID to ensure uniqueness
                              startTime: dummyDate,
                              endTime: dummyEndDate,
                              price: 25, // Default price
                              status: "unallocated",
                              reservationExpiry: null
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
                              getSlotClass(slot.status, isSelected)
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
                  
                  {/* Slots for this time */}
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((_, idx) => {
                      const slot = slots[idx];
                      
                      // Find the corresponding day to check if it's today
                      const day = days.find(d => d.latvianDayIndex === idx);
                      const isCurrentDay = day ? isToday(day.date) : false;
                      
                      // If slot is undefined, render an empty placeholder
                      if (!slot) {
                        // For admin mode, make unallocated slots clickable for selection
                        if (isAdmin) {
                          // Create a dummy slot for unallocated time periods to allow selection
                          const dummyDate = new Date(currentDate);
                          dummyDate.setDate(dummyDate.getDate() + (idx - getLatvianDayIndexFromDate(currentDate)));
                          
                          // Set hours and minutes based on the time string
                          const [dummyHour, dummyMinute] = timeString.split(':').map(Number);
                          dummyDate.setHours(dummyHour, dummyMinute, 0, 0);
                          
                          // End time is 30 minutes later
                          const dummyEndDate = new Date(dummyDate);
                          dummyEndDate.setMinutes(dummyEndDate.getMinutes() + 30);
                          
                          // Create a dummy slot with "unallocated" status and unique ID
                          const dummySlot: SchemaTimeSlot = {
                            id: -1 * (Date.now() + idx + dummyHour + dummyMinute), // Negative ID to ensure uniqueness
                            startTime: dummyDate,
                            endTime: dummyEndDate,
                            price: 25, // Default price
                            status: "unallocated",
                            reservationExpiry: null
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
                            getSlotClass(slot.status, isSelected),
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
                {format(currentDate, "EEE, MMM d")} {getSelectedTimeRange()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Total: €{calculateTotalPrice()}</p>
              <Link href="/booking" onClick={proceedToBooking}>
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