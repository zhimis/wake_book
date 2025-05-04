/**
 * Timezone-Aware Time Slot Generation Functions
 * 
 * This module provides functions for generating time slots with proper
 * timezone handling for Latvia (Europe/Riga).
 */

import { InsertTimeSlot, OperatingHours, Pricing } from "@shared/schema";
import { 
  toLatviaTime, 
  fromLatviaTime, 
  formatInLatviaTime,
  LATVIA_TIMEZONE
} from "./timezone";
import { format, addDays, addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Generate time slots for a range of dates with proper timezone handling
 * 
 * @param startDate Start date of the range (in any timezone)
 * @param endDate End date of the range (in any timezone)
 * @param operatingHours Operating hours configuration
 * @param pricingRules Pricing rules configuration
 * @returns Array of time slots ready to be inserted into the database (all dates in UTC)
 */
export async function generateTimeSlotsWithTimezone(
  startDate: Date,
  endDate: Date,
  operatingHours: OperatingHours[],
  pricingRules: Pricing[]
): Promise<InsertTimeSlot[]> {
  // Convert input dates to Latvia timezone for processing
  const latviaStartDate = toLatviaTime(startDate);
  latviaStartDate.setHours(0, 0, 0, 0); // Start of day in Latvia
  
  const latviaEndDate = toLatviaTime(endDate);
  latviaEndDate.setHours(23, 59, 59, 999); // End of day in Latvia
  
  console.log(`Generating time slots from ${formatInTimeZone(latviaStartDate, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(latviaEndDate, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')} (Latvia time)`);
  
  const timeSlots: InsertTimeSlot[] = [];
  let currentDate = new Date(latviaStartDate);
  
  // Process each day in Latvia timezone
  while (currentDate <= latviaEndDate) {
    // Get the day of week based on Latvia timezone (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = currentDate.getDay();
    
    console.log(`Processing day: ${format(currentDate, 'yyyy-MM-dd')} (${dayOfWeek})`);
    
    // Find operating hours for this day
    const dayOperatingHours = operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);
    
    if (!dayOperatingHours) {
      console.log(`No operating hours defined for day ${dayOfWeek}`);
      currentDate = addDays(currentDate, 1);
      continue;
    }
    
    if (dayOperatingHours.isClosed) {
      console.log(`Day ${dayOfWeek} is marked as closed`);
      currentDate = addDays(currentDate, 1);
      continue;
    }
    
    // Parse opening and closing hours
    const [openHour, openMinute] = dayOperatingHours.openTime.split(':').map(Number);
    const [closeHour, closeMinute] = dayOperatingHours.closeTime.split(':').map(Number);
    
    // Create a proper opening time Date object in Latvia timezone
    const openingTime = new Date(currentDate);
    openingTime.setHours(openHour, openMinute, 0, 0);
    
    // Create a proper closing time Date object in Latvia timezone
    const closingTime = new Date(currentDate);
    closingTime.setHours(closeHour, closeMinute, 0, 0);
    
    console.log(`Operating hours for this day: ${formatInTimeZone(openingTime, LATVIA_TIMEZONE, 'HH:mm')} - ${formatInTimeZone(closingTime, LATVIA_TIMEZONE, 'HH:mm')} (Latvia time)`);
    
    // Create time slots in 30-minute increments in Latvia timezone
    let slotStartTime = new Date(openingTime);
    
    while (slotStartTime < closingTime) {
      // Each slot is 30 minutes
      const slotEndTime = addMinutes(slotStartTime, 30);
      
      // If the end time exceeds closing, we're done for the day
      if (slotEndTime > closingTime) {
        break;
      }
      
      // Convert slot times to UTC for storage
      const utcStartTime = fromLatviaTime(slotStartTime);
      const utcEndTime = fromLatviaTime(slotEndTime);
      
      // Determine pricing based on time and day
      const standardPricing = pricingRules.find(p => p.name === 'standard');
      const peakPricing = pricingRules.find(p => p.name === 'peak');
      
      // Default to standard price
      let price = standardPricing ? standardPricing.price : 20;
      
      // Get hour in Latvia time for pricing determination
      const hour = slotStartTime.getHours();
      
      // Apply peak pricing based on rules:
      // 1. Monday to Friday (1-5): 17:00-22:00
      // 2. Saturday and Sunday (0,6): All day
      const isPeakTime = (
        // Weekend (all day)
        (dayOfWeek === 0 || dayOfWeek === 6) ||
        // Weekday peak hours (17:00-22:00)
        (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 17 && hour < 22)
      );
      
      if (isPeakTime && peakPricing) {
        price = peakPricing.price;
      }
      
      // Create time slot with UTC times for database storage
      timeSlots.push({
        startTime: utcStartTime,
        endTime: utcEndTime,
        price: Math.round(price), // Round to nearest whole number
        status: 'available',
        reservationExpiry: null
      });
      
      // Debug log
      console.log(`Generated slot: ${formatInTimeZone(slotStartTime, LATVIA_TIMEZONE, 'HH:mm')} - ${formatInTimeZone(slotEndTime, LATVIA_TIMEZONE, 'HH:mm')} (Latvia time) | ${formatInTimeZone(utcStartTime, 'UTC', 'HH:mm')} - ${formatInTimeZone(utcEndTime, 'UTC', 'HH:mm')} (UTC)`);
      
      // Move to next slot
      slotStartTime = new Date(slotEndTime);
    }
    
    // Move to next day in Latvia timezone
    currentDate = addDays(currentDate, 1);
  }
  
  console.log(`Generated ${timeSlots.length} time slots`);
  return timeSlots;
}

/**
 * Check if a set of time slots would create conflicts with existing bookings
 * 
 * @param newSlots New time slots to check
 * @param existingBookedSlots Existing booked time slots
 * @returns Array of conflict details
 */
export function checkTimeSlotConflicts(
  newSlots: InsertTimeSlot[],
  existingBookedSlots: { startTime: Date, endTime: Date, id: number }[]
): { id: number, startTime: Date, conflictTime: string }[] {
  const conflicts = [];
  
  for (const existingSlot of existingBookedSlots) {
    for (const newSlot of newSlots) {
      // Convert dates to consistent format for comparison
      const existingStart = new Date(existingSlot.startTime);
      const existingEnd = new Date(existingSlot.endTime);
      const newStart = new Date(newSlot.startTime);
      const newEnd = new Date(newSlot.endTime);
      
      // Check for overlap
      if (
        (newStart >= existingStart && newStart < existingEnd) || // New slot starts during existing
        (newEnd > existingStart && newEnd <= existingEnd) || // New slot ends during existing
        (newStart <= existingStart && newEnd >= existingEnd) // New slot contains existing
      ) {
        // Format conflict times in Latvia timezone for readability
        const conflictTime = formatInLatviaTime(existingStart, 'yyyy-MM-dd HH:mm');
        
        conflicts.push({
          id: existingSlot.id,
          startTime: existingStart,
          conflictTime
        });
        
        // No need to check other new slots against this existing slot
        break;
      }
    }
  }
  
  return conflicts;
}