/**
 * Time Format Preferences Test Script
 * 
 * This script tests the creation and usage of the TimeFormatPreferences table
 * for storing application-wide time formatting settings.
 */

import { pool } from "../server/db";
import { formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";
import { LATVIA_TIMEZONE } from "../server/utils/timezone";

// Define the TimeFormatPreferences type
interface TimeFormatPreferences {
  id: number;
  use24HourFormat: boolean;
  showTimezoneIndicator: boolean;
  dateFormat: string;
  timeFormat: string;
  defaultTimezone: string;
}

async function testTimeFormatPreferences() {
  console.log('\n=====================================================');
  console.log('TIME FORMAT PREFERENCES TEST');
  console.log('=====================================================\n');
  
  try {
    // 1. Simulate creating the preferences table
    console.log('Simulating creation of time format preferences table...');
    
    // Default preferences for Latvia
    const defaultPreferences: Omit<TimeFormatPreferences, 'id'> = {
      use24HourFormat: true,
      showTimezoneIndicator: true,
      dateFormat: 'dd.MM.yyyy',
      timeFormat: 'HH:mm',
      defaultTimezone: LATVIA_TIMEZONE
    };
    
    console.log('Default preferences for Latvia:');
    console.log(JSON.stringify(defaultPreferences, null, 2));
    
    // 2. Test time formatting with different preferences
    console.log('\nTesting time formatting with different preferences...');
    
    const testDate = new Date('2025-05-03T14:30:00Z'); // Saturday, May 3rd, 2025, 14:30 UTC
    
    // Format with Latvia preferences (24-hour)
    const latviaFormatted = formatTime(testDate, {
      ...defaultPreferences,
      id: 1
    });
    console.log('Latvia format (24-hour):');
    console.log(`  Date: ${latviaFormatted.date}`);
    console.log(`  Time: ${latviaFormatted.time}`);
    console.log(`  Full: ${latviaFormatted.full}`);
    
    // Format with US preferences (12-hour)
    const usPreferences: TimeFormatPreferences = {
      id: 2,
      use24HourFormat: false,
      showTimezoneIndicator: true,
      dateFormat: 'MM/dd/yyyy',
      timeFormat: 'h:mm a',
      defaultTimezone: 'America/New_York'
    };
    
    const usFormatted = formatTime(testDate, usPreferences);
    console.log('\nUS format (12-hour):');
    console.log(`  Date: ${usFormatted.date}`);
    console.log(`  Time: ${usFormatted.time}`);
    console.log(`  Full: ${usFormatted.full}`);
    
    // Format with custom international preferences
    const internationalPreferences: TimeFormatPreferences = {
      id: 3,
      use24HourFormat: true,
      showTimezoneIndicator: true,
      dateFormat: 'yyyy-MM-dd',
      timeFormat: 'HH:mm',
      defaultTimezone: 'UTC'
    };
    
    const internationalFormatted = formatTime(testDate, internationalPreferences);
    console.log('\nInternational format (ISO-like):');
    console.log(`  Date: ${internationalFormatted.date}`);
    console.log(`  Time: ${internationalFormatted.time}`);
    console.log(`  Full: ${internationalFormatted.full}`);
    
    // 3. Output SQL creation script
    console.log('\n=====================================================');
    console.log('CREATION SQL SCRIPT');
    console.log('=====================================================\n');
    
    console.log('-- Step 1: Create the time format preferences table');
    console.log(`CREATE TABLE time_format_preferences (
  id SERIAL PRIMARY KEY,
  use_24_hour_format BOOLEAN NOT NULL DEFAULT true,
  show_timezone_indicator BOOLEAN NOT NULL DEFAULT true,
  date_format TEXT NOT NULL DEFAULT 'dd.MM.yyyy',
  time_format TEXT NOT NULL DEFAULT 'HH:mm',
  default_timezone TEXT NOT NULL DEFAULT 'Europe/Riga'
);`);
    
    console.log('\n-- Step 2: Insert default preferences for Latvia');
    console.log(`INSERT INTO time_format_preferences (
  use_24_hour_format, 
  show_timezone_indicator, 
  date_format, 
  time_format, 
  default_timezone
) VALUES (
  true, -- use24HourFormat (Latvia uses 24-hour clock)
  true, -- showTimezoneIndicator
  'dd.MM.yyyy', -- dateFormat (European style)
  'HH:mm', -- timeFormat (24-hour)
  'Europe/Riga' -- defaultTimezone (Latvia)
);`);
    
    await pool.end();
    
  } catch (error) {
    console.error('Error during test:', error);
    await pool.end();
  }
}

// Helper function to format a date according to preferences
function formatTime(date: Date, preferences: TimeFormatPreferences) {
  const { dateFormat, timeFormat, defaultTimezone, showTimezoneIndicator } = preferences;
  
  // Format the date and time according to preferences
  const formattedDate = formatInTimeZone(date, defaultTimezone, dateFormat);
  
  let formattedTime = formatInTimeZone(date, defaultTimezone, timeFormat);
  if (showTimezoneIndicator) {
    const zone = formatInTimeZone(date, defaultTimezone, 'zzz');
    formattedTime = `${formattedTime} ${zone}`;
  }
  
  // Full format (date + time)
  const fullFormat = `${dateFormat} ${timeFormat}${showTimezoneIndicator ? ' zzz' : ''}`;
  const formattedFull = formatInTimeZone(date, defaultTimezone, fullFormat);
  
  return {
    date: formattedDate,
    time: formattedTime,
    full: formattedFull
  };
}

// Run the test
testTimeFormatPreferences();