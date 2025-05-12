/**
 * Fix Booking Conflicts Script
 * 
 * This script identifies and resolves booking conflicts where multiple bookings
 * share the same time slots. It detects these conflicts and provides options to:
 * 1. Keep the most recent booking and update older ones
 * 2. Generate a report of all conflicts for manual resolution
 */

import { pool, db } from '../server/db';
import { schema } from '../shared/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';

interface ConflictInfo {
  timeSlotId: number;
  startTime: Date;
  endTime: Date;
  bookings: {
    id: number;
    reference: string;
    customerName: string;
    createdAt: Date;
  }[];
}

/**
 * Find all time slots that are associated with multiple bookings
 */
async function findConflictingTimeSlots() {
  console.log('Checking for time slot conflicts...');
  
  const conflicts: ConflictInfo[] = [];

  try {
    // Get all time slots that appear more than once in booking_time_slots
    const duplicateTimeSlots = await db.execute<{time_slot_id: number, count: number}>(
      sql`SELECT time_slot_id, COUNT(*) as count 
          FROM booking_time_slots 
          GROUP BY time_slot_id 
          HAVING COUNT(*) > 1`
    );
    
    console.log(`Found ${duplicateTimeSlots.length} time slots with potential conflicts`);
    
    // For each duplicate, get the full conflict information
    for (const duplicate of duplicateTimeSlots) {
      const timeSlotId = duplicate.time_slot_id;
      
      // Get the time slot details
      const timeSlot = await db.query.timeSlots.findFirst({
        where: eq(schema.timeSlots.id, timeSlotId)
      });
      
      if (!timeSlot) {
        console.log(`Time slot ${timeSlotId} not found, skipping`);
        continue;
      }
      
      // Get all bookings associated with this time slot
      const bookingTimeSlots = await db.query.bookingTimeSlots.findMany({
        where: eq(schema.bookingTimeSlots.timeSlotId, timeSlotId),
        with: {
          booking: true
        }
      });
      
      const bookings = bookingTimeSlots.map(bts => ({
        id: bts.booking.id,
        reference: bts.booking.reference,
        customerName: bts.booking.customerName,
        createdAt: bts.booking.createdAt
      }));
      
      conflicts.push({
        timeSlotId,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        bookings
      });
    }
    
    return conflicts;
  } catch (error) {
    console.error('Error finding conflicting time slots:', error);
    throw error;
  }
}

/**
 * Generate a report of all booking conflicts
 */
async function generateConflictReport() {
  const conflicts = await findConflictingTimeSlots();
  
  if (conflicts.length === 0) {
    console.log('No booking conflicts found!');
    return;
  }
  
  console.log('\n=== BOOKING CONFLICTS REPORT ===\n');
  
  conflicts.forEach(conflict => {
    console.log(`🕒 Time Slot ID: ${conflict.timeSlotId}`);
    console.log(`   Time: ${conflict.startTime.toISOString()} - ${conflict.endTime.toISOString()}`);
    console.log('   Conflicting Bookings:');
    
    // Sort bookings by creation time, newest first
    const sortedBookings = [...conflict.bookings].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    
    sortedBookings.forEach((booking, index) => {
      const newestLabel = index === 0 ? ' (NEWEST)' : '';
      console.log(`     - Booking #${booking.id} | Ref: ${booking.reference} | Customer: ${booking.customerName} | Created: ${booking.createdAt.toISOString()}${newestLabel}`);
    });
    
    console.log('');
  });
  
  console.log(`Total conflicts found: ${conflicts.length}`);
}

/**
 * Fix booking conflicts by keeping only the most recent booking for each time slot
 */
async function fixConflictsByKeepingNewest() {
  const conflicts = await findConflictingTimeSlots();
  
  if (conflicts.length === 0) {
    console.log('No booking conflicts found!');
    return;
  }
  
  console.log(`Found ${conflicts.length} time slots with conflicts. Starting resolution...`);
  
  for (const conflict of conflicts) {
    // Sort bookings by creation time, newest first
    const sortedBookings = [...conflict.bookings].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    
    // Keep the newest booking
    const newestBooking = sortedBookings[0];
    
    // Get the bookings to update (all except newest)
    const bookingsToUpdate = sortedBookings.slice(1);
    
    if (bookingsToUpdate.length === 0) {
      console.log(`No conflicting bookings to update for time slot ${conflict.timeSlotId}`);
      continue;
    }
    
    console.log(`Time slot ${conflict.timeSlotId}: Keeping booking ${newestBooking.reference} and updating ${bookingsToUpdate.length} older bookings`);
    
    try {
      // Begin a transaction for this conflict resolution
      await db.transaction(async (tx) => {
        // Remove the time slot association from older bookings
        for (const booking of bookingsToUpdate) {
          await tx.delete(schema.bookingTimeSlots).where(
            and(
              eq(schema.bookingTimeSlots.bookingId, booking.id),
              eq(schema.bookingTimeSlots.timeSlotId, conflict.timeSlotId)
            )
          );
          
          // Update the notes on the booking
          await tx.update(schema.bookings)
            .set({
              notes: sql`CONCAT(COALESCE(notes, ''), '\nTime slot conflict with ${newestBooking.reference} detected and resolved automatically. This slot was removed from this booking.')`
            })
            .where(eq(schema.bookings.id, booking.id));
        }
      });
      
      console.log(`Successfully resolved conflict for time slot ${conflict.timeSlotId}`);
    } catch (error) {
      console.error(`Error resolving conflict for time slot ${conflict.timeSlotId}:`, error);
    }
  }
  
  console.log('Finished resolving booking conflicts!');
}

/**
 * Main function to run the script
 */
async function run() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'report') {
      await generateConflictReport();
    } else if (command === 'fix') {
      await fixConflictsByKeepingNewest();
    } else {
      console.log('Usage: npm run script scripts/fix-booking-conflicts.ts [report|fix]');
      console.log('  report - Generate a report of all booking conflicts');
      console.log('  fix - Fix conflicts by keeping the most recent booking for each time slot');
    }
  } catch (error) {
    console.error('Error running fix-booking-conflicts script:', error);
  } finally {
    await pool.end();
  }
}

run();