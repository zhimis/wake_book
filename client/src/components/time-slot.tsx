import { formatPrice, getTimeSlotClass, formatInLatviaTime, toLatviaTime } from "@/lib/utils";
import { TimeSlot } from "@shared/schema";
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
  // Check if the time slot is in the past
  const isPast = new Date(timeSlot.endTime) < new Date();
  
  // For regular users, only available future slots are interactive
  // For admin, all slots are interactive regardless of status, even past ones
  const isInteractive = isPast 
    ? isAdmin // Only admin can interact with past slots
    : (isAdmin || timeSlot.status === "available" || isSelected);
  
  const handleClick = () => {
    // For regular users, only allow interaction with available slots
    // For admin, allow selecting any slot regardless of status
    if (isInteractive) {
      onClick(timeSlot);
    }
  };
  
  // For admin view, show more details
  if (isAdmin) {
    const statusText = timeSlot.status === "booked" ? "Booked" : "Available";
    const displayStatus = isPast ? `Past ${statusText}` : statusText;
    
    return (
      <div 
        className={cn(
          "h-16 m-0.5 rounded-md flex flex-col items-start justify-center text-sm p-2",
          getTimeSlotClass(timeSlot.status, isSelected, isPast),
          // Admin can select any slot
          "cursor-pointer"
        )}
        onClick={handleClick}
      >
        <span className="font-medium">
          {formatInLatviaTime(toLatviaTime(new Date(timeSlot.startTime)), "HH:mm")} - {formatInLatviaTime(toLatviaTime(new Date(timeSlot.endTime)), "HH:mm")}
        </span>
        <span className="text-xs text-gray-500">
          {formatPrice(timeSlot.price)} • {displayStatus}
        </span>
      </div>
    );
  }
  
  // Regular customer view
  return (
    <button 
      className={cn(
        "h-12 m-0.5 rounded-md flex flex-col items-center justify-center text-sm border-t border-gray-200",
        getTimeSlotClass(timeSlot.status, isSelected, isPast),
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
