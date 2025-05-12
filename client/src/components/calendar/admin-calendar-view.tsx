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
  onSlotsSelected?: (slots: TimeSlot[]) => void;
  enableMultiSelect?: boolean;
}

interface SlotActionState {
  slotId: number | null;
  action: 'block' | 'make-available' | 'book' | null;
  dayDate: Date | null;
  time: string | null;
}

const AdminCalendarView: React.FC<AdminCalendarViewProps> = ({
  onSlotSelect,
  onDateRangeChange,
  onSlotsSelected,
  enableMultiSelect = false
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<SlotActionState>({
    slotId: null,
    action: null,
    dayDate: null,
    time: null
  });
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  
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
      if (enableMultiSelect) {
        // For multi-select mode, toggle the slot selection
        const isAlreadySelected = selectedSlots.some(s => s.id === slot.id);
        
        if (isAlreadySelected) {
          // Remove from selection
          const updatedSelection = selectedSlots.filter(s => s.id !== slot.id);
          setSelectedSlots(updatedSelection);
        } else {
          // Add to selection
          const updatedSelection = [...selectedSlots, slot];
          setSelectedSlots(updatedSelection);
        }
        
        // Notify parent component about selection change
        if (onSlotsSelected) {
          const updatedSelection = isAlreadySelected 
            ? selectedSlots.filter(s => s.id !== slot.id)
            : [...selectedSlots, slot];
          onSlotsSelected(updatedSelection);
        }
      } else {
        // Single select mode - store the slot for potential actions
        setSelectedAction({
          slotId: slot.id,
          action: null,
          dayDate,
          time: timeStr
        });
      }
    } else {
      // Handle empty slots
      const actionDate = new Date(dayDate);
      actionDate.setHours(hour, minute, 0, 0);
      
      if (enableMultiSelect) {
        // In multi-select mode, create a temporary time slot for this empty cell
        const tempEndTime = new Date(actionDate);
        tempEndTime.setMinutes(tempEndTime.getMinutes() + 30); // 30 min slot
        
        // Create a temporary time slot 
        const tempSlot: TimeSlot = {
          id: -Math.floor(Math.random() * 1000000), // Temporary negative ID
          startTime: actionDate, // Store as Date object
          endTime: tempEndTime, // Store as Date object
          status: 'empty' as 'available', // Type assertion to make TypeScript happy
          price: 0,
          storageTimezone: 'UTC'
        };
        
        // Add to selection
        const updatedSelection = [...selectedSlots, tempSlot];
        setSelectedSlots(updatedSelection);
        
        if (onSlotsSelected) {
          onSlotsSelected(updatedSelection);
        }
      } else {
        // If not in multi-select mode, offer to create a new slot
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
    }
  }, [toast, generateSlotMutation, enableMultiSelect, selectedSlots, onSlotsSelected]);

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

  // Helper function to check if a slot is selected
  const isSlotSelected = useCallback((slotId: number): boolean => {
    return selectedSlots.some(slot => slot.id === slotId);
  }, [selectedSlots]);

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
    let statusClass = "bg-gray-50 border-dashed border-2 border-gray-300 hover:bg-gray-100 hover:border-blue-400 hover:scale-105 transition-all duration-150"; // No slot - more interactive now
    let statusText = "";
    let showDropdown = false;
    
    if (slot) {
      showDropdown = true;
      
      // Check if the slot is selected in multi-select mode
      const isSelected = enableMultiSelect && isSlotSelected(slot.id);
      
      switch (slot.status) {
        case 'available':
          statusClass = isSelected 
            ? "bg-green-300 hover:bg-green-400 border-2 border-green-600" 
            : "bg-green-100 hover:bg-green-200 border border-green-300";
          statusText = `€${parseFloat(String(slot.price)).toFixed(2)}`;
          break;
        case 'booked':
          statusClass = isSelected 
            ? "bg-red-300 hover:bg-red-400 border-2 border-red-600" 
            : "bg-red-100 hover:bg-red-200 border border-red-300";
          statusText = "Booked";
          break;
        case 'blocked':
          statusClass = isSelected 
            ? "bg-gray-400 hover:bg-gray-500 border-2 border-gray-600" 
            : "bg-gray-200 hover:bg-gray-300 border border-gray-400";
          statusText = "Blocked";
          break;
        case 'empty':
          statusClass = isSelected 
            ? "bg-blue-300 hover:bg-blue-400 border-2 border-blue-600" 
            : "bg-blue-50 hover:bg-blue-100 border-dashed border-2 border-blue-300";
          statusText = "Empty";
          break;
        default:
          statusClass = isSelected 
            ? "bg-yellow-300 hover:bg-yellow-400 border-2 border-yellow-600" 
            : "bg-yellow-100 hover:bg-yellow-200 border border-yellow-300";
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
          <>
            <div className="text-xs text-gray-400 hover:text-gray-600 transition-colors duration-200">Create Slot</div>
            {enableMultiSelect && (
              <div className="absolute bottom-1 right-1 text-[0.6rem] text-gray-400">Click to select</div>
            )}
          </>
        )}
      </div>
    );
  }, [handleSlotClick, selectedAction, onSlotSelect, enableMultiSelect, isSlotSelected]);

  // Bulk action handlers
  const handleBulkBlock = useCallback(() => {
    if (selectedSlots.length === 0) return;
    
    // Count how many real slots (positive ids) and empty slots (negative ids) we have
    const realSlots = selectedSlots.filter(slot => slot.id > 0);
    const emptySlots = selectedSlots.filter(slot => slot.id < 0);
    
    let actionDescription = `Are you sure you want to block ${realSlots.length} slot(s)?`;
    if (emptySlots.length > 0) {
      actionDescription += ` ${emptySlots.length} empty slot(s) will be created and blocked.`;
    }
    
    toast({
      title: "Block multiple slots?",
      description: actionDescription,
      action: (
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={() => {
            // Process each real slot sequentially
            realSlots.forEach(slot => {
              if (slot.status !== 'blocked') {
                blockSlotMutation.mutate(slot.id);
              }
            });
            
            // Create and block each empty slot
            emptySlots.forEach(slot => {
              const startDate = new Date(slot.startTime);
              generateSlotMutation.mutate({
                date: startDate,
                hour: startDate.getHours(),
                minute: startDate.getMinutes()
              });
            });
            
            // Clear selection after processing
            setSelectedSlots([]);
            if (onSlotsSelected) onSlotsSelected([]);
          }}
        >
          Confirm
        </Button>
      ),
    });
  }, [selectedSlots, blockSlotMutation, generateSlotMutation, toast, onSlotsSelected]);

  const handleBulkMakeAvailable = useCallback(() => {
    if (selectedSlots.length === 0) return;
    
    // Count how many real slots (positive ids) and empty slots (negative ids) we have
    const realSlots = selectedSlots.filter(slot => slot.id > 0);
    const emptySlots = selectedSlots.filter(slot => slot.id < 0);
    
    let actionDescription = `Are you sure you want to make ${realSlots.length} slot(s) available?`;
    if (emptySlots.length > 0) {
      actionDescription += ` ${emptySlots.length} empty slot(s) will be created and made available.`;
    }
    
    toast({
      title: "Make slots available?",
      description: actionDescription,
      action: (
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => {
            // Process each real slot sequentially
            realSlots.forEach(slot => {
              if (slot.status !== 'available' && slot.status !== 'booked') {
                makeAvailableMutation.mutate(slot.id);
              }
            });
            
            // Create and make available each empty slot
            emptySlots.forEach(slot => {
              const startDate = new Date(slot.startTime);
              generateSlotMutation.mutate({
                date: startDate,
                hour: startDate.getHours(),
                minute: startDate.getMinutes()
              });
            });
            
            // Clear selection after processing
            setSelectedSlots([]);
            if (onSlotsSelected) onSlotsSelected([]);
          }}
        >
          Confirm
        </Button>
      ),
    });
  }, [selectedSlots, makeAvailableMutation, generateSlotMutation, toast, onSlotsSelected]);

  return (
    <div className="w-full">
      {/* Info message for empty slots when in multi-select mode */}
      {enableMultiSelect && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <p className="text-blue-800 font-medium mb-1">Multi-select mode active</p>
          <p className="text-blue-600 text-xs">
            You can select both existing slots and empty grid cells. Empty cells will be created when you apply an action.
          </p>
        </div>
      )}
      
      <BaseCalendarGrid 
        viewMode="admin"
        renderSlotCell={renderTimeSlotCell}
        onDateChange={handleDateChange}
        onSlotClick={handleSlotClick}
      />
      
      {/* Bulk action controls */}
      {enableMultiSelect && selectedSlots.length > 0 && (
        <div className="mt-4 p-4 bg-slate-50 rounded-md border">
          <h3 className="text-sm font-medium mb-3">Bulk Actions for {selectedSlots.length} Selected Slot{selectedSlots.length !== 1 ? 's' : ''}</h3>
          
          {/* Selection summary */}
          <div className="mb-3 text-xs">
            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded mr-2">
              {selectedSlots.filter(s => s.id > 0).length} existing slots
            </span>
            {selectedSlots.some(s => s.id < 0) && (
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded">
                {selectedSlots.filter(s => s.id < 0).length} empty cells
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedSlots([]);
                if (onSlotsSelected) onSlotsSelected([]);
              }}
            >
              Clear Selection
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleBulkMakeAvailable}
            >
              <Unlock className="mr-2 h-4 w-4" />
              Make Available
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleBulkBlock}
            >
              <Lock className="mr-2 h-4 w-4" />
              Block Slots
            </Button>
            
            {selectedSlots.some(slot => slot.status === 'available') && (
              <AdminCreateBooking 
                buttonVariant="outline"
                buttonSize="sm"
                initialSelectedSlots={selectedSlots.filter(slot => slot.status === 'available')}
                onBookingComplete={() => {
                  setSelectedSlots([]);
                  if (onSlotsSelected) onSlotsSelected([]);
                }}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Regular admin controls */}
      <div className="mt-4 flex justify-end space-x-3">
        <AdminCreateBooking />
      </div>
    </div>
  );
};

export default AdminCalendarView;