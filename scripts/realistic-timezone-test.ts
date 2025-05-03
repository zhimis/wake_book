/**
 * Realistic Timezone Test Script
 * 
 * This script simulates a more realistic timezone conversion scenario
 * where a user in a different timezone books a timeslot in Latvia time.
 */

import { 
  formatInTimeZone,
  toZonedTime 
} from 'date-fns-tz';

const LATVIA_TIMEZONE = 'Europe/Riga';

// Simulate a real booking scenario

// 1. Server stores timeslot in UTC
console.log("SIMULATING REALISTIC BOOKING FLOW");
console.log("=================================\n");

// Timeslot at 15:00 Latvia time (12:00 UTC in summer)
const timeslotUTC = new Date(Date.UTC(2025, 4, 3, 12, 0, 0));
console.log(`Original timeslot in database (UTC): ${timeslotUTC.toISOString()}`);

// 2. Convert to Latvia time for display
const latviaTime = formatInTimeZone(timeslotUTC, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
console.log(`Formatted for display in Latvia time: ${latviaTime}`);

// 3. When booking, we need to go from this Latvia time back to UTC for storage
// Let's parse the Latvia time string as if it came from a form
const [datePart, timePart] = latviaTime.split(' ');
const [year, month, day] = datePart.split('-').map(Number);
const [hour, minute, second] = timePart.split(':').map(Number);

// 4. Create a new Date from these components
// Two options:

// Option A: Create directly (will be interpreted in local timezone)
const localDate = new Date(year, month - 1, day, hour, minute, second);
console.log(`\nOption A: Create date directly (interpreted in local timezone)`);
console.log(`Parsed date: ${localDate.toISOString()}`);

// To convert this to UTC, we need to:
// First create a date with same components in UTC
const utcComponents = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
console.log(`Date with components as UTC: ${utcComponents.toISOString()}`);

// Then subtract the Latvia timezone offset (UTC+3 in summer)
const latviaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
const convertedToUTC = new Date(utcComponents.getTime() - latviaOffset);
console.log(`Converted back to UTC: ${convertedToUTC.toISOString()}`);

// Compare with original
const match = convertedToUTC.getTime() === timeslotUTC.getTime();
console.log(`\nRoundtrip conversion ${match ? 'SUCCESSFUL' : 'FAILED'}`);
console.log(`Original:  ${timeslotUTC.toISOString()}`);
console.log(`Converted: ${convertedToUTC.toISOString()}`);

// Option B: Use date-fns-tz parseZonedTime (if available)

// 5. DST Handling test - create a date during DST transition
console.log("\n\nDST TRANSITION TESTS");
console.log("===================\n");

// Before DST spring transition
const beforeSpringDST = new Date(Date.UTC(2025, 2, 29, 23, 0, 0)); // March 29, 2025, 23:00 UTC
console.log(`Before Spring DST (UTC): ${beforeSpringDST.toISOString()}`);
console.log(`Before Spring DST (Latvia): ${formatInTimeZone(beforeSpringDST, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`);

// After DST spring transition
const afterSpringDST = new Date(Date.UTC(2025, 2, 30, 1, 0, 0)); // March 30, 2025, 01:00 UTC
console.log(`After Spring DST (UTC): ${afterSpringDST.toISOString()}`);
console.log(`After Spring DST (Latvia): ${formatInTimeZone(afterSpringDST, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`);

// Before DST fall transition
const beforeFallDST = new Date(Date.UTC(2025, 9, 25, 23, 0, 0)); // October 25, 2025, 23:00 UTC
console.log(`Before Fall DST (UTC): ${beforeFallDST.toISOString()}`);
console.log(`Before Fall DST (Latvia): ${formatInTimeZone(beforeFallDST, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`);

// After DST fall transition
const afterFallDST = new Date(Date.UTC(2025, 9, 26, 1, 0, 0)); // October 26, 2025, 01:00 UTC
console.log(`After Fall DST (UTC): ${afterFallDST.toISOString()}`);
console.log(`After Fall DST (Latvia): ${formatInTimeZone(afterFallDST, LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm:ss')}`);

console.log("\nRECOMMENDATION:");
console.log("For booking systems, always store dates in UTC in the database");
console.log("Display times using formatInTimeZone with Latvia timezone");
console.log("When converting user input back to UTC, use the approach demonstrated in Option A");
console.log("This works because the timezone offset is known for Latvia at a given time");