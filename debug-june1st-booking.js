/**
 * Debug Script for June 1st Booking
 * 
 * This script checks:
 * 1. All time slots for June 1st
 * 2. The booking with reference WB-L_7LG1SG
 * 3. Connections between the booking and time slots
 * 4. Whether each time slot is sequential (30 min apart)
 */

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Configure global WebSocket for Neon
globalThis.WebSocket = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugJune1stBooking() {
  try {
    console.log("=".repeat(60));
    console.log("Debugging June 1st Booking (WB-L_7LG1SG)");
    console.log("=".repeat(60));
    
    // Query 1: Get the booking
    const bookingResult = await pool.query(`
      SELECT * FROM bookings WHERE reference = 'WB-L_7LG1SG'
    `);
    
    if (bookingResult.rows.length === 0) {
      console.log("ERROR: Booking with reference WB-L_7LG1SG not found!");
      return;
    }
    
    const booking = bookingResult.rows[0];
    console.log("Found booking:");
    console.log(booking);
    console.log("-".repeat(60));
    
    // Query 2: Get all time slots for this booking
    const timeSlotResult = await pool.query(`
      SELECT ts.*, bts.id as join_id 
      FROM time_slots ts
      JOIN booking_time_slots bts ON ts.id = bts.time_slot_id
      WHERE bts.booking_id = $1
      ORDER BY ts.start_time
    `, [booking.id]);
    
    if (timeSlotResult.rows.length === 0) {
      console.log("ERROR: No time slots found for this booking!");
      return;
    }
    
    const timeSlots = timeSlotResult.rows;
    console.log(`Found ${timeSlots.length} time slots for this booking:`);
    timeSlots.forEach(slot => {
      console.log(`ID: ${slot.id}, Time: ${slot.start_time} - ${slot.end_time}, Status: ${slot.status}`);
    });
    console.log("-".repeat(60));
    
    // Check if the time slots are sequential (30 min apart)
    console.log("Checking if time slots are sequential (30 min apart):");
    let allSequential = true;
    
    for (let i = 0; i < timeSlots.length - 1; i++) {
      const currentSlot = timeSlots[i];
      const nextSlot = timeSlots[i + 1];
      
      const currentEnd = new Date(currentSlot.end_time).getTime();
      const nextStart = new Date(nextSlot.start_time).getTime();
      
      const diff = Math.abs(nextStart - currentEnd);
      const isSequential = diff < 1000; // Less than 1 second difference (accounting for DB timestamp precision)
      
      console.log(`Slot ${currentSlot.id} (${currentSlot.end_time}) to Slot ${nextSlot.id} (${nextSlot.start_time}): ${isSequential ? 'SEQUENTIAL ✓' : 'NOT SEQUENTIAL ✗'} (${diff/1000} seconds apart)`);
      
      if (!isSequential) {
        allSequential = false;
      }
    }
    
    console.log("-".repeat(60));
    console.log(`All slots sequential: ${allSequential ? 'YES ✓' : 'NO ✗'}`);
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

// Run the function and handle as top-level await
debugJune1stBooking().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});