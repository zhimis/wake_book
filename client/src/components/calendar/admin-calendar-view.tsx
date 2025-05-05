import React, { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import BaseCalendarGrid from "./base-calendar-grid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { TimeSlot, Booking } from "@shared/schema";
import { MoreHorizontal, Calendar, Lock, Unlock, UserPlus, X, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AdminCreateBooking from "@/components/admin/admin-create-booking";

interface AdminCalendarViewProps {
  onSlotSelect?: (slot: TimeSlot) => void;
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
}

interface SlotActionState {
  slotId: number | null;
  action: 'block' | 'make-available' | 'book' | null;
  dayDate: Date | null;
  time: string | null;
}

const AdminCalendarView: React.FC<AdminCalendarViewProps> = ({
  onSlotSelect,
  onDateRangeChange
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<SlotActionState>({
    slotId: null,
    action: null,
    dayDate: null,
    time: null
  });
  
  // Mutation for blocking time slots
  const blockSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const response = await apiRequest("POST", "/api/timeslots/block", { id: slotId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Time slot blocked",
        description: "The time slot has been successfully blocked.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error blocking time slot",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for making time slots available
  const makeAvailableMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const response = await apiRequest("POST", "/api/timeslots/make-available", { id: slotId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Time slot available",
        description: "The time slot is now available for booking.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating time slot",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Generate a time slot if one doesn't exist
  const generateSlotMutation = useMutation({
    mutationFn: async ({ date, hour, minute }: { date: Date, hour: number, minute: number }) => {
      // Format the date for the API
      const startTime = new Date(date);
      startTime.setHours(hour, minute, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);
      
      const response = await apiRequest("POST", "/api/timeslots/regenerate", { 
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Time slot created",
        description: "A new time slot has been created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating time slot",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle date range change from base calendar
  const handleDateChange = useCallback((startDate: Date, endDate: Date) => {
    if (onDateRangeChange) {
      onDateRangeChange(startDate, endDate);
    }
  }, [onDateRangeChange]);

  // Handle slot click for admin actions
  const handleSlotClick = useCallback((
    slot: TimeSlot | null, 
    day: number,
    hour: number,
    minute: number,
    dayDate: Date
  ) => {
    // Prepare time string for display
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    if (slot) {
      // If slot exists, store it in state for potential actions
      setSelectedAction({
        slotId: slot.id,
        action: null,
        dayDate,
        time: timeStr
      });
    } else {
      // If no slot exists, offer to create one
      const actionDate = new Date(dayDate);
      actionDate.setHours(hour, minute, 0, 0);
      
      toast({
        title: "No time slot exists",
        description: "Do you want to create a time slot here?",
        action: (
          <Button
            size="sm"
            onClick={() => generateSlotMutation.mutate({ date: actionDate, hour, minute })}
          >
            Create
          </Button>
        ),
      });
    }
  }, [toast, generateSlotMutation]);

  // Handle the selected action
  useEffect(() => {
    if (!selectedAction.slotId || !selectedAction.action) return;

    switch (selectedAction.action) {
      case 'block':
        blockSlotMutation.mutate(selectedAction.slotId);
        break;
      case 'make-available':
        makeAvailableMutation.mutate(selectedAction.slotId);
        break;
      default:
        break;
    }

    // Reset the action state
    setSelectedAction({
      slotId: null,
      action: null,
      dayDate: null,
      time: null
    });
  }, [selectedAction, blockSlotMutation, makeAvailableMutation]);

  // Render a time slot cell
  const renderTimeSlotCell = useCallback((
    slot: TimeSlot | null, 
    day: number, 
    time: string,
    dayDate: Date,
    hour: number,
    minute: number
  ) => {
    // Determine the status-based styling
    let statusClass = "bg-gray-100 border-dashed border-2 border-gray-300"; // No slot
    let statusText = "";
    let showDropdown = false;
    
    if (slot) {
      showDropdown = true;
      
      switch (slot.status) {
        case 'available':
          statusClass = "bg-green-100 hover:bg-green-200 border border-green-300";
          statusText = `€${parseFloat(String(slot.price)).toFixed(2)}`;
          break;
        case 'booked':
          statusClass = "bg-red-100 hover:bg-red-200 border border-red-300";
          statusText = "Booked";
          break;
        case 'blocked':
          statusClass = "bg-gray-200 hover:bg-gray-300 border border-gray-400";
          statusText = "Blocked";
          break;
        default:
          statusClass = "bg-yellow-100 hover:bg-yellow-200 border border-yellow-300";
          statusText = slot.status;
      }
    }
    
    // Check if there's a booking for this slot
    const slotDate = format(dayDate, 'yyyy-MM-dd');
    const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    
    return (
      <div 
        className={`
          h-12 
          ${statusClass}
          transition-colors duration-200
          cursor-pointer
          flex flex-col items-center justify-center relative
        `}
        onClick={() => handleSlotClick(slot, day, hour, minute, dayDate)}
      >
        {slot ? (
          <>
            <div className="text-xs font-medium">{statusText}</div>
            {slot.status === 'booked' && (
              <div className="text-xs text-gray-600">
                {/* We could display booking info here in a future iteration */}
              </div>
            )}
            
            {/* Action menu */}
            {showDropdown && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6 absolute top-0 right-0 bg-white/80 hover:bg-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem 
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlotSelect && onSlotSelect(slot);
                    }}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {slot.status !== 'blocked' && (
                    <DropdownMenuItem 
                      className="cursor-pointer text-orange-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAction({
                          ...selectedAction,
                          slotId: slot.id,
                          action: 'block'
                        });
                      }}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Block Slot
                    </DropdownMenuItem>
                  )}
                  
                  {slot.status !== 'available' && slot.status !== 'booked' && (
                    <DropdownMenuItem 
                      className="cursor-pointer text-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAction({
                          ...selectedAction,
                          slotId: slot.id,
                          action: 'make-available'
                        });
                      }}
                    >
                      <Unlock className="mr-2 h-4 w-4" />
                      Make Available
                    </DropdownMenuItem>
                  )}
                  
                  {slot.status === 'available' && (
                    <AdminCreateBooking 
                      triggerButton={
                        <DropdownMenuItem 
                          className="cursor-pointer text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                          onSelect={(e) => e.preventDefault()}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create Booking
                        </DropdownMenuItem>
                      }
                      initialSelectedSlots={[slot]}
                    />
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        ) : (
          <div className="text-xs text-gray-400">Create</div>
        )}
      </div>
    );
  }, [handleSlotClick, selectedAction, onSlotSelect]);

  return (
    <div>
      <BaseCalendarGrid 
        viewMode="admin"
        renderSlotCell={renderTimeSlotCell}
        onDateChange={handleDateChange}
        onSlotClick={handleSlotClick}
      />
      
      {/* Additional admin controls could go here */}
      <div className="mt-4 flex justify-end space-x-3">
        <AdminCreateBooking />
      </div>
    </div>
  );
};

export default AdminCalendarView;