/**
 * Timezone Utility Functions for Server-Side
 * 
 * This module provides timezone conversion functions specifically for
 * handling Latvia timezone (Europe/Riga) on the server side.
 */

import { format, formatISO, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

// Constants
export const LATVIA_TIMEZONE = 'Europe/Riga';
export const UTC_TIMEZONE = 'UTC';

/**
 * Convert a date to Latvia time
 * @param date Date object or ISO string
 * @returns Date object in Latvia timezone
 */
export function toLatviaTime(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(dateObj, LATVIA_TIMEZONE);
}

/**
 * Convert a date from Latvia time to UTC
 * @param latviaDate Date object or string representing a time in Latvia timezone
 * @returns Date object in UTC timezone
 */
export function fromLatviaTime(latviaDate: Date | string): Date {
  // If input is a string, we need special handling
  if (typeof latviaDate === 'string') {
    // Try to detect different string formats
    
    // Format: "2025-05-03 15:00:00" (space-separated date and time)
    if (latviaDate.includes(' ') && !latviaDate.includes('T')) {
      const [datePart, timePart] = latviaDate.split(' ');
      const [yearStr, monthStr, dayStr] = datePart.split('-');
      const timeParts = timePart.split(':');
      
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const day = parseInt(dayStr);
      const hour = parseInt(timeParts[0] || '0');
      const minute = parseInt(timeParts[1] || '0');
      const second = parseInt(timeParts[2] || '0');
      
      // Create a date with these components as if they are UTC
      const utcComponents = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      
      // Adjust for Latvia timezone
      // Determine if the date is in DST (simplified logic based on summer/winter)
      // More accurate would be to check the exact DST transition dates
      const isSummerMonth = month >= 3 && month <= 10;
      const isDST = isSummerMonth;
      const offsetHours = isDST ? 3 : 2;
      
      // Subtract the offset to get real UTC
      return new Date(utcComponents.getTime() - offsetHours * 60 * 60 * 1000);
    }
    
    // For ISO strings or other formats, create a Date object
    const dateObj = new Date(latviaDate);
    
    // Determine if Latvia is in DST at the time of this date
    const month = dateObj.getMonth() + 1; // getMonth() is 0-indexed
    const isSummerMonth = month >= 3 && month <= 10;
    const isDST = isSummerMonth;
    const latviaOffsetHours = isDST ? 3 : 2; // UTC+3 in summer, UTC+2 in winter
    
    // Adjust the time by the Latvia offset
    // For date strings, we assume they're already in Latvia time
    // So we subtract the offset to get UTC
    return new Date(dateObj.getTime() - latviaOffsetHours * 60 * 60 * 1000);
  }
  
  // If input is a Date object
  const dateObj = latviaDate;
  
  // Get the formatted time string in Latvia timezone
  const latviaTimeStr = formatInTimeZone(dateObj, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  
  // Parse the components
  const [datePart, timePart] = latviaTimeStr.split(' ');
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const [hourStr, minuteStr, secondStr] = timePart.split(':');
  
  // Parse each component as a number
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);
  const hour = parseInt(hourStr);
  const minute = parseInt(minuteStr);
  const second = parseInt(secondStr);
  
  // Create a date using UTC constructor with the same components
  // This treats these components as UTC time values
  const utcComponents = new Date(Date.UTC(
    year,
    month - 1, // Month is 0-indexed in JavaScript
    day,
    hour,
    minute,
    second
  ));
  
  // Determine if the date is in DST in Latvia
  const latviaZone = formatInTimeZone(dateObj, LATVIA_TIMEZONE, 'z');
  const isDST = latviaZone.includes('+3');
  const latviaOffsetHours = isDST ? 3 : 2; // UTC+3 in summer, UTC+2 in winter
  
  // Subtract the Latvia timezone offset to get the correct UTC time
  return new Date(utcComponents.getTime() - latviaOffsetHours * 60 * 60 * 1000);
}

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
 * Validate a date's format and whether it's in a valid range
 * @param date Date string to validate
 * @param format Expected format string (YYYY-MM-DD, etc.)
 * @param minDate Optional minimum valid date
 * @param maxDate Optional maximum valid date
 * @returns Boolean indicating if the date is valid
 */
export function validateDate(
  date: string, 
  minDate?: Date, 
  maxDate?: Date
): boolean {
  try {
    const dateObj = new Date(date);
    
    // Check if it's a valid date
    if (isNaN(dateObj.getTime())) {
      return false;
    }
    
    // Check range if provided
    if (minDate && dateObj < minDate) {
      return false;
    }
    
    if (maxDate && dateObj > maxDate) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get an ISO string formatted in Latvia timezone
 * @param date Date object or ISO string
 * @returns ISO string in Latvia timezone
 */
export function getLatviaISOString(date: Date | string): string {
  const latviaTime = toLatviaTime(date);
  return formatISO(latviaTime);
}

/**
 * Check if a date is within Latvia business hours (8:00-22:00)
 * @param date Date object or ISO string
 * @returns Boolean indicating if the date is within business hours
 */
export function isWithinLatviaBusinessHours(date: Date | string): boolean {
  const latviaTime = toLatviaTime(date);
  const hours = latviaTime.getHours();
  return hours >= 8 && hours < 22;
}

/**
 * Get the start of the day in Latvia timezone
 * @param date Date object or ISO string
 * @returns Date object representing the start of the day in Latvia timezone
 */
export function getLatviaDayStart(date: Date | string): Date {
  const latviaTime = toLatviaTime(date);
  
  // Set to midnight in Latvia timezone
  latviaTime.setHours(0, 0, 0, 0);
  
  return latviaTime;
}

/**
 * Get the end of the day in Latvia timezone
 * @param date Date object or ISO string
 * @returns Date object representing the end of the day in Latvia timezone
 */
export function getLatviaDayEnd(date: Date | string): Date {
  const latviaTime = toLatviaTime(date);
  
  // Set to 23:59:59.999 in Latvia timezone
  latviaTime.setHours(23, 59, 59, 999);
  
  return latviaTime;
}