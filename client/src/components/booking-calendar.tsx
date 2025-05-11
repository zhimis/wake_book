import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  LATVIA_TIMEZONE,
} from "@/lib/utils";
import { useBooking } from "@/context/booking-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { TimeSlot as SchemaTimeSlot, generateTimeSlotId } from "@shared/schema";
import CalendarDay from "@/components/calendar-day";
import AdminTimeSlot from "@/components/admin/admin-time-slot";
import SwipeHandler from "@/components/swipe-handler";

// Define TimeSlotStatus type to be used consistently across components
export type TimeSlotStatus =
  | "available"
  | "booked"
  | "pending"
  | "selected"
  | "unavailable"
  | "past";

// Define TimeSlot interface used in this component
export interface TimeSlot {
  id: string;
  status: TimeSlotStatus;
  start: Date;
  end: Date;
  price: number | null;
  // Additional metadata
  pending?: boolean;
  day?: number; // Day of week (0-6, starting Monday)
}

interface Day {
  date: Date;
  name: string;
  slots: TimeSlot[];
  isAvailable: boolean;
  isToday: boolean;
  isPast: boolean;
}

export interface BookingCalendarProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  isAdmin?: boolean;
  onAdminSlotSelect?: (slot: TimeSlot) => void;
  adminSelectedSlots?: string[];
  customNavigation?: {
    goToPrevious: () => void;
    goToNext: () => void;
    goToToday: () => void;
  };
  initialDate?: Date;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  onDateRangeChange,
  isAdmin = false,
  onAdminSlotSelect,
  adminSelectedSlots = [],
  customNavigation,
  initialDate, // New prop to allow parent to control the initial date
}) => {
  // Initialize currentDate with initialDate prop if provided, or Monday of the current week
  // This ensures the calendar shows the correct week alignment consistently
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Start with today's date in Latvia timezone or use initialDate if provided
    const todayInLatvia = initialDate
      ? toLatviaTime(initialDate)
      : toLatviaTime(new Date());
    
    // Get Latvia day of week (0=Monday, 6=Sunday)
    const latvianDayIndex = getLatvianDayIndexFromDate(todayInLatvia);
    
    // Calculate Monday of this week by subtracting the day index
    // This matches the exact same calculation used in the goToToday function
    const thisMonday = subDays(todayInLatvia, latvianDayIndex);
    
    console.log(
      `Initializing calendar with Monday of current week: ${thisMonday.toISOString()} (Latvia time)`,
    );
    console.log(`Latvia day index: ${latvianDayIndex}, Original date: ${todayInLatvia.toISOString()}`);
    
    return thisMonday; // Always start with Monday to ensure consistent display
  });

  // Use the booking context
  const { selectedTimeSlots, toggleTimeSlot, clearSelectedTimeSlots } =
    useBooking();
  // No longer fetching weather data per client request
  const { toast } = useToast();

  // Date range for the current week view
  // Always include yesterday in the date range to ensure consistent data fetching
  // This helps with the initial load vs "Today" button behavior
  const startDate = subDays(currentDate, 1);
  const endDate = addDays(currentDate, 6);

  // Effect to update current date when initialDate prop changes
  useEffect(() => {
    if (initialDate) {
      const newDate = toLatviaTime(initialDate);
      // Only update if initialDate is different from currentDate
      // to prevent unnecessary re-renders
      if (
        format(newDate, "yyyy-MM-dd") !== format(currentDate, "yyyy-MM-dd")
      ) {
        // Calculate the Monday of the week containing the initialDate
        const latvianDayIndex = getLatvianDayIndexFromDate(newDate);
        const thisMonday = subDays(newDate, latvianDayIndex);
        setCurrentDate(thisMonday);
      }
    }
  }, [initialDate, currentDate]);

  // Navigation functions
  const goToPreviousWeek = useCallback(() => {
    setCurrentDate((prevDate) => {
      const newDate = subDays(prevDate, 7);
      return newDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentDate((prevDate) => {
      const newDate = addDays(prevDate, 7);
      return newDate;
    });
  }, []);

  const goToToday = useCallback(() => {
    const today = toLatviaTime(new Date());
    const latvianDayIndex = getLatvianDayIndexFromDate(today);
    // Calculate Monday of this week
    const thisMonday = subDays(today, latvianDayIndex);
    setCurrentDate(thisMonday);
  }, []);

  // Effect to notify parent component of date range changes
  useEffect(() => {
    if (onDateRangeChange) {
      onDateRangeChange(startDate, endDate);
    }
  }, [startDate, endDate, onDateRangeChange]);

  // Fetch time slots for the current week
  const {
    data: timeSlotData,
    isLoading: isLoadingTimeSlots,
    error: timeSlotsError,
  } = useQuery({
    queryKey: ["/api/timeslots", { startDate, endDate }],
    queryFn: getQueryFn(),
  });

  // Fetch operating hours for availability data
  const { data: configData } = useQuery({
    queryKey: ["/api/config"],
    queryFn: getQueryFn(),
  });

  // Fetch lead time settings
  const { data: leadTimeSettings } = useQuery({
    queryKey: ["/api/admin/lead-time-settings"],
    queryFn: getQueryFn(),
  });

  // Fetch bookings for lead time restriction bypass
  const { data: bookings } = useQuery({
    queryKey: ["/api/bookings"],
    queryFn: getQueryFn(),
  });

  // Log when bookings data is loaded (helps with debugging lead time issues)
  useEffect(() => {
    if (bookings) {
      console.log("Loaded bookings data:", bookings);
      
      // Extract dates of all bookings for easier check
      const bookingDates = bookings.map(b => 
        format(new Date(b.firstSlotTime), "yyyy-MM-dd")
      );
      console.log("Booking dates found:", bookingDates);
    }
  }, [bookings]);

  // Process time slots and group them by day
  const days = useMemo(() => {
    // Safety check - if any required data is missing, return an array of empty days
    if (
      !timeSlotData ||
      !timeSlotData.slots ||
      !configData ||
      !configData.operatingHours
    ) {
      const today = toLatviaTime(new Date());
      return Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(currentDate, i);
        return {
          date,
          name: format(date, "EEEE"),
          slots: [],
          isAvailable: false,
          isToday: format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
          isPast: date < today && format(date, "yyyy-MM-dd") !== format(today, "yyyy-MM-dd")
        };
      });
    }

    const today = toLatviaTime(new Date());
    const todayString = format(today, "yyyy-MM-dd");

    // Create 7 days starting from the monday of the selected week
    const weekDays: Day[] = Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(currentDate, i);
      const dateString = format(date, "yyyy-MM-dd");
      const isDateToday = format(date, "yyyy-MM-dd") === todayString;
      const isPastDay = date < today && !isDateToday;

      return {
        date,
        name: getLatvianDayName(date),
        slots: [],
        isAvailable: true, // Default value, updated based on operating hours later
        isToday: isDateToday,
        isPast: isPastDay,
      };
    });

    // Find the operating hours for each day
    weekDays.forEach((day) => {
      const latvianDayIndex = getLatvianDayIndexFromDate(day.date);
      const operatingHours = configData.operatingHours.find(
        (oh) => oh.dayOfWeek === latvianDayIndex
      );
      day.isAvailable = operatingHours ? !operatingHours.isClosed : false;
    });

    // Group time slots by day
    timeSlotData.slots.forEach((slot) => {
      // Create JavaScript Date objects for start and end times
      const start = new Date(slot.startTime);
      const end = new Date(slot.endTime);

      // Map to Latvia day index (0 = Monday, 6 = Sunday)
      const startInLatvia = toLatviaTime(start);
      const dayIndex = getLatvianDayIndexFromDate(startInLatvia);
      
      // Map the slot to the appropriate day of the week based on Latvia time
      const dayToMapTo = weekDays.find((day) => {
        const dayInLatvia = toLatviaTime(day.date);
        const dayIndexInLatvia = getLatvianDayIndexFromDate(dayInLatvia);
        
        // This slot should be mapped to this day if the day indexes match
        const shouldMapToThisDay = dayIndexInLatvia === dayIndex;
        
        if (shouldMapToThisDay) {
          console.log(
            `SLOT MAPPING: Original date: ${format(startInLatvia, "EEE, MMM d, yyyy HH:mm")}, 
                   Mapped to week day: ${format(dayInLatvia, "EEE, MMM d, yyyy HH:mm")},
                   Latvian day index: ${dayIndex}`
          );
        }
        
        return shouldMapToThisDay;
      });

      if (dayToMapTo) {
        const statusMap: Record<string, TimeSlotStatus> = {
          available: "available",
          booked: "booked",
          pending: "pending",
          unavailable: "unavailable",
        };

        // Apply lead time restriction logic
        let status = statusMap[slot.status] || "unavailable";
        
        // Date calculations for lead time
        const slotDateStr = format(startInLatvia, "yyyy-MM-dd");
        const todayDateStr = format(today, "yyyy-MM-dd");
        const slotDate = new Date(slotDateStr);
        const todayDate = new Date(todayDateStr);
        
        const daysDifference = Math.floor(
          (slotDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Determine if slot should be restricted based on lead time settings
        let isRestricted = false;
        if (leadTimeSettings && leadTimeSettings.restrictionMode === "always") {
          // Always apply lead time restriction
          isRestricted = daysDifference < (leadTimeSettings.leadTimeDays || 0);
        } else if (leadTimeSettings && leadTimeSettings.restrictionMode === "booking_based") {
          // Only apply restriction if there are no bookings that day
          isRestricted = daysDifference < (leadTimeSettings.leadTimeDays || 0);
          
          // Check if this date has any bookings, which would relax the restriction
          if (isRestricted && bookings && slotDateStr) {
            // For debugging specific dates
            if (slotDateStr === "2025-05-08") {
              console.log("⚠️ CHECKING MAY 8TH: Slot date=" + slotDateStr);
              console.log("⚠️ Available bookings data:", bookings.length);
              
              // Log a bit more details about each booking
              bookings.forEach((booking, index) => {
                const timeSlots = booking.timeSlotDates || [];
                console.log(`⚠️ Booking #${index+1}:`, booking.reference, timeSlots.length, "time slots");
              });
            }
            
            // Check if this specific slot date has any bookings
            const hasBookingsForThisDate = bookings.some(booking => {
              const bookingDate = booking.firstSlotTime ? 
                format(new Date(booking.firstSlotTime), "yyyy-MM-dd") : null;
              
              // More logging for specific dates
              if (slotDateStr === "2025-05-08") {
                console.log(`⚠️ MAY 8TH CHECK (firstSlotTime): Booking date=${bookingDate}, Match=${bookingDate === slotDateStr ? "YES" : "no"}`);
              }
              
              return bookingDate === slotDateStr;
            });
            
            if (hasBookingsForThisDate) {
              console.log(`Found booking (via firstSlotTime) for ${slotDateStr}, relaxing lead time restriction`);
              isRestricted = false;
              
              if (slotDateStr === "2025-05-08") {
                console.log(`✅ FOUND MAY 8TH BOOKINGS:`, bookings.filter(b => 
                  format(new Date(b.firstSlotTime), "yyyy-MM-dd") === slotDateStr
                ).length);
              }
            }
          }
        }
        
        console.log(`Lead time check: Slot date=${slotDateStr}, Today=${todayDateStr}, Days difference=${daysDifference}, Lead time required=${leadTimeSettings ? leadTimeSettings.leadTimeDays : 'unknown'}, Restricted=${isRestricted}, Mode=${leadTimeSettings ? leadTimeSettings.restrictionMode : 'unknown'}`);
        
        // Apply the restriction if needed
        if (isRestricted && status === "available") {
          status = "unavailable";
        }

        // Check if the slot is in the past
        const now = toLatviaTime(new Date());
        const startTimeIsPast = startInLatvia < now;
        if (startTimeIsPast && status === "available") {
          status = "past";
        }

        // For admin view, all slots are available
        if (isAdmin && status !== "booked" && status !== "pending") {
          status = "available";
        }

        // Parse price from string to number
        const price = typeof slot.price === "string"
          ? parseFloat(slot.price)
          : slot.price;

        // Create the time slot object
        const timeSlot: TimeSlot = {
          id: slot.id || generateTimeSlotId(start, end),
          status,
          start,
          end,
          price,
          day: dayIndex,
        };

        // For specific dates and times, log additional information for debugging
        const slotTimeStr = format(startInLatvia, "HH:mm");
        const slotDateTimeKey = `${slotDateStr}-${slotTimeStr}`;
        
        // Check for specific conditions to debug
        const isToday = slotDateStr === format(today, "yyyy-MM-dd");
        const isPastTime = startInLatvia < now;
        const isPastDay = slotDate < todayDate;
        const isPast = isPastDay || (isToday && isPastTime);
        
        // Log detailed timing information for specific slots
        if (slotDateStr === format(today, "yyyy-MM-dd") || slotDateStr === "2025-05-08") {
          console.log(`Slot ${slot.id} timing:`, {
            date: slotDateStr,
            time: slotTimeStr,
            status,
            isPastDay,
            isToday,
            isPastTime,
            isPast
          });
        }

        // Add the time slot to the day
        dayToMapTo.slots.push(timeSlot);
      }
    });

    // Sort time slots within each day by start time
    weekDays.forEach((day) => {
      day.slots.sort((a, b) => a.start.getTime() - b.start.getTime());
    });

    return weekDays;
  }, [timeSlotData, configData, currentDate, isAdmin, leadTimeSettings, bookings]);

  // Check if we're viewing a week that has no time slots
  const isFutureWeekWithNoSlots = useMemo(() => {
    if (!days || days.length === 0) return false;

    // Get the total number of time slots for the week
    const totalSlots = days.reduce(
      (total, day) => total + day.slots.length,
      0
    );

    // Check if this is a future week (all days are in the future)
    const today = toLatviaTime(new Date());
    const isAllFutureDays = days.every(
      (day) => day.date > today || format(day.date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
    );

    // It's a future week with no slots if all days are in the future and there are no slots
    return isAllFutureDays && totalSlots === 0;
  }, [days]);

  // Calculate total price of selected slots
  const calculateTotalPrice = () => {
    return selectedTimeSlots.reduce((total, slotId) => {
      // Find the slot in the days array
      for (const day of days) {
        const slot = day.slots.find((s) => s.id === slotId);
        if (slot && slot.price) {
          return total + slot.price;
        }
      }
      return total;
    }, 0);
  };

  // Get a formatted string showing the selected time range
  const getSelectedTimeRange = () => {
    if (selectedTimeSlots.length === 0) return "";

    // Convert slot IDs to actual slot objects
    const selectedSlots: TimeSlot[] = [];
    for (const slotId of selectedTimeSlots) {
      for (const day of days) {
        const slot = day.slots.find((s) => s.id === slotId);
        if (slot) {
          selectedSlots.push(slot);
          break;
        }
      }
    }

    // Sort slots by start time
    selectedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    // If only one slot is selected, show just that time
    if (selectedSlots.length === 1) {
      const slot = selectedSlots[0];
      return `${formatTimeSlot(slot.start, slot.end)}`;
    }

    // For multiple slots, show the range from first to last
    const firstSlot = selectedSlots[0];
    const lastSlot = selectedSlots[selectedSlots.length - 1];
    
    return `${format(firstSlot.start, "EEE, MMM d")} ${format(firstSlot.start, "HH:mm")} - ${format(lastSlot.end, "HH:mm")}`;
  };

  // Handle booking button click
  const proceedToBooking = () => {
    window.location.href = "/booking-form";
  };

  // If loading or error
  if (isLoadingTimeSlots) {
    return (
      <Card className="w-full">
        <CardHeader className="flex justify-center items-center h-40">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              Loading calendar...
            </p>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Safe early return if data isn't fully loaded
  if (!days || days.length < 7 || !days[0] || !days[6]) {
    return (
      <Card className="w-full">
        <CardHeader className="flex justify-center items-center h-40">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              Loading calendar...
            </p>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <SwipeHandler
      onSwipeLeft={customNavigation?.goToNext || goToNextWeek}
      onSwipeRight={customNavigation?.goToPrevious || goToPreviousWeek}
    >
      <Card className="w-full">
        <CardHeader className="pb-1 pt-2 px-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {formatInLatviaTime(days[0].date, "MMMM d")} -{" "}
              {formatInLatviaTime(days[6].date, "MMMM d, yyyy")}
              <span className="text-xs text-muted-foreground ml-1">
                ({LATVIA_TIMEZONE})
              </span>
            </p>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={
                  customNavigation
                    ? customNavigation.goToPrevious
                    : goToPreviousWeek
                }
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
                onClick={
                  customNavigation ? customNavigation.goToNext : goToNextWeek
                }
                title="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Mobile hint */}
          <div className="mt-2 text-xs text-center text-muted-foreground sm:hidden">
            Swipe left or right to change weeks
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {/* If we're viewing a week with no time slots */}
          {isFutureWeekWithNoSlots && !isAdmin ? (
            <div className="flex flex-col justify-center items-center py-8 my-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <CalendarIcon className="h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No time slots available</h3>
              <p className="text-sm text-muted-foreground mb-3 text-center max-w-lg">
                There are no time slots available for this week yet. Please check
                back later or select an earlier date.
              </p>
              <Button
                variant="outline"
                onClick={customNavigation?.goToToday || goToToday}
              >
                Go to current week
              </Button>
            </div>
          ) : (
            <>
              {/* Calendar grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2 mt-2">
                {days.map((day) => (
                  <CalendarDay
                    key={day.date.toISOString()}
                    day={day}
                    slots={day.slots}
                    onSlotClick={(slot) => {
                      if (isAdmin && onAdminSlotSelect) {
                        onAdminSlotSelect(slot);
                      } else if (
                        slot.status === "available" &&
                        !isAdmin
                      ) {
                        toggleTimeSlot(slot.id);
                      }
                    }}
                    selectedSlots={
                      isAdmin ? adminSelectedSlots : selectedTimeSlots
                    }
                    isAdmin={isAdmin}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="h-3 w-3 rounded-full bg-primary mr-1"
                  />
                  <span>Available</span>
                </div>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="h-3 w-3 rounded-full bg-blue-400 mr-1"
                  />
                  <span>Selected</span>
                </div>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="h-3 w-3 rounded-full bg-orange-400 mr-1"
                  />
                  <span>Pending</span>
                </div>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="h-3 w-3 rounded-full bg-red-400 mr-1"
                  />
                  <span>Booked</span>
                </div>
                <div className="flex items-center">
                  <Badge
                    variant="outline"
                    className="h-3 w-3 rounded-full bg-gray-300 mr-1"
                  />
                  <span>Unavailable</span>
                </div>
              </div>

              {/* Lead Time Info */}
              {leadTimeSettings &&
                !isAdmin && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md border">
                    <h3 className="font-medium text-sm mb-1">Booking Policy</h3>
                    <p className="text-xs text-muted-foreground">
                      Online booking is typically available{" "}
                      {leadTimeSettings.restrictionMode === "booking_based"
                        ? "if there are existing bookings or "
                        : ""}
                      for dates more than {leadTimeSettings.leadTimeDays} day
                      {leadTimeSettings.leadTimeDays !== 1 ? "s" : ""} in advance. For booking within{" "}
                      {leadTimeSettings.leadTimeDays} day
                      {leadTimeSettings.leadTimeDays !== 1 ? "s" : ""} of today,
                      please contact us directly by phone or email to verify
                      availability.
                    </p>
                  </div>
                )}

              {/* Selected Time Slots (Regular user view only) */}
              {!isAdmin && selectedTimeSlots.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md border">
                  <h3 className="font-medium text-sm mb-1">
                    Selected Time Slots
                  </h3>
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
    </SwipeHandler>
  );
};

export default BookingCalendar;