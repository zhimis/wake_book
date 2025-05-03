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
 * @param latviaDate Date object or ISO string representing a time in Latvia timezone
 * @returns Date object in UTC timezone
 */
export function fromLatviaTime(latviaDate: Date | string): Date {
  const dateObj = typeof latviaDate === 'string' ? new Date(latviaDate) : latviaDate;
  
  // Get the Latvia time components using date-fns-tz to handle DST properly
  const latviaTime = formatInTimeZone(dateObj, LATVIA_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS"); 
  
  // To convert from Latvia time to UTC:
  // 1. Parse the time components
  const [datePart, timePart] = latviaTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, secondWithMs] = timePart.split(':');
  const [second, ms] = secondWithMs.split('.').map(Number);
  
  // 2. Create a Date in UTC with those components
  const utcDate = new Date(Date.UTC(
    year,
    month - 1, // Month is 0-indexed in JavaScript
    day,
    parseInt(hour),
    parseInt(minute),
    second || 0,
    ms || 0
  ));
  
  // 3. Now we need to adjust for the Latvia timezone offset
  // Summer time (EEST): UTC+3, Winter time (EET): UTC+2
  
  // Determine if the date is in DST by comparing formatted times
  const isDST = formatInTimeZone(dateObj, LATVIA_TIMEZONE, 'z').includes('+3');
  const offsetHours = isDST ? 3 : 2;
  
  // Subtract the Latvia offset to get back to UTC
  return new Date(utcDate.getTime() - offsetHours * 60 * 60 * 1000);
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