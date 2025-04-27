import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, isTomorrow, addMinutes } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(price);
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return `Today, ${format(dateObj, "MMMM d")}`;
  }
  
  if (isYesterday(dateObj)) {
    return `Yesterday, ${format(dateObj, "MMMM d")}`;
  }
  
  if (isTomorrow(dateObj)) {
    return `Tomorrow, ${format(dateObj, "MMMM d")}`;
  }
  
  return format(dateObj, "EEEE, MMMM d");
}

export function formatTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "h:mm a");
}

export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "EEE, MMM d");
}

export function formatDayShort(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "EEE");
}

export function formatTimeSlot(startTime: Date | string, endTime: Date | string): string {
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  
  return `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

export function getTimeSlotClass(status: string, isSelected: boolean = false): string {
  if (isSelected) {
    return "slot-selected bg-primary-light bg-opacity-20 border-2 border-primary";
  }
  
  switch (status) {
    case "available":
      return "slot-available bg-success bg-opacity-10 border border-success";
    case "booked":
      return "slot-booked bg-destructive bg-opacity-10 border border-destructive cursor-not-allowed opacity-60";
    case "reserved":
      return "slot-reserved bg-warning bg-opacity-10 border border-warning cursor-not-allowed opacity-60";
    default:
      return "slot-available bg-success bg-opacity-10 border border-success";
  }
}

export function generateBookingReference(): string {
  const prefix = "WB";
  const date = format(new Date(), "yyMM");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${date}-${random}`;
}

export function formatTimeFromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  }
  
  return `${mins}:00`;
}

export function getEndTimeFromDuration(startTime: Date, durationMinutes: number): Date {
  return addMinutes(startTime, durationMinutes);
}

export function groupTimeSlotsByDay(timeSlots: any[]) {
  const grouped: Record<string, any[]> = {};
  
  for (const slot of timeSlots) {
    const date = new Date(slot.startTime);
    const day = format(date, "yyyy-MM-dd");
    
    if (!grouped[day]) {
      grouped[day] = [];
    }
    
    grouped[day].push(slot);
  }
  
  return Object.entries(grouped).map(([dateStr, slots]) => {
    const date = new Date(dateStr);
    return {
      date,
      dayName: format(date, "EEEE"),
      dayShort: format(date, "EEE"),
      dateFormatted: format(date, "MMM d"),
      slots: slots.sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }),
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function calculateTotalPrice(timeSlots: any[], equipmentRental: boolean = false): number {
  let total = timeSlots.reduce((sum, slot) => sum + slot.price, 0);
  
  if (equipmentRental) {
    total += 30; // $30 for equipment rental
  }
  
  return total;
}

export function getDaysBetweenDates(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return days;
}
