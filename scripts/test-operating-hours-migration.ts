/**
 * Operating Hours Schema Migration Test Script
 * 
 * This script tests the migration of operating hours data to a new schema
 * that includes timezone information. It creates a backup of the existing data,
 * performs a test migration, and then validates the results.
 */

import { db, pool } from "../server/db";
import { operatingHours } from "../shared/schema";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { LATVIA_TIMEZONE } from "../server/utils/timezone";

// Migration steps

interface OperatingHoursRecord {
  id: number;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface EnhancedOperatingHoursRecord extends OperatingHoursRecord {
  timezone: string;
  useLocalTime: boolean;
}

async function testOperatingHoursMigration() {
  console.log('\n=====================================================');
  console.log('OPERATING HOURS SCHEMA MIGRATION TEST');
  console.log('=====================================================\n');
  
  try {
    // 1. Back up existing operating hours
    console.log('Backing up existing operating hours...');
    const existingHours = await db.select().from(operatingHours);
    
    console.log(`Found ${existingHours.length} operating hours records to migrate`);
    
    // 2. Simulate creation of a new table with the enhanced schema
    console.log('\nSimulating schema migration...');
    
    // In a real migration, we would:
    // 1. Create a new table with the enhanced schema
    // 2. Copy data from the old table to the new table
    // 3. Rename tables to complete the migration
    
    // For this test, we'll just transform the data in memory
    const migratedHours: EnhancedOperatingHoursRecord[] = existingHours.map(hour => {
      // Clean up any time format issues (remove seconds if present)
      const cleanOpenTime = hour.openTime.split(':').slice(0, 2).join(':');
      const cleanCloseTime = hour.closeTime.split(':').slice(0, 2).join(':');
      
      return {
        ...hour,
        openTime: cleanOpenTime,
        closeTime: cleanCloseTime,
        timezone: LATVIA_TIMEZONE,
        useLocalTime: false
      };
    });
    
    // 3. Validate the migrated data
    console.log('\nValidating migrated data...');
    
    // Check for time format consistency
    const timeFormatIssues = migratedHours.filter(
      hour => !hour.openTime.match(/^\d{1,2}:\d{2}$/) || !hour.closeTime.match(/^\d{1,2}:\d{2}$/)
    );
    
    if (timeFormatIssues.length > 0) {
      console.log(`Found ${timeFormatIssues.length} records with time format issues after migration`);
      timeFormatIssues.forEach(issue => {
        console.log(`  Day ${issue.dayOfWeek}: Open=${issue.openTime}, Close=${issue.closeTime}`);
      });
    } else {
      console.log('Time format validation passed: All records have consistent HH:MM format');
    }
    
    // Check for timezone field
    const timezoneIssues = migratedHours.filter(hour => !hour.timezone || hour.timezone !== LATVIA_TIMEZONE);
    
    if (timezoneIssues.length > 0) {
      console.log(`Found ${timezoneIssues.length} records with timezone issues after migration`);
    } else {
      console.log('Timezone validation passed: All records have the correct timezone');
    }
    
    // Check coverage of all days of week
    const daysCovered = new Set(migratedHours.map(hour => hour.dayOfWeek));
    const missingDays = [];
    
    for (let day = 0; day <= 6; day++) {
      if (!daysCovered.has(day)) {
        missingDays.push(day);
      }
    }
    
    if (missingDays.length > 0) {
      console.log(`Warning: Missing operating hours for ${missingDays.length} days: ${missingDays.join(', ')}`);
    } else {
      console.log('Day coverage validation passed: All days of the week are covered');
    }
    
    // 4. Print migration summary
    console.log('\n=====================================================');
    console.log('MIGRATION SIMULATION SUMMARY');
    console.log('=====================================================\n');
    
    console.log('Original operating hours:');
    existingHours.forEach(hour => {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hour.dayOfWeek];
      console.log(`  ${dayName}: ${hour.isClosed ? 'CLOSED' : `${hour.openTime} - ${hour.closeTime}`}`);
    });
    
    console.log('\nMigrated operating hours:');
    migratedHours.forEach(hour => {
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][hour.dayOfWeek];
      console.log(`  ${dayName}: ${hour.isClosed ? 'CLOSED' : `${hour.openTime} - ${hour.closeTime}`} (${hour.timezone})`);
    });
    
    console.log('\nMigration test completed successfully!');
    
    // 5. Output SQL migration script (commented out for safety)
    console.log('\n=====================================================');
    console.log('MIGRATION SQL SCRIPT (EXAMPLE ONLY - DO NOT RUN IN PRODUCTION)');
    console.log('=====================================================\n');
    
    console.log('-- Step 1: Create new table with enhanced schema');
    console.log(`CREATE TABLE operating_hours_new (
  id SERIAL PRIMARY KEY,
  day_of_week INTEGER NOT NULL,
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Riga',
  use_local_time BOOLEAN NOT NULL DEFAULT FALSE
);`);
    
    console.log('\n-- Step 2: Migrate data from old table to new table');
    console.log(`INSERT INTO operating_hours_new (id, day_of_week, open_time, close_time, is_closed, timezone, use_local_time)
SELECT 
  id, 
  day_of_week, 
  -- Clean up time format (remove seconds if present)
  CASE 
    WHEN open_time LIKE '%:%:%' THEN substring(open_time from 1 for 5)
    ELSE open_time
  END as open_time,
  CASE 
    WHEN close_time LIKE '%:%:%' THEN substring(close_time from 1 for 5)
    ELSE close_time
  END as close_time,
  is_closed,
  'Europe/Riga' as timezone,
  FALSE as use_local_time
FROM operating_hours;`);
    
    console.log('\n-- Step 3: Rename tables to complete migration');
    console.log(`ALTER TABLE operating_hours RENAME TO operating_hours_old;
ALTER TABLE operating_hours_new RENAME TO operating_hours;`);
    
    console.log('\n-- Step 4: Create an index on day_of_week for performance');
    console.log(`CREATE INDEX idx_operating_hours_day_of_week ON operating_hours(day_of_week);`);
    
    console.log('\n-- Step 5 (Optional): Drop old table when confident about migration');
    console.log(`-- DROP TABLE operating_hours_old;`);
    
    await pool.end();
    
  } catch (error) {
    console.error('Error during migration test:', error);
    await pool.end();
  }
}

// Run the migration test
testOperatingHoursMigration();