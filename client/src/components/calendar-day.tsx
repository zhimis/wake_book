import { format } from "date-fns";
import { DaySchedule, TimeSlot } from "@shared/schema";
import TimeSlotComponent from "./time-slot";

interface CalendarDayProps {
  day: DaySchedule;
  onTimeSlotClick: (timeSlot: TimeSlot) => void;
  isTimeSlotSelected: (timeSlot: TimeSlot) => boolean;
  isAdmin?: boolean;
  isCurrentDay?: boolean;
}

const CalendarDay = ({ 
  day, 
  onTimeSlotClick, 
  isTimeSlotSelected,
  isAdmin = false,
  isCurrentDay = false
}: CalendarDayProps) => {
  return (
    <div className={`flex flex-col min-w-[6rem] border-r border-gray-200 ${isCurrentDay ? 'bg-blue-50' : ''}`}>
      <div className={`h-10 flex flex-col items-center justify-center day-header ${isCurrentDay ? 'bg-blue-100' : ''}`}>
        <span className={`font-medium ${isCurrentDay ? 'text-blue-700' : 'text-gray-800'}`}>{day.dayShort}</span>
        <span className={`text-xs ${isCurrentDay ? 'text-blue-600' : 'text-gray-500'}`}>{format(day.date, "MMM d")}</span>
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
