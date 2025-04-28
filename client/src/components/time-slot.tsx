import { formatPrice, getTimeSlotClass } from "@/lib/utils";
import { TimeSlot } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TimeSlotProps {
  timeSlot: TimeSlot;
  onClick: (timeSlot: TimeSlot) => void;
  isSelected: boolean;
  isAdmin?: boolean;
}

const TimeSlotComponent = ({ 
  timeSlot, 
  onClick, 
  isSelected,
  isAdmin = false
}: TimeSlotProps) => {
  // For regular users, only available slots are interactive
  // For admin, all slots are interactive regardless of status
  const isInteractive = isAdmin ? true : (timeSlot.status === "available" || isSelected);
  
  const handleClick = () => {
    // For regular users, only allow interaction with available slots
    // For admin, allow selecting any slot regardless of status
    if (isInteractive) {
      onClick(timeSlot);
    }
  };
  
  // For admin view, show more details
  if (isAdmin) {
    return (
      <div 
        className={cn(
          "h-16 m-0.5 rounded-md flex flex-col items-start justify-center text-sm p-2",
          getTimeSlotClass(timeSlot.status, isSelected),
          // Admin can select any slot
          "cursor-pointer"
        )}
        onClick={handleClick}
      >
        <span className="font-medium">
          {format(new Date(timeSlot.startTime), "HH:mm")} - {format(new Date(timeSlot.endTime), "HH:mm")}
        </span>
        <span className="text-xs text-gray-500">
          {formatPrice(timeSlot.price)} • {timeSlot.status === "booked" ? "Booked" : timeSlot.status === "reserved" ? "Reserved" : "Available"}
        </span>
      </div>
    );
  }
  
  // Regular customer view
  return (
    <button 
      className={cn(
        "h-12 m-0.5 rounded-md flex flex-col items-center justify-center text-sm border-t border-gray-200",
        getTimeSlotClass(timeSlot.status, isSelected),
        isInteractive ? "" : "cursor-not-allowed opacity-60"
      )}
      onClick={handleClick}
      disabled={!isInteractive}
    >
      <span className="font-medium">{formatPrice(timeSlot.price)}</span>
    </button>
  );
};

export default TimeSlotComponent;
