import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TimeSlot } from "@shared/schema";
import { CSSProperties } from 'react';
import { Eye, Edit, Lock } from 'lucide-react';

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
  console.log(`AdminTimeSlot rendering with id: ${slot.id}, selected: ${isSelected}, status: ${slot.status}`);
  
  // Get CSS class for time slot based on status
  const getSlotClass = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 hover:bg-green-200 hover:scale-105 transition-transform";
      case "booked":
        return "bg-amber-100 text-amber-800 hover:bg-amber-200";  // Remove hover effect for clarity
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
          <>
            <Badge variant="outline" className="px-1 h-4 text-[10px]">
              €{slot.price}
            </Badge>
          </>
        ) : (
          <>
            <Badge variant="outline" className="px-1 h-4 text-[10px]">
              €{slot.price}
            </Badge>
            {isSelected && (
              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                <Badge className="w-3 h-3 flex items-center justify-center p-0 bg-primary">✓</Badge>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminTimeSlot;