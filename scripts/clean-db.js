// Database cleanup script for Hi Wake 2.0
// This script cleans booking and time slot data while preserving system configuration

import { pool, db } from '../server/db.js';
import { bookings, bookingTimeSlots, timeSlots } from '../shared/schema.js';

async function cleanDatabase() {
  console.log('Starting database cleanup...');
  
  try {
    // Get counts before cleanup
    const beforeCounts = await getDataCounts();
    console.log('Before cleanup:');
    console.log(`- Time slots: ${beforeCounts.timeSlots}`);
    console.log(`- Bookings: ${beforeCounts.bookings}`);
    console.log(`- Booking time slots: ${beforeCounts.bookingTimeSlots}`);

    // Delete data in the correct order to respect foreign key relationships
    console.log('\nDeleting booking time slots...');
    await db.delete(bookingTimeSlots);
    
    console.log('Deleting bookings...');
    await db.delete(bookings);
    
    console.log('Deleting time slots...');
    await db.delete(timeSlots);

    // Get counts after cleanup
    const afterCounts = await getDataCounts();
    console.log('\nAfter cleanup:');
    console.log(`- Time slots: ${afterCounts.timeSlots}`);
    console.log(`- Bookings: ${afterCounts.bookings}`);
    console.log(`- Booking time slots: ${afterCounts.bookingTimeSlots}`);
    
    console.log('\nDatabase cleanup completed successfully!');
    console.log('The system will regenerate time slots when a user accesses the booking page.');
  } catch (error) {
    console.error('Error during database cleanup:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

async function getDataCounts() {
  const timeSlotsCount = await db.select({ count: { expression: 'count(*)' } }).from(timeSlots);
  const bookingsCount = await db.select({ count: { expression: 'count(*)' } }).from(bookings);
  const bookingTimeSlotsCount = await db.select({ count: { expression: 'count(*)' } }).from(bookingTimeSlots);
  
  return {
    timeSlots: parseInt(timeSlotsCount[0]?.count || '0'),
    bookings: parseInt(bookingsCount[0]?.count || '0'),
    bookingTimeSlots: parseInt(bookingTimeSlotsCount[0]?.count || '0')
  };
}

// Execute the cleanup function
cleanDatabase();