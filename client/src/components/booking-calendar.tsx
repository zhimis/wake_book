import React, { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Euro,
  Cloud,
  CloudRain,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWeather } from "@/hooks/use-weather";
import { useBooking } from "@/context/booking-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TimeSlot as SchemaTimeSlot } from "@shared/schema";

type TimeSlotStatus = "available" | "booked" | "reserved" | "selected";

// Local TimeSlot interface with UI-specific properties
interface CalendarTimeSlot {
  id: string;
  day: number; // 0-6 for day of week
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
function toSchemaTimeSlot(slot: CalendarTimeSlot, slotIdMap: Map<string, number>): SchemaTimeSlot {
  // Get consistent ID from our ID mapping
  if (!slotIdMap.has(slot.id)) {
    // Create a consistent number ID for this string ID
    const mockId = parseInt(slot.id.replace(/[^0-9]/g, '')) % 10000;
    slotIdMap.set(slot.id, mockId);
  }
  
  return {
    id: slotIdMap.get(slot.id) as number,
    startTime: slot.startTime,
    endTime: slot.endTime,
    price: slot.price,
    status: slot.status,
    reservationExpiry: slot.reservationExpiry
  };
}

// Simplified booking calendar with mock data
const BookingCalendar = ({ isAdmin = false }: BookingCalendarProps) => {
  const [currentDate] = useState<Date>(new Date());
  
  // Use the booking context
  const { selectedTimeSlots, toggleTimeSlot, setReservationExpiry } = useBooking();
  const { forecast: weatherForecast, isLoading: weatherLoading } = useWeather();
  const { toast } = useToast();
  
  // Create and populate the mapping between string IDs and schema numeric IDs
  const [slotIdMap] = useState(() => new Map<string, number>());
  
  // Function to check if a UI slot is selected (using ID mapping)
  const isSlotSelected = (uiSlotId: string): boolean => {
    // For each timeSlot, create a matching schema ID and store in map
    if (!slotIdMap.has(uiSlotId)) {
      // Create a consistent number ID for this string ID
      const mockId = parseInt(uiSlotId.replace(/[^0-9]/g, '')) % 10000;
      slotIdMap.set(uiSlotId, mockId);
    }
    
    // Check if any selected slots match this ID
    return selectedTimeSlots.some(slot => slot.id === slotIdMap.get(uiSlotId));
  };
  
  // Create 7 day week starting today
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentDate, i);
    return {
      date,
      name: format(date, "EEE"),
      day: format(date, "d")
    };
  });
  
  // Create time slots from 8:00 to 22:00 in 30 minute increments
  const timeSlots: CalendarTimeSlot[] = [];
  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6]; // 0 = Monday, 6 = Sunday in our view
  
  // Generate all time slots
  daysOfWeek.forEach(day => {
    // From 8:00 to 22:00
    for (let hour = 8; hour < 22; hour++) {
      for (let minute of [0, 30]) {
        // Base price: 15€ for mornings, 18€ for afternoons, 20€ for evenings
        let price = 15;
        if (hour >= 12 && hour < 17) price = 18;
        if (hour >= 17) price = 20;
        
        // Weekend price increase
        if (day >= 5) price += 5;
        
        // Random status with weighted probabilities
        const rand = Math.random();
        let status: TimeSlotStatus = "available";
        
        if (rand < 0.1) status = "booked";
        else if (rand < 0.2) status = "reserved";
        
        // Create slot date and times
        const slotDate = addDays(currentDate, day);
        const startTime = new Date(slotDate);
        startTime.setHours(hour, minute, 0, 0);
        
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30);
        
        timeSlots.push({
          id: `day-${day}-${hour}-${minute}`,
          day,
          hour,
          minute,
          price,
          status,
          startTime,
          endTime,
          reservationExpiry: null
        });
      }
    }
  });
  
  // Get time slots for a specific time (e.g. "8:00")
  const getTimeSlotsForTime = (hour: number, minute: number) => {
    return timeSlots.filter(slot => slot.hour === hour && slot.minute === minute);
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
    const schemaSlot = toSchemaTimeSlot(slot, slotIdMap);
    
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {format(currentDate, "MMMM d")} - {format(addDays(currentDate, 6), "MMMM d, yyyy")}
          </p>
          <div className="flex space-x-2">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8">
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
                      {slots.map(slot => {
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
                    {slots.map(slot => {
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