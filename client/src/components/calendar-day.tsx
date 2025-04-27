import { format } from "date-fns";
import { DaySchedule, TimeSlot } from "@shared/schema";
import TimeSlotComponent from "./time-slot";

interface CalendarDayProps {
  day: DaySchedule;
  onTimeSlotClick: (timeSlot: TimeSlot) => void;
  isTimeSlotSelected: (timeSlot: TimeSlot) => boolean;
  isAdmin?: boolean;
}

const CalendarDay = ({ 
  day, 
  onTimeSlotClick, 
  isTimeSlotSelected,
  isAdmin = false
}: CalendarDayProps) => {
  return (
    <div className="flex flex-col min-w-[6rem] border-r border-gray-200">
      <div className="h-10 flex flex-col items-center justify-center day-header">
        <span className="font-medium text-gray-800">{day.dayShort}</span>
        <span className="text-xs text-gray-500">{day.dateFormatted}</span>
      </div>
      
      {/* Time slots for the day */}
      {day.slots.map((slot, index) => (
        <TimeSlotComponent
          key={slot.id}
          timeSlot={slot}
          onClick={onTimeSlotClick}
          isSelected={isTimeSlotSelected(slot)}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
};

export default CalendarDay;
