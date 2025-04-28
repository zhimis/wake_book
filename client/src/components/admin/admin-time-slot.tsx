import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TimeSlot } from "@shared/schema";
import { CSSProperties } from 'react';

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
  // Get CSS class for time slot based on status
  const getSlotClass = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800 hover:bg-green-200 hover:scale-105 transition-transform";
      case "booked":
        return "bg-red-100 text-red-800 hover:bg-red-200 hover:scale-105 transition-transform";
      case "reserved":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:scale-105 transition-transform";
      default:
        return "bg-gray-100 text-gray-800 hover:scale-105 transition-transform";
    }
  };

  // Get selected state style (using different approach to work around styling issues)
  const getSelectedStyle = (): CSSProperties => {
    if (isSelected) {
      return {
        position: 'relative' as const,
        background: '#ffcccc',
        boxShadow: '0 0 8px #ff0000',
        zIndex: 10,
        borderColor: '#ff0000',
        borderWidth: '3px'
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
  };

  // Combined style
  const combinedStyle: CSSProperties = {
    ...baseStyle,
    ...getSelectedStyle()
  };

  // Use a completely different visualization approach
  return (
    <div 
      className={cn(
        "relative cursor-pointer rounded-md border",
        getSlotClass(slot.status)
      )} 
      style={combinedStyle}
      onClick={() => onClick(slot)}
    >
      {/* Visual indicator for selected state */}
      {isSelected && (
        <div 
          className="absolute inset-0 border-4 border-red-500 rounded-md"
          style={{ pointerEvents: 'none' }}
        ></div>
      )}
      
      <div className="text-center w-full">
        <Badge variant="outline" className="px-1 h-4 text-[10px]">
          €{slot.price}
        </Badge>
      </div>
    </div>
  );
};

export default AdminTimeSlot;