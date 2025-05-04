import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TimeSlot } from "@shared/schema";
import { CSSProperties } from 'react';
import { Eye, Edit, Lock, Clock } from 'lucide-react';

interface AdminTimeSlotProps {
  slot: TimeSlot;
  isSelected: boolean;
  onClick: (slot: TimeSlot) => void;
}

const AdminTimeSlot: React.FC<AdminTimeSlotProps> = ({ 
  slot, 
  isSelected, 
  onClick 
}) => {
  // Check if the time slot is in the past
  // We need more rigorous date comparison to properly detect past slots
  const now = new Date();
  
  // For proper past slot detection, compare the date portion only
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Get the slot's date (either from original or mapped date)
  const slotDate = slot.originalStartTime || slot.startTime;
  const slotDateOnly = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
  
  // A slot is in the past if its date is before today
  const isPast = slotDateOnly < nowDate;
  
  // Debug for troubleshooting past slots
  console.log(`Slot ${slot.id} isPast check:`, {
    slotDate: slotDate.toISOString(),
    slotDateOnly: slotDateOnly.toISOString(),
    nowDate: nowDate.toISOString(),
    isPast
  });
  
  // Get CSS class for time slot based on status and whether it's in the past
  const getSlotClass = (status: string) => {
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

  // Get selected state style (using different approach to work around styling issues)
  const getSelectedStyle = (): CSSProperties => {
    if (isSelected && slot.status !== 'booked') {
      return {
        position: 'relative' as const,
        background: '#fee2e2', // lighter red background
        boxShadow: '0 0 5px rgba(248, 113, 113, 0.5)', // more subtle shadow
        zIndex: 10,
        borderColor: '#f87171', // lighter red border
        borderWidth: '2px',
        fontWeight: 600
      };
    }
    return {};
  };

  // Base style for the div
  const baseStyle: CSSProperties = {
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  };

  // Combined style
  const combinedStyle: CSSProperties = {
    ...baseStyle,
    ...getSelectedStyle()
  };

  return (
    <div 
      className={cn(
        "relative cursor-pointer rounded-md border",
        getSlotClass(slot.status)
      )} 
      style={combinedStyle}
      onClick={() => onClick(slot)}
    >
      <div className="text-center w-full flex flex-col items-center justify-center">
        {slot.status === 'booked' ? (
          // Booked slots styling
          <>
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
              {slot.id < 0 ? 'Empty' : `€${slot.price}`}
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