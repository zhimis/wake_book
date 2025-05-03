import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, isTomorrow, addMinutes, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// Latvia timezone (EET in winter, EEST in summer)
export const LATVIA_TIMEZONE = 'Europe/Riga';
export const UTC_TIMEZONE = 'UTC';

/**
 * Utility for combining class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * TIMEZONE CONVERSION UTILITIES
 * These functions handle conversion between UTC and Latvia time
 */

/**
 * Convert any date to Latvia time
 * @param date Date object or ISO string
 * @returns Date object in Latvia timezone
 */
export function toLatviaTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, LATVIA_TIMEZONE);
}

/**
 * Convert any date from Latvia time to UTC
 * @param latviaDate Date object or ISO string representing a time in Latvia timezone
 * @returns Date object in UTC timezone
 */
export function fromLatviaTime(latviaDate: Date | string): Date {
  const dateObj = typeof latviaDate === 'string' ? new Date(latviaDate) : latviaDate;
  
  // Manual conversion from Latvia time to UTC using timezone offset
  const latviaTimeObj = new Date(dateObj);
  const tzOffset = latviaTimeObj.getTimezoneOffset();
  
  // Latvia is EET (GMT+2) in winter and EEST (GMT+3) in summer
  // getTimezoneOffset() returns minutes, negative for east of GMT
  // We need to convert Latvia time to UTC by subtracting the difference between
  // the local timezone offset and the Latvia timezone offset (2 or 3 hours)
  
  // Get the current Latvia timezone offset in minutes
  // This is a simplification - for production code, we would need a more robust solution
  const now = new Date();
  let latviaOffset = -120; // Default to EET (GMT+2) = -120 minutes
  
  // Crude check for daylight saving time (April to October)
  const month = now.getMonth(); // 0-11 (January is 0)
  if (month >= 3 && month <= 9) {
    latviaOffset = -180; // EEST (GMT+3) = -180 minutes
  }
  
  // Calculate the difference between local timezone and Latvia timezone
  const offsetDiff = tzOffset - latviaOffset;
  
  // Apply the offset difference to convert to UTC
  return new Date(latviaTimeObj.getTime() - offsetDiff * 60000);
}

/**
 * Create a new Date object with the given time in Latvia timezone
 * Useful for creating specific times for testing or default values
 * @param year Year
 * @param month Month (0-11)
 * @param day Day of month
 * @param hours Hours in 24-hour format
 * @param minutes Minutes
 * @param seconds Seconds (optional)
 * @returns Date object in UTC representing the specified Latvia time
 */
