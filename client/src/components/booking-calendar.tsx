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
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

type TimeSlotStatus = "available" | "booked" | "reserved" | "selected";

interface TimeSlot {
  id: string;
  startTime: string; // Using string to avoid date conversion issues
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
  
  // Pre-generated time slots with prices and availability
  const timeSlots: Record<string, TimeSlot[]> = {
    "9:00": [
      { id: "mon-9-00", startTime: "9:00", price: 15, status: "available" },
      { id: "tue-9-00", startTime: "9:00", price: 15, status: "booked" },
      { id: "wed-9-00", startTime: "9:00", price: 15, status: "available" },
      { id: "thu-9-00", startTime: "9:00", price: 15, status: "available" },
      { id: "fri-9-00", startTime: "9:00", price: 15, status: "available" },
      { id: "sat-9-00", startTime: "9:00", price: 20, status: "reserved" },
      { id: "sun-9-00", startTime: "9:00", price: 20, status: "available" },
    ],
    "9:30": [
      { id: "mon-9-30", startTime: "9:30", price: 15, status: "available" },
      { id: "tue-9-30", startTime: "9:30", price: 15, status: "available" },
      { id: "wed-9-30", startTime: "9:30", price: 15, status: "available" },
      { id: "thu-9-30", startTime: "9:30", price: 15, status: "booked" },
      { id: "fri-9-30", startTime: "9:30", price: 15, status: "available" },
      { id: "sat-9-30", startTime: "9:30", price: 20, status: "reserved" },
      { id: "sun-9-30", startTime: "9:30", price: 20, status: "available" },
    ],
    "10:00": [
      { id: "mon-10-00", startTime: "10:00", price: 15, status: "booked" },
      { id: "tue-10-00", startTime: "10:00", price: 15, status: "available" },
      { id: "wed-10-00", startTime: "10:00", price: 15, status: "available" },
      { id: "thu-10-00", startTime: "10:00", price: 15, status: "available" },
      { id: "fri-10-00", startTime: "10:00", price: 15, status: "available" },
      { id: "sat-10-00", startTime: "10:00", price: 20, status: "available" },
      { id: "sun-10-00", startTime: "10:00", price: 20, status: "available" },
    ],
    "10:30": [
      { id: "mon-10-30", startTime: "10:30", price: 15, status: "available" },
      { id: "tue-10-30", startTime: "10:30", price: 15, status: "available" },
      { id: "wed-10-30", startTime: "10:30", price: 15, status: "available" },
      { id: "thu-10-30", startTime: "10:30", price: 15, status: "available" },
      { id: "fri-10-30", startTime: "10:30", price: 15, status: "booked" },
      { id: "sat-10-30", startTime: "10:30", price: 20, status: "available" },
      { id: "sun-10-30", startTime: "10:30", price: 20, status: "available" },
    ],
    "11:00": [
      { id: "mon-11-00", startTime: "11:00", price: 18, status: "available" },
      { id: "tue-11-00", startTime: "11:00", price: 18, status: "available" },
      { id: "wed-11-00", startTime: "11:00", price: 18, status: "reserved" },
      { id: "thu-11-00", startTime: "11:00", price: 18, status: "available" },
      { id: "fri-11-00", startTime: "11:00", price: 18, status: "available" },
      { id: "sat-11-00", startTime: "11:00", price: 23, status: "available" },
      { id: "sun-11-00", startTime: "11:00", price: 23, status: "booked" },
    ],
    "11:30": [
      { id: "mon-11-30", startTime: "11:30", price: 18, status: "available" },
      { id: "tue-11-30", startTime: "11:30", price: 18, status: "available" },
      { id: "wed-11-30", startTime: "11:30", price: 18, status: "reserved" },
      { id: "thu-11-30", startTime: "11:30", price: 18, status: "available" },
      { id: "fri-11-30", startTime: "11:30", price: 18, status: "available" },
      { id: "sat-11-30", startTime: "11:30", price: 23, status: "available" },
      { id: "sun-11-30", startTime: "11:30", price: 23, status: "booked" },
    ],
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
    return Object.values(timeSlots)
      .flatMap(slots => slots)
      .filter(slot => selectedSlots.includes(slot.id))
      .reduce((total, slot) => total + slot.price, 0);
  };
  
  // Get a sample selected slot for display
  const getSelectedTimeRange = () => {
    if (selectedSlots.length === 0) return null;
    
    const allSlots = Object.values(timeSlots).flatMap(slots => slots);
    const selected = allSlots.filter(slot => selectedSlots.includes(slot.id));
    
    const firstSlot = selected[0];
    const lastSlot = selected[selected.length - 1];
    
    return `${firstSlot.startTime} - ${parseInt(lastSlot.startTime.split(':')[0]) + 1}:${lastSlot.startTime.split(':')[1]}`;
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
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-4 text-center">
          {days.map((day, index) => (
            <div key={index} className="text-sm font-medium">
              <div className="mb-1">{day.name}</div>
              <div className="text-xs text-muted-foreground">{day.day}</div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1 overflow-y-auto max-h-[400px]">
          {Object.entries(timeSlots).map(([time, slots]) => (
            <>
              {slots.map((slot, index) => {
                const isSelected = selectedSlots.includes(slot.id);
                return (
                  <Button
                    key={slot.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-auto py-1 px-2 justify-between flex-col items-start text-left text-xs",
                      getSlotClass(slot.status, isSelected)
                    )}
                    disabled={slot.status !== "available" && !isAdmin}
                    onClick={() => toggleSlot(slot.id, slot.status)}
                  >
                    <div className="flex items-center w-full justify-between">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {slot.startTime}
                      </span>
                      <Badge variant="outline" className="ml-1 px-1 h-4">
                        <Euro className="h-2 w-2 mr-0.5" />
                        {slot.price}
                      </Badge>
                    </div>
                  </Button>
                );
              })}
            </>
          ))}
        </div>
        
        {selectedSlots.length > 0 && (
          <div className="mt-4 pt-4 border-t">
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