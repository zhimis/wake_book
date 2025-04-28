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
import { cn, getLatvianDayIndex, getStandardDayIndex, getLatvianDayName, getLatvianDayIndexFromDate } from "@/lib/utils";
import { useWeather } from "@/hooks/use-weather";
import { useBooking } from "@/context/booking-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TimeSlot as SchemaTimeSlot } from "@shared/schema";
import CalendarDay from "@/components/calendar-day";

type TimeSlotStatus = "available" | "booked" | "reserved" | "selected";

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
const BookingCalendar = ({ isAdmin = false }: BookingCalendarProps) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Use the booking context
  const { selectedTimeSlots, toggleTimeSlot, setReservationExpiry, clearSelectedTimeSlots } = useBooking();
  const { forecast: weatherForecast, isLoading: weatherLoading } = useWeather();
  const { toast } = useToast();
  
  // Date range for the current week view
  const startDate = currentDate;
  const endDate = addDays(currentDate, 6);
  
  // Navigation functions
  const goToPreviousWeek = () => {
    // Clear selections when changing weeks
    clearSelectedTimeSlots();
    setCurrentDate(subDays(currentDate, 7));
  };
  
  const goToNextWeek = () => {
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
  
  // Function to check if a UI slot is selected 
  const isSlotSelected = (uiSlotId: string): boolean => {
    // Parse the string ID to a number and compare directly
    const id = parseInt(uiSlotId);
    
    // Check if any selected slots match this ID
    return selectedTimeSlots.some(slot => slot.id === id);
  };
  
  // Create 7 day week starting today (Latvia format with Monday as first day)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentDate, i);
    // Get the Latvia day index where 0 = Monday
    const latvianDayIndex = getLatvianDayIndexFromDate(date);
    return {
      date,
      name: format(date, "EEE"),
      day: format(date, "d"),
      latvianDayIndex // Include Latvia day index for proper sorting
    };
  }).sort((a, b) => {
    // Sort by Latvian day index (Monday first)
    return a.latvianDayIndex - b.latvianDayIndex;
  });
  
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
      // Create dates but keep them in local timezone (without timezone offset)
      // The dates come from the server with timezone info already accounted for
      const startTime = new Date(dbSlot.startTime);
      const endTime = new Date(dbSlot.endTime);
      
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
        // Get time components - adjust for the 3-hour timezone difference
        // This ensures the UI displays the correct local time
        const hour = startTime.getHours() - 3; // Adjust for 3-hour offset
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
    if (status !== "available" && !isAdmin) return;
    
    // Find the actual slot object
    const slot = timeSlots.find(s => s.id === slotId);
    if (!slot) return;
    
    // Convert our UI slot to a schema slot before passing to context
    const schemaSlot = toSchemaTimeSlot(slot);
    
    // Update booking context
    toggleTimeSlot(schemaSlot);
  };
  
  // Reserve time slots on the server and navigate to booking form
  const reserveAndProceed = async () => {
    try {
      if (selectedTimeSlots.length === 0) {
        toast({
          title: "No Time Slots Selected",
          description: "Please select at least one time slot before proceeding.",
          variant: "destructive"
        });
        return;
      }
      
      // Make API call to reserve the selected time slots
      const response = await fetch('/api/timeslots/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeSlotIds: selectedTimeSlots.map(slot => slot.id),
          expiryMinutes: 15
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to reserve time slots');
      }
      
      // Set a temporary 15-minute reservation expiry
      const expiryTime = new Date(Date.now() + 15 * 60 * 1000);
      setReservationExpiry(expiryTime);
      
      toast({
        title: "Time Slots Reserved",
        description: "Your selected time slots have been reserved for 15 minutes.",
        variant: "default"
      });
      
    } catch (error) {
      toast({
        title: "Reservation Failed",
        description: "There was an error reserving your time slots. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Get CSS class for time slot based on status
  const getSlotClass = (status: TimeSlotStatus, isSelected: boolean) => {
    if (isSelected) {
      return "bg-primary text-primary-foreground hover:bg-primary/90";
    }
    
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case "booked":
        return "bg-red-100 text-red-800 cursor-not-allowed opacity-70";
      case "reserved":
        return "bg-yellow-100 text-yellow-800 cursor-not-allowed opacity-70";
      default:
        return "bg-gray-100 text-gray-800";
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
        <CardHeader className="pb-2 pt-4">
          <div className="flex justify-center items-center py-12">
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
      <CardHeader className="pb-2 pt-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {format(currentDate, "MMMM d")} - {format(addDays(currentDate, 6), "MMMM d, yyyy")}
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
              // Find weather for this day if available
              const dayStr = format(day.date, "yyyy-MM-dd");
              const dayWeather = weatherForecast?.find((w: any) => w.date === dayStr);
              
              // Determine weather icon
              const getWeatherIcon = () => {
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
              
              return (
                <div key={index} className="text-center py-2">
                  <div className="font-medium text-sm">{day.name}</div>
                  <div className="text-xs text-muted-foreground">{day.day}</div>
                  <div className="mt-1">{getWeatherIcon()}</div>
                  {dayWeather && (
                    <div className="text-xs font-medium mt-1">{dayWeather.temperature}°C</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Calendar grid with time slots */}
        <div className="mt-2">
          {allTimeStrings.map(timeString => {
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
                        
                        // If slot is undefined, render an empty placeholder
                        if (!slot) {
                          return (
                            <div 
                              key={`empty-${idx}-${timeString}`} 
                              className="h-14 bg-gray-50 rounded-md border border-gray-200"
                            ></div>
                          );
                        }
                        
                        const isSelected = isSlotSelected(slot.id);
                        return (
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
                      
                      // If slot is undefined, render an empty placeholder
                      if (!slot) {
                        return (
                          <div 
                            key={`empty-${idx}-${timeString}`} 
                            className="h-14 bg-gray-50 rounded-md border border-gray-200"
                          ></div>
                        );
                      }
                      
                      const isSelected = isSlotSelected(slot.id);
                      return (
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
              );
            }
          })}
        </div>
        
        {/* Selection summary */}
        {selectedTimeSlots.length > 0 && (
          <div className="mt-4 pt-4 border-t px-4 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-sm">Selected Slots: {selectedTimeSlots.length}</h4>
                <p className="text-xs text-muted-foreground">
                  {format(currentDate, "EEE, MMM d")} {getSelectedTimeRange()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Total: €{calculateTotalPrice()}</p>
                <Link href="/booking" onClick={reserveAndProceed}>
                  <Button size="sm" className="mt-2">Proceed to Booking</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCalendar;