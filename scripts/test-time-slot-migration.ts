/**
 * Time Slot Schema Migration Test Script
 * 
 * This script tests the migration of time slot data to a new schema
 * that includes explicit timezone information. It creates a backup of the existing data,
 * performs a test migration, and then validates the results.
 */

import { db, pool } from "../server/db";
import { timeSlots } from "../shared/schema";
import { formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";
import { toLatviaTime, fromLatviaTime, LATVIA_TIMEZONE } from "../server/utils/timezone";

// Migration steps

interface TimeSlotRecord {
  id: number;
  status: string;
  startTime: Date;
  endTime: Date;
  price: string | number;
  reservationExpiry: Date | null;
}

interface EnhancedTimeSlotRecord extends TimeSlotRecord {
  storageTimezone: string;
}

async function testTimeSlotMigration() {
  console.log('\n=====================================================');
  console.log('TIME SLOT SCHEMA MIGRATION TEST');
  console.log('=====================================================\n');
  
  try {
    // 1. Back up existing time slots
    console.log('Backing up existing time slots...');
    const existingSlots = await db.select().from(timeSlots);
    
    console.log(`Found ${existingSlots.length} time slots to migrate`);
    
    if (existingSlots.length === 0) {
      console.log('No time slots found. Skipping migration test.');
      await pool.end();
      return;
    }
    
    // 2. Simulate creation of a new table with the enhanced schema
    console.log('\nSimulating schema migration...');
    
    // For this test, we'll transform the data in memory
    const migratedSlots: EnhancedTimeSlotRecord[] = existingSlots.map(slot => {
      // Ensure all dates are explicitly stored in UTC
      const startTime = new Date(slot.startTime);
      const endTime = new Date(slot.endTime);
      const reservationExpiry = slot.reservationExpiry ? new Date(slot.reservationExpiry) : null;
      
      return {
        ...slot,
        startTime,
        endTime,
        reservationExpiry,
        storageTimezone: "UTC" // explicitly mark timezone
      };
    });
    
    // 3. Validate the migrated data
    console.log('\nValidating migrated data...');
    
    // Check for timezone consistency
    const timezoneIssues = migratedSlots.filter(slot => slot.storageTimezone !== "UTC");
    if (timezoneIssues.length > 0) {
      console.log(`Found ${timezoneIssues.length} records with incorrect timezone after migration`);
    } else {
      console.log('Timezone validation passed: All records have UTC storage timezone');
    }
    
    // Check for slot duration consistency (should be 30 minutes)
    const durationIssues = migratedSlots.filter(slot => {
      const durationMinutes = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60);
      return durationMinutes !== 30;
    });
    
    if (durationIssues.length > 0) {
      console.log(`Found ${durationIssues.length} records with duration issues after migration`);
      console.log('Examples of duration issues:');
      for (const issue of durationIssues.slice(0, 3)) {
        const durationMinutes = (new Date(issue.endTime).getTime() - new Date(issue.startTime).getTime()) / (1000 * 60);
        console.log(`  Slot ID ${issue.id}: ${formatInTimeZone(new Date(issue.startTime), "UTC", 'yyyy-MM-dd HH:mm')} to ${formatInTimeZone(new Date(issue.endTime), "UTC", 'HH:mm')} (${durationMinutes} minutes)`);
      }
    } else {
      console.log('Duration validation passed: All time slots are exactly 30 minutes');
    }
    
    // Sample some slots and verify round-trip conversions
    console.log('\nTesting timezone round-trip conversions...');
    
    const sampleSlots = migratedSlots.slice(0, 5);
    for (const slot of sampleSlots) {
      const startUTC = new Date(slot.startTime);
      const startLatvia = toLatviaTime(startUTC);
      const startUTCRoundTrip = fromLatviaTime(startLatvia);
      
      console.log(`Slot ID ${slot.id}:`);
      console.log(`  UTC:        ${formatInTimeZone(startUTC, "UTC", 'yyyy-MM-dd HH:mm:ss z')}`);
      console.log(`  Latvia:     ${formatInTimeZone(startLatvia, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss z')}`);
      console.log(`  UTC again:  ${formatInTimeZone(startUTCRoundTrip, "UTC", 'yyyy-MM-dd HH:mm:ss z')}`);
      console.log(`  Round-trip successful: ${startUTC.getTime() === startUTCRoundTrip.getTime() ? 'Yes' : 'No'}`);
      console.log();
    }
    
    // 4. Output SQL migration script (commented out for safety)
    console.log('\n=====================================================');
    console.log('MIGRATION SQL SCRIPT (EXAMPLE ONLY - DO NOT RUN IN PRODUCTION)');
    console.log('=====================================================\n');
    
    console.log('-- Step 1: Create new table with enhanced schema');
    console.log(`CREATE TABLE time_slots_new (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  price NUMERIC NOT NULL,
  reservation_expiry TIMESTAMPTZ,
  storage_timezone TEXT NOT NULL DEFAULT 'UTC'
);`);
    
    console.log('\n-- Step 2: Migrate data from old table to new table');
    console.log(`INSERT INTO time_slots_new (id, status, start_time, end_time, price, reservation_expiry, storage_timezone)
SELECT 
  id, 
  status,
  start_time AT TIME ZONE 'UTC' as start_time,
  end_time AT TIME ZONE 'UTC' as end_time,
  price,
  reservation_expiry AT TIME ZONE 'UTC' as reservation_expiry,
  'UTC' as storage_timezone
FROM time_slots;`);
    
    console.log('\n-- Step 3: Rename tables to complete migration');
    console.log(`ALTER TABLE time_slots RENAME TO time_slots_old;
ALTER TABLE time_slots_new RENAME TO time_slots;`);
    
    console.log('\n-- Step 4: Create appropriate indexes for performance');
    console.log(`CREATE INDEX idx_time_slots_start_time ON time_slots(start_time);
CREATE INDEX idx_time_slots_status ON time_slots(status);`);
    
    console.log('\n-- Step 5 (Optional): Drop old table when confident about migration');
    console.log(`-- DROP TABLE time_slots_old;`);
    
    await pool.end();
    
  } catch (error) {
    console.error('Error during migration test:', error);
    await pool.end();
  }
}

// Run the migration test
testTimeSlotMigration();