export function createLatviaTime(
  year: number, 
  month: number, 
  day: number, 
  hours: number, 
  minutes: number, 
  seconds: number = 0
): Date {
  // Create a date string in ISO format with the Latvia timezone offset
  // For a more robust implementation, the offset would need to account for DST
  
  // Simplification: construct an ISO string with the Latvia timezone offset
  // Month in Date constructor is 0-based (January is 0)
  
  // Get the current Latvia timezone offset (simplified approach)
  // This is a simplification - for production code, we would need a more robust solution
  let latviaOffset = "+02:00"; // Default to EET (GMT+2)
  
  // Crude check for daylight saving time (April to October)
  if (month >= 3 && month <= 9) {
    latviaOffset = "+03:00"; // EEST (GMT+3)
  }
  
  // Format the date as an ISO string with the correct timezone
  const isoString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}${latviaOffset}`;
  
  // Parse this ISO string to get a date in UTC
  return new Date(isoString);
}

/**
 * FORMAT AND DISPLAY UTILITIES
 * These functions handle proper formatting of dates for display
 */

/**
 * Format a date directly in Latvia time zone
 * @param date Date object or ISO string
 * @param formatStr Format string (date-fns format)
 * @returns Formatted date string in Latvia timezone
 */
export function formatInLatviaTime(date: Date | string, formatStr: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, LATVIA_TIMEZONE, formatStr);
}

/**
 * Format a date with explicit timezone indication
 * @param date Date object or ISO string
 * @param formatStr Format string (date-fns format)
 * @param includeTimezone Whether to append the timezone indicator
 * @returns Formatted date string with optional timezone indicator
 */
export function formatWithTimezone(
  date: Date | string, 
  formatStr: string,
  includeTimezone: boolean = true
): string {
  const formatted = formatInLatviaTime(date, formatStr);
  
  // Check if we should show the timezone indicator
  // Will show if explicitly requested or if user is not in Latvia timezone
  const shouldShow = includeTimezone && shouldShowTimezoneIndicator();
  
  return shouldShow ? `${formatted} (Latvia time)` : formatted;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Format a date with relative indicators (Today, Yesterday, Tomorrow)
 * @param date Date object or ISO string
 * @param includeTimezone Whether to include timezone indicator
 * @returns Formatted date string with relative indicators
 */
export function formatDate(date: Date | string, includeTimezone: boolean = false): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  // Always convert to Latvia time for display
  const latviaTime = toLatviaTime(dateObj);
  
  let result = "";
  if (isToday(latviaTime)) {
    result = `Today, ${formatInLatviaTime(latviaTime, "MMMM d")}`;
  } else if (isYesterday(latviaTime)) {
    result = `Yesterday, ${formatInLatviaTime(latviaTime, "MMMM d")}`;
  } else if (isTomorrow(latviaTime)) {
    result = `Tomorrow, ${formatInLatviaTime(latviaTime, "MMMM d")}`;
  } else {
    result = formatInLatviaTime(latviaTime, "EEEE, MMMM d");
  }
  
  // Check if we should show the timezone indicator
  const shouldShow = includeTimezone && shouldShowTimezoneIndicator();
  
  return shouldShow ? `${result} (Latvia time)` : result;
}

/**
 * Format time in 24-hour Latvia format
 * @param date Date object or ISO string
 * @param includeTimezone Whether to include timezone indicator
 * @returns Formatted time string
 */
export function formatTime(date: Date | string, includeTimezone: boolean = false): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  // Always convert to Latvia time for display
  const latviaTime = toLatviaTime(dateObj);
  const timeStr = formatInLatviaTime(latviaTime, "HH:mm"); // 24-hour format for Latvia
  
  // Check if we should show the timezone indicator
  const shouldShow = includeTimezone && shouldShowTimezoneIndicator();
  
  return shouldShow ? `${timeStr} (Latvia time)` : timeStr;
}

/**
 * Format date in short format
 * @param date Date object or ISO string
 * @param includeTimezone Whether to include timezone indicator
 * @returns Formatted short date
 */
export function formatDateShort(date: Date | string, includeTimezone: boolean = false): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  // Always convert to Latvia time for display
  const latviaTime = toLatviaTime(dateObj);
  const dateStr = formatInLatviaTime(latviaTime, "EEE, MMM d");
  
  // Check if we should show the timezone indicator
  const shouldShow = includeTimezone && shouldShowTimezoneIndicator();
  
  return shouldShow ? `${dateStr} (Latvia time)` : dateStr;
}

/**
 * Format just the day name in short format
 * @param date Date object or ISO string
 * @returns Short day name
 */
export function formatDayShort(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  // Always convert to Latvia time for display
  const latviaTime = toLatviaTime(dateObj);
  return formatInLatviaTime(latviaTime, "EEE");
}

/**
 * Format a time slot with start and end times
 * @param startTime Start time date object or ISO string
 * @param endTime End time date object or ISO string
 * @param includeTimezone Whether to include timezone indicator
 * @returns Formatted time slot string
 */
export function formatTimeSlot(
  startTime: Date | string, 
  endTime: Date | string, 
  includeTimezone: boolean = false
): string {
  const start = typeof startTime === "string" ? new Date(startTime) : startTime;
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  
  // Always convert to Latvia time for display
  const latviaStartTime = toLatviaTime(start);
  const latviaEndTime = toLatviaTime(end);
  
  const timeSlotStr = `${formatInLatviaTime(latviaStartTime, "HH:mm")} - ${formatInLatviaTime(latviaEndTime, "HH:mm")}`; // 24-hour format for Latvia
  
  // Check if we should show the timezone indicator
  const shouldShow = includeTimezone && shouldShowTimezoneIndicator();
  
  return shouldShow ? `${timeSlotStr} (Latvia time)` : timeSlotStr;
}

export function getTimeSlotClass(status: string, isSelected: boolean = false): string {
  if (isSelected) {
    return "slot-selected bg-primary-light bg-opacity-20 border-2 border-primary";
  }
  
  switch (status) {
    case "available":
      return "slot-available bg-success bg-opacity-10 border border-success";
    case "booked":
      return "slot-booked bg-warning bg-opacity-10 border border-warning cursor-not-allowed opacity-60";
    default:
      return "slot-available bg-success bg-opacity-10 border border-success";
  }
}

export function generateBookingReference(): string {
  const prefix = "WB";
  // Use Latvia time for the reference date part
  const latviaDate = toLatviaTime(new Date());
  const date = formatInLatviaTime(latviaDate, "yyMM");
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
    // Convert to Latvia time for grouping
    const latviaDate = toLatviaTime(date);
    const day = formatInLatviaTime(latviaDate, "yyyy-MM-dd");
    
    if (!grouped[day]) {
      grouped[day] = [];
    }
    
    grouped[day].push(slot);
  }
  
  return Object.entries(grouped).map(([dateStr, slots]) => {
    const date = new Date(dateStr);
    // Convert to Latvia time for display
    const latviaDate = toLatviaTime(date);
    return {
      date,
      dayName: formatInLatviaTime(latviaDate, "EEEE"),
      dayShort: formatInLatviaTime(latviaDate, "EEE"),
      dateFormatted: formatInLatviaTime(latviaDate, "MMM d"),
      slots: slots.sort((a, b) => {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      }),
    };
  }).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function calculateTotalPrice(timeSlots: any[], equipmentRental: boolean = false): number {
  let total = timeSlots.reduce((sum, slot) => sum + slot.price, 0);
  
  if (equipmentRental) {
    total += 30; // €30 for equipment rental
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

// Convert standard JS day index (0 = Sunday, 1 = Monday, etc) to Latvia format (0 = Monday, 1 = Tuesday, etc)
export function getLatvianDayIndex(standardDayIndex: number): number {
  // Convert from 0=Sunday to 0=Monday
  return standardDayIndex === 0 ? 6 : standardDayIndex - 1;
}

// Convert Latvia day index (0 = Monday, 1 = Tuesday, etc) to standard JS day (0 = Sunday, 1 = Monday, etc)
export function getStandardDayIndex(latvianDayIndex: number): number {
  // Convert from 0=Monday to 0=Sunday
  return latvianDayIndex === 6 ? 0 : latvianDayIndex + 1;
}

// Get day name from Latvia day index (0 = Monday, 1 = Tuesday, etc)
export function getLatvianDayName(latvianDayIndex: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[latvianDayIndex];
}

// Get Latvia day index from a Date object
export function getLatvianDayIndexFromDate(date: Date): number {
  const standardDayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  return getLatvianDayIndex(standardDayIndex);
}

// Get standard day index from a Date object (this is just date.getDay() but included for completeness)
export function getStandardDayIndexFromDate(date: Date): number {
  return date.getDay(); // 0 = Sunday, 1 = Monday, etc.
}

/**
 * TIMEZONE DETECTION UTILITIES
 * These functions help detect the user's timezone and decide when to show timezone indicators
 */

/**
 * Detects the user's current timezone
 * @returns The user's current timezone name (e.g., "Europe/Riga", "America/New_York")
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    // Fallback if Intl API is not supported
    return 'UTC';
  }
}

/**
 * Checks if the user is in the Latvia timezone
 * @returns True if the user is in the Europe/Riga timezone, false otherwise
 */
export function isUserInLatviaTimezone(): boolean {
  const userTimezone = getUserTimezone();
  return userTimezone === LATVIA_TIMEZONE;
}

/**
 * Determines if timezone indicators should be shown based on user's location
 * @param forceShow Force showing the indicator regardless of user's timezone
 * @returns True if timezone indicators should be shown
 */
export function shouldShowTimezoneIndicator(forceShow = false): boolean {
  // Always show if explicitly requested
  if (forceShow) return true;
  
  // Otherwise, show only if user is not in Latvia timezone
  return !isUserInLatviaTimezone();
}
