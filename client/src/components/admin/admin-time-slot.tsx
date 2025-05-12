import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TimeSlot } from "@shared/schema";
import { CSSProperties } from 'react';
import { Eye, Edit, Lock, Clock } from 'lucide-react';
import { TimeSlotStatus } from "@/components/booking-calendar";

interface AdminTimeSlotProps {
  slot: TimeSlot;
  isSelected: boolean;
  onToggle: (slotId: string, status: TimeSlotStatus) => void;
  getSlotClass?: (status: TimeSlotStatus, isSelected: boolean, isPast?: boolean) => string;
}

const AdminTimeSlot: React.FC<AdminTimeSlotProps> = ({ 
  slot, 
  isSelected, 
  onToggle,
  getSlotClass: externalGetSlotClass
}) => {
  // Check if the time slot is in the past
  // We need more rigorous date comparison to properly detect past slots
  const now = new Date();
  
  // IMPORTANT: If the slot already has an isPast property set by the parent component, use that
  // This ensures we use the same isPast logic across both public and admin components
  if (slot.isPast !== undefined) {
    console.log(`Slot ${slot.id} using pre-calculated isPast value: ${slot.isPast}`);
  } else {
    // Otherwise, calculate it ourselves
    console.log(`Slot ${slot.id} calculating isPast value because it wasn't provided`);
  }
  
  // Get the slot's date (either from original or mapped date)
  const slotDate = slot.originalStartTime || slot.startTime;
  
  // For date comparison, we need to handle both full past days and past hours of today
  // First, get just the date portions for comparison
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const slotOnlyDate = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
  
  // If the slot date is from a previous day, it's definitely past
  const isPastDay = slotOnlyDate < todayDate;
  
  // If the slot is from today, check if its time has already passed
  const isToday = slotOnlyDate.getTime() === todayDate.getTime();
  const isPastTime = isToday && slotDate < now;
  
  // Combine both conditions, but prefer the pre-calculated value if available
  const isPast = slot.isPast !== undefined ? slot.isPast : (isPastDay || isPastTime);
  
  // Debug for troubleshooting past slots
  console.log(`Slot ${slot.id} isPast check:`, {
    slotDate: slotDate.toISOString(),
    now: now.toISOString(),
    isPastDay,
    isToday,
    isPastTime,
    isPast
  });
  
  // Check if this slot is part of a multi-slot booking
  // This is used to apply visual cues for slots that are part of the same booking
  const isPartOfMultiSlotBooking = () => {
    // First check if the slot itself has this flag (set by the base-calendar-grid)
    if (slot.isPartOfMultiSlotBooking) {
      console.log(`Slot ${slot.id} is flagged as part of multi-slot booking`);
      return true;
    }
    
    // If the slot doesn't have the flag, use the classic approach
    if (slot.status !== 'booked') return false;
    
    // Check if the slot has a booking reference
    if (slot.bookingReference) {
      console.log(`Slot ${slot.id} has booking reference: ${slot.bookingReference}`);
      return true;
    }
    
    // As a fallback, check the duration
    const startTime = new Date(slot.startTime);
    const endTime = new Date(slot.endTime);
    
    // Calculate duration in minutes
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    
    // If duration is greater than a standard 30-minute slot, this is a multi-slot booking
    return durationMinutes > 30;
  };
  
  // Get CSS class for time slot based on status and whether it's in the past
  const getSlotClass = (status: TimeSlotStatus) => {
    // Debug what the status is and show booking information
    console.log(`AdminTimeSlot ${slot.id} status: ${status}, isPast: ${isPast}, bookingRef: ${slot.bookingReference || 'none'}`);
    
    // CRITICAL DEBUG: Add special logging for June 1st booking
    if (slot.bookingReference === 'WB-L_7LG1SG') {
      console.log(`🔥 FOUND JUNE 1ST BOOKING SLOT ${slot.id}`, slot);
    }
    
    // Past slots get a different styling
    if (isPast) {
      switch (status) {
        case "available":
          return "bg-gray-300 text-gray-700 border-gray-400"; // Darker gray for past available
        case "booked":
          return "bg-amber-700 bg-opacity-20 text-amber-900 border-amber-700"; // Darker amber for past booked
        case "unallocated":
        default:
          return "bg-gray-400 text-gray-800 border-gray-500"; // Darker gray for past unallocated
      }
    }
    
    // Regular styling for future slots
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 hover:bg-green-200 hover:scale-105 transition-transform";
      case "booked":
        return "bg-amber-100 text-amber-800 hover:bg-amber-200";
      case "unallocated":
        // Special handling for unallocated slots - light gray with hover effect
        return "bg-gray-100 text-gray-800 hover:bg-gray-200 hover:scale-105 transition-transform";
      default:
        return "bg-gray-100 text-gray-800 hover:scale-105 transition-transform";
    }
  };

  // Base style for the div - always applied
  const baseStyle: CSSProperties = {
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  };

  // Check if this is part of a multi-slot booking
  const isMultiSlot = isPartOfMultiSlotBooking();

  return (
    <div 
      className={cn(
        "relative cursor-pointer border-r border-b border-gray-200",
        externalGetSlotClass ? externalGetSlotClass(slot.status as TimeSlotStatus, isSelected, isPast) : getSlotClass(slot.status as TimeSlotStatus),
      )} 
      style={baseStyle}
      onClick={() => onToggle(slot.id.toString(), slot.status as TimeSlotStatus)}
    >
      <div className="text-center w-full flex flex-col items-center justify-center">
        {slot.status === 'booked' ? (
          // Booked slots styling
          <>
            {/* For multi-slot bookings, add visual indicators to show they are connected */}
            {isMultiSlot && (
              <>
                <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500 z-10"></div>
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-amber-500 z-10"></div>
                {/* Add a subtle amber background to highlight that this is part of a booking */}
                <div className="absolute inset-0 bg-amber-100 opacity-50 -z-10"></div>
              </>
            )}
            
            <Badge variant="outline" className={cn(
              "px-1 h-4 text-[10px]",
              isPast && "bg-amber-50 border-amber-700"
            )}>
              €{slot.price}
            </Badge>
            
            {isPast && (
              <div className="absolute top-0 left-0 -mt-1 -ml-1">
                <Badge className="w-4 h-4 flex items-center justify-center p-0 bg-amber-700 text-white">
                  <Clock className="h-2 w-2" />
                </Badge>
              </div>
            )}
          </>
        ) : slot.status === 'unallocated' ? (
          // Unallocated slots styling
          <>
            <Badge variant="outline" className={cn(
              "px-1 h-4 text-[10px]",
              isPast ? "bg-gray-200" : "bg-gray-50"
            )}>
              {(typeof slot.id === 'number' && slot.id < 0) || 
               (typeof slot.id === 'string' && slot.id.toString().startsWith('-')) 
                ? 'Empty' 
                : `€${slot.price}`}
            </Badge>
            {isSelected && (
              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                <Badge className="w-3 h-3 flex items-center justify-center p-0 bg-primary">✓</Badge>
              </div>
            )}
            {isPast && (
              <div className="absolute top-0 left-0 -mt-1 -ml-1">
                <Badge className="w-4 h-4 flex items-center justify-center p-0 bg-gray-500 text-white">
                  <Clock className="h-2 w-2" />
                </Badge>
              </div>
            )}
          </>
        ) : (
          // Available slots styling
          <>
            <Badge variant="outline" className={cn(
              "px-1 h-4 text-[10px]",
              isPast && "bg-gray-200 border-gray-400"
            )}>
              €{slot.price}
            </Badge>
            {isSelected && (
              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                <Badge className="w-3 h-3 flex items-center justify-center p-0 bg-primary">✓</Badge>
              </div>
            )}
            {isPast && (
              <div className="absolute top-0 left-0 -mt-1 -ml-1">
                <Badge className="w-4 h-4 flex items-center justify-center p-0 bg-gray-500 text-white">
                  <Clock className="h-2 w-2" />
                </Badge>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminTimeSlot;