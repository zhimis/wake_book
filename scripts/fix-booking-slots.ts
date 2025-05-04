import { db, pool } from '../server/db';
import { timeSlots, bookingTimeSlots } from '../shared/schema';
import { eq, sql, and, between } from 'drizzle-orm';

// Function to fix duplicate time slots issue when regenerating slots
async function fixTimeSlotDuplicates() {
  console.log("Starting time slot fix script...");
  
  try {
    // 1. Get all booked time slots
    const bookedSlots = await db.select()
      .from(timeSlots)
      .where(eq(timeSlots.status, 'booked'));
    
    console.log(`Found ${bookedSlots.length} booked time slots`);
    
    // 2. For each booked slot, find duplicates (same time but different IDs)
    const fixedCount = { deleted: 0, preserved: 0 };
    
    for (const bookedSlot of bookedSlots) {
      // Find any duplicate available slots that overlap with this booked slot
      const duplicates = await db.select()
        .from(timeSlots)
        .where(
          and(
            eq(timeSlots.status, 'available'),
            eq(timeSlots.startTime, bookedSlot.startTime),
            eq(timeSlots.endTime, bookedSlot.endTime)
          )
        );
      
      if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicates for booked slot ID ${bookedSlot.id}`);
        
        // 3. Delete the duplicate available slots
        for (const dupe of duplicates) {
          await db.delete(timeSlots)
            .where(eq(timeSlots.id, dupe.id));
          
          fixedCount.deleted++;
          console.log(`Deleted duplicate available slot ID ${dupe.id} (${dupe.startTime} - ${dupe.endTime})`);
        }
        
        fixedCount.preserved++;
      }
    }
    
    console.log('Fix complete!');
    console.log(`Summary: Preserved ${fixedCount.preserved} booked slots, removed ${fixedCount.deleted} duplicate available slots`);
    
    return fixedCount;
  } catch (error) {
    console.error('Error fixing time slots:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute the fix function
fixTimeSlotDuplicates()
  .then((result) => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });