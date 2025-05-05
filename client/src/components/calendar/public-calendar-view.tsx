import React, { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import BaseCalendarGrid from "./base-calendar-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { TimeSlot } from "@shared/schema";

interface PublicCalendarViewProps {
  onSlotsSelected?: (slots: TimeSlot[]) => void;
  enableMultiSelect?: boolean;
  showBookButton?: boolean;
}

const PublicCalendarView: React.FC<PublicCalendarViewProps> = ({
  onSlotsSelected,
  enableMultiSelect = true,
  showBookButton = true
}) => {
  const { toast } = useToast();
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);

  // Handle date range change from base calendar
  const handleDateChange = useCallback((startDate: Date, endDate: Date) => {
    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
  }, []);

  // Handle slot click
  const handleSlotClick = useCallback((
    slot: TimeSlot | null, 
    day: number,
    hour: number,
    minute: number,
    dayDate: Date
  ) => {
    if (!slot) {
      toast({
        title: "Time slot not available",
        description: "This time slot is not currently available for booking.",
        variant: "destructive",
      });
      return;
    }

    if (slot.status !== 'available') {
      toast({
        title: "Time slot not available",
        description: "This time slot is already booked or blocked.",
        variant: "destructive",
      });
      return;
    }

    // Handle selection/deselection
    setSelectedSlots(prevSelected => {
      const isAlreadySelected = prevSelected.some(s => s.id === slot.id);
      
      if (isAlreadySelected) {
        // Deselect this slot
        return prevSelected.filter(s => s.id !== slot.id);
      } else {
        // Select this slot
        if (enableMultiSelect) {
          // Allow multiple selections
          return [...prevSelected, slot];
        } else {
          // Single select mode
          return [slot];
        }
      }
    });
  }, [toast, enableMultiSelect]);

  // Render a time slot cell
  const renderTimeSlotCell = useCallback((
    slot: TimeSlot | null, 
    day: number, 
    time: string,
    dayDate: Date,
    hour: number,
    minute: number
  ) => {
    // Check if this slot is selected
    const isSelected = slot ? selectedSlots.some(s => s.id === slot.id) : false;
    
    // Determine the status-based styling
    let statusClass = "bg-gray-100"; // Default for no slot
    let statusText = "Closed";
    
    if (slot) {
      switch (slot.status) {
        case 'available':
          statusClass = isSelected 
            ? "bg-blue-600 text-white hover:bg-blue-700" 
            : "bg-green-100 hover:bg-green-200";
          statusText = `€${parseFloat(String(slot.price)).toFixed(2)}`;
          break;
        case 'booked':
          statusClass = "bg-red-100 hover:bg-red-100 cursor-not-allowed";
          statusText = "Booked";
          break;
        case 'blocked':
          statusClass = "bg-gray-200 hover:bg-gray-200 cursor-not-allowed";
          statusText = "Blocked";
          break;
        default:
          statusClass = "bg-yellow-100 hover:bg-yellow-200";
          statusText = slot.status;
      }
    }
    
    return (
      <div 
        className={`
          h-10 flex items-center justify-center 
          ${statusClass} 
          ${slot?.status === 'available' ? 'cursor-pointer' : 'cursor-default'}
          transition-colors duration-200
          border border-gray-200
        `}
        onClick={() => handleSlotClick(slot, day, hour, minute, dayDate)}
      >
        <div className="text-xs font-medium">
          {statusText}
        </div>
      </div>
    );
  }, [selectedSlots, handleSlotClick]);

  // Callback for "Book Selected" button
  const handleBookSelected = useCallback(() => {
    if (selectedSlots.length === 0) {
      toast({
        title: "No slots selected",
        description: "Please select at least one time slot to book.",
        variant: "destructive",
      });
      return;
    }

    if (onSlotsSelected) {
      onSlotsSelected(selectedSlots);
    }
  }, [selectedSlots, onSlotsSelected, toast]);

  return (
    <div>
      <BaseCalendarGrid 
        viewMode="public"
        renderSlotCell={renderTimeSlotCell}
        onDateChange={handleDateChange}
      />
      
      {showBookButton && (
        <div className="mt-4 space-y-4">
          {selectedSlots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Time Slots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedSlots.map(slot => (
                    <div key={slot.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <div>
                        <span className="font-medium">{format(new Date(slot.startTime), 'EEEE, MMM d')}</span>
                        <span className="mx-2">at</span>
                        <span>{format(new Date(slot.startTime), 'HH:mm')} - {format(new Date(slot.endTime), 'HH:mm')}</span>
                      </div>
                      <div className="font-medium">€{parseFloat(String(slot.price)).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex justify-between items-center w-full">
                  <div>
                    <span className="text-sm text-gray-500">Total:</span>
                    <span className="ml-2 font-bold">
                      €{selectedSlots.reduce((sum, slot) => sum + parseFloat(String(slot.price)), 0).toFixed(2)}
                    </span>
                  </div>
                  <Button onClick={handleBookSelected}>
                    Book Selected Slots
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default PublicCalendarView;