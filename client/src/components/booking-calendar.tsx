import { useState } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Euro,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TimeSlotStatus = "available" | "booked" | "reserved" | "selected";

interface TimeSlot {
  id: string;
  day: number; // 0-6 for day of week
  hour: number; // hour in 24-hour format
  minute: number; // 0 or 30
  price: number;
  status: TimeSlotStatus;
}

interface BookingCalendarProps {
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  isAdmin?: boolean;
}

// Simplified booking calendar with mock data
const BookingCalendar = ({ isAdmin = false }: BookingCalendarProps) => {
  const [currentDate] = useState<Date>(new Date());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  
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
  const timeSlots: TimeSlot[] = [];
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
        
        timeSlots.push({
          id: `day-${day}-${hour}-${minute}`,
          day,
          hour,
          minute,
          price,
          status
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
  const toggleSlot = (slotId: string, status: TimeSlotStatus) => {
    if (status !== "available" && !isAdmin) return;
    
    setSelectedSlots(prev => {
      if (prev.includes(slotId)) {
        return prev.filter(id => id !== slotId);
      } else {
        return [...prev, slotId];
      }
    });
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
    return timeSlots
      .filter(slot => selectedSlots.includes(slot.id))
      .reduce((total, slot) => total + slot.price, 0);
  };
  
  // Get selected time range for display
  const getSelectedTimeRange = () => {
    if (selectedSlots.length === 0) return null;
    
    const selected = timeSlots.filter(slot => selectedSlots.includes(slot.id))
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    
    if (selected.length === 0) return null;
    
    const firstSlot = selected[0];
    const lastSlot = selected[selected.length - 1];
    
    // Calculate end time of last slot (30 min after start)
    let endHour = lastSlot.hour;
    let endMinute = lastSlot.minute + 30;
    
    if (endMinute >= 60) {
      endHour += 1;
      endMinute -= 60;
    }
    
    return `${formatTime(firstSlot.hour, firstSlot.minute)} - ${formatTime(endHour, endMinute)}`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <CalendarIcon className="mr-2 h-5 w-5" />
            Select Date & Time
          </CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(currentDate, "MMMM d")} - {format(addDays(currentDate, 6), "MMMM d, yyyy")}
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-visible">
        {/* Time and day headers */}
        <div className="flex pl-1">
          {/* Time column header */}
          <div className="w-10 flex-shrink-0"></div>
          
          {/* Day columns headers */}
          <div className="flex-1 grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="text-center">
                <div className="font-medium text-sm">{day.name}</div>
                <div className="text-xs text-muted-foreground">{day.day}</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Calendar grid with time slots */}
        <div className="mt-2">
          {allTimeStrings.map(timeString => {
            const [hourStr, minuteStr] = timeString.split(':');
            const hour = parseInt(hourStr);
            const minute = parseInt(minuteStr);
            const slots = getTimeSlotsForTime(hour, minute);
            
            return (
              <>
                {/* Hourly separator */}
                {minute === 0 && (
                  <div className="flex w-full mb-2 mt-3 first:mt-0">
                    <div className="w-10 flex-shrink-0"></div>
                    <div className="flex-1 border-t border-gray-200"></div>
                  </div>
                )}
                
                <div key={timeString} className="flex mb-2 items-start">
                  {/* Time column */}
                  <div className="w-10 flex-shrink-0 pt-2 pr-1 text-right">
                    <span className="text-xs font-medium text-gray-500">{timeString}</span>
                  </div>
                  
                  {/* Slots for this time */}
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {slots.map(slot => {
                      const isSelected = selectedSlots.includes(slot.id);
                      return (
                        <Button
                          key={slot.id}
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 py-0 px-1 justify-center items-center text-center text-xs",
                            getSlotClass(slot.status, isSelected)
                          )}
                          disabled={slot.status !== "available" && !isAdmin}
                          onClick={() => toggleSlot(slot.id, slot.status)}
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
              </>
            );
          })}
        </div>
        
        {/* Selection summary */}
        {selectedSlots.length > 0 && (
          <div className="mt-4 pt-4 border-t px-4 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium text-sm">Selected Slots: {selectedSlots.length}</h4>
                <p className="text-xs text-muted-foreground">
                  {format(currentDate, "EEE, MMM d")} {getSelectedTimeRange()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Total: €{calculateTotalPrice()}</p>
                <Button size="sm" className="mt-2">Proceed to Booking</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingCalendar;