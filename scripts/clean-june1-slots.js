/**
 * Script to clear all time slots for June 1st, 2025
 * This script will:
 * 1. Remove the booking-timeslot associations for June 1st
 * 2. Update the time slot status to 'available'
 */

import { db } from '../server/db';
import { timeSlots, bookingTimeSlots } from '../shared/schema';
import { and, eq, gte, lt } from 'drizzle-orm';

async function clearJune1stTimeSlots() {
  try {
    console.log('Starting script to clear June 1st time slots...');

    // Define June 1st, 2025 date range (UTC)
    const startDate = new Date('2025-06-01T00:00:00.000Z');
    const endDate = new Date('2025-06-01T23:59:59.999Z');
    
    // 1. Find all time slots on June 1st
    const june1stSlots = await db.select()
      .from(timeSlots)
      .where(
        and(
          gte(timeSlots.startTime, startDate),
          lt(timeSlots.startTime, endDate)
        )
      );
    
    console.log(`Found ${june1stSlots.length} time slots on June 1st, 2025`);
    
    // Extract the IDs of booked slots
    const bookedSlots = june1stSlots.filter(slot => slot.status === 'booked');
    const bookedSlotIds = bookedSlots.map(slot => slot.id);
    
    console.log(`Of these, ${bookedSlots.length} slots are currently booked`);

    if (bookedSlotIds.length > 0) {
      // 2. Remove booking associations for these slots (delete from booking_time_slots)
      const deletedAssociations = await db.delete(bookingTimeSlots)
        .where(
          bookingTimeSlots.timeSlotId.in(bookedSlotIds)
        )
        .returning();

      console.log(`Removed ${deletedAssociations.length} booking associations`);
      
      // 3. Update the status of all slots to 'available'
      const updatedSlots = await db.update(timeSlots)
        .set({ status: 'available' })
        .where(
          and(
            gte(timeSlots.startTime, startDate),
            lt(timeSlots.startTime, endDate),
            eq(timeSlots.status, 'booked')
          )
        )
        .returning();
      
      console.log(`Updated ${updatedSlots.length} slots to 'available' status`);
    } else {
      console.log('No booked slots found on June 1st, nothing to clear');
    }
    
    console.log('Script completed successfully');
    
  } catch (error) {
    console.error('Error in clearJune1stTimeSlots script:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
clearJune1stTimeSlots();