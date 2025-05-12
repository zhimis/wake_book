/**
 * Clean up duplicate time slots
 * 
 * This script:
 * 1. Finds all duplicate time slots (same start_time)
 * 2. Keeps only one slot per time period, prioritizing:
 *    - Slots with 'booked' status
 *    - Slots with higher IDs (newer slots)
 * 3. Deletes the redundant slots
 */

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Configure global WebSocket for Neon
globalThis.WebSocket = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanDuplicateTimeSlots() {
  console.log("=".repeat(60));
  console.log("Starting duplicate time slot cleanup");
  console.log("=".repeat(60));

  const client = await pool.connect();

  try {
    // Start a transaction
    await client.query('BEGIN');

    // Step 1: Find all time periods that have duplicate slots
    const duplicatePeriodsQuery = `
      SELECT 
        DATE_TRUNC('minute', start_time) as time_period,
        COUNT(*) as slot_count
      FROM 
        time_slots
      GROUP BY 
        DATE_TRUNC('minute', start_time)
      HAVING 
        COUNT(*) > 1
      ORDER BY 
        time_period;
    `;

    const duplicatePeriodsResult = await client.query(duplicatePeriodsQuery);
    const duplicatePeriods = duplicatePeriodsResult.rows;
    
    console.log(`Found ${duplicatePeriods.length} time periods with duplicate slots`);

    // Step 2: For each duplicate period, find the slots and decide which to keep
    let totalDuplicatesRemoved = 0;

    for (const period of duplicatePeriods) {
      const timePeriod = period.time_period;
      
      // Get all slots for this time period
      const slotsQuery = `
        SELECT 
          id, 
          start_time, 
          end_time, 
          status,
          EXISTS (
            SELECT 1 
            FROM booking_time_slots 
            WHERE time_slot_id = time_slots.id
          ) as has_booking
        FROM 
          time_slots
        WHERE 
          DATE_TRUNC('minute', start_time) = $1
        ORDER BY 
          id DESC;
      `;
      
      const slotsResult = await client.query(slotsQuery, [timePeriod]);
      const slots = slotsResult.rows;
      
      console.log(`Time period ${new Date(timePeriod).toISOString()} has ${slots.length} duplicate slots:`);
      slots.forEach((slot, i) => {
        console.log(`  ${i+1}. ID: ${slot.id}, Status: ${slot.status}, Has booking: ${slot.has_booking}`);
      });
      
      // Decide which slot to keep
      let slotToKeep = null;
      
      // First priority: Any slot that has a booking reference
      const slotsWithBooking = slots.filter(slot => slot.has_booking);
      if (slotsWithBooking.length > 0) {
        slotToKeep = slotsWithBooking[0]; // Keep the first one with a booking
        console.log(`  Keeping slot ${slotToKeep.id} (has booking)`);
      } 
      // Second priority: Any slot with 'booked' status
      else {
        const bookedSlots = slots.filter(slot => slot.status === 'booked');
        if (bookedSlots.length > 0) {
          slotToKeep = bookedSlots[0]; // Keep the first booked slot
          console.log(`  Keeping slot ${slotToKeep.id} (booked status)`);
        } 
        // Third priority: Just keep the highest ID (newest) slot
        else {
          slotToKeep = slots[0]; // Slots are ordered by ID DESC
          console.log(`  Keeping slot ${slotToKeep.id} (highest ID)`);
        }
      }
      
      // Create a list of slot IDs to delete (all except the one to keep)
      const slotIdsToDelete = slots
        .filter(slot => slot.id !== slotToKeep.id)
        .map(slot => slot.id);
      
      if (slotIdsToDelete.length > 0) {
        console.log(`  Deleting slots: ${slotIdsToDelete.join(', ')}`);
        
        // Delete the duplicate slots
        const deleteQuery = `
          DELETE FROM time_slots
          WHERE id = ANY($1::int[]);
        `;
        
        const deleteResult = await client.query(deleteQuery, [slotIdsToDelete]);
        console.log(`  Deleted ${deleteResult.rowCount} slots`);
        
        totalDuplicatesRemoved += deleteResult.rowCount;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log("=".repeat(60));
    console.log(`Cleanup complete. Removed ${totalDuplicatesRemoved} duplicate slots.`);
    console.log("=".repeat(60));
    
  } catch (error) {
    // Rollback the transaction if any error occurs
    await client.query('ROLLBACK');
    console.error("Error during cleanup:", error);
  } finally {
    // Release the client back to the pool
    client.release();
    await pool.end();
  }
}

// Run the cleanup function
cleanDuplicateTimeSlots().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});