/**
 * Timezone Utility Test Script
 * 
 * This script tests the timezone conversion functions to ensure they 
 * correctly handle different date/time scenarios, including DST transitions.
 */

import { 
  toLatviaTime,
  fromLatviaTime,
  formatInLatviaTime,
  validateDate,
  getLatviaISOString,
  isWithinLatviaBusinessHours,
  getLatviaDayStart,
  getLatviaDayEnd,
  LATVIA_TIMEZONE
} from '../server/utils/timezone';

// Test utilities
function testHeader(title: string) {
  console.log("\n\n" + "=".repeat(80));
  console.log(`TEST: ${title}`);
  console.log("=".repeat(80));
}

function assertEqualDates(actual: Date, expected: Date, message: string) {
  const actualTime = actual.getTime();
  const expectedTime = expected.getTime();
  const result = actualTime === expectedTime;
  
  console.log(`${result ? '✓' : '✗'} ${message}`);
  if (!result) {
    console.log(`  Expected: ${expected.toISOString()} (${expected.getTime()})`);
    console.log(`  Actual:   ${actual.toISOString()} (${actual.getTime()})`);
  }
  
  return result;
}

function runAllTests() {
  console.log("TIMEZONE UTILITY TESTS");
  console.log("======================");
  
  // Test basic timezone conversions
  testHeader("Basic Timezone Conversions");
  
  // Create test date: 2025-05-03T12:00:00Z (UTC noon)
  const utcNoon = new Date(Date.UTC(2025, 4, 3, 12, 0, 0));
  console.log(`Test Date (UTC):     ${utcNoon.toISOString()}`);
  
  // Convert UTC noon to Latvia time
  const latviaTime = toLatviaTime(utcNoon);
  // Latvia is UTC+3 in summer (EEST), so this should be 15:00
  console.log(`Latvia Time:         ${latviaTime.toISOString()}`);
  console.log(`Latvia Hour:         ${latviaTime.getHours()}`);
  
  // Convert Latvia time back to UTC
  const backToUtc = fromLatviaTime(latviaTime);
  console.log(`Back to UTC:         ${backToUtc.toISOString()}`);
  
  // Verify round-trip conversion
  assertEqualDates(backToUtc, utcNoon, "Round-trip Latvia conversion preserves time");
  
  // Test date formatting
  testHeader("Date Formatting");
  
  const formattedLatviaTime = formatInLatviaTime(utcNoon, 'yyyy-MM-dd HH:mm:ss');
  console.log(`Formatted Latvia time: ${formattedLatviaTime}`);
  // Should be "2025-05-03 15:00:00" since Latvia is UTC+3 in summer
  
  // Test date validation
  testHeader("Date Validation");
  
  console.log(`Valid date: ${validateDate('2025-05-03')}`);
  console.log(`Invalid date: ${validateDate('not-a-date')}`);
  console.log(`Date with min/max: ${validateDate('2025-05-03', new Date(2025, 0, 1), new Date(2025, 11, 31))}`);
  console.log(`Date outside range: ${validateDate('2025-05-03', new Date(2026, 0, 1), new Date(2026, 11, 31))}`);
  
  // Test business hours check
  testHeader("Business Hours Check");
  
  const businessHoursTest = new Date(Date.UTC(2025, 4, 3, 11, 0, 0)); // 11:00 UTC, 14:00 Latvia
  console.log(`Business hours (14:00 Latvia): ${isWithinLatviaBusinessHours(businessHoursTest)}`);
  
  const afterHoursTest = new Date(Date.UTC(2025, 4, 3, 20, 0, 0)); // 20:00 UTC, 23:00 Latvia
  console.log(`Business hours (23:00 Latvia): ${isWithinLatviaBusinessHours(afterHoursTest)}`);
  
  // Test day boundaries
  testHeader("Day Boundaries");
  
  const dayStart = getLatviaDayStart(utcNoon);
  console.log(`Day start: ${dayStart.toISOString()}`);
  console.log(`Local time: ${formatInLatviaTime(dayStart, 'yyyy-MM-dd HH:mm:ss')}`);
  
  const dayEnd = getLatviaDayEnd(utcNoon);
  console.log(`Day end: ${dayEnd.toISOString()}`);
  console.log(`Local time: ${formatInLatviaTime(dayEnd, 'yyyy-MM-dd HH:mm:ss')}`);
  
  // Test DST transition dates
  testHeader("DST Transition Handling");
  
  // Spring forward (March)
  const springForward = new Date(Date.UTC(2025, 2, 30, 0, 30, 0)); // Just after DST change
  console.log(`Spring DST (UTC):    ${springForward.toISOString()}`);
  console.log(`Spring DST (Latvia): ${formatInLatviaTime(springForward, 'yyyy-MM-dd HH:mm:ss')}`);
  
  // Fall back (October)
  const fallBack = new Date(Date.UTC(2025, 9, 26, 0, 30, 0)); // Just after DST change
  console.log(`Fall DST (UTC):      ${fallBack.toISOString()}`);
  console.log(`Fall DST (Latvia):   ${formatInLatviaTime(fallBack, 'yyyy-MM-dd HH:mm:ss')}`);
  
  // Test the ambiguous hour during fall back
  const ambiguousHour1 = new Date(Date.UTC(2025, 9, 26, 0, 0, 0)); // First 2:00 Latvia time
  const ambiguousHour2 = new Date(Date.UTC(2025, 9, 26, 1, 0, 0)); // Second 2:00 Latvia time
  
  console.log(`Ambiguous hour 1 (Latvia): ${formatInLatviaTime(ambiguousHour1, 'yyyy-MM-dd HH:mm:ss')}`);
  console.log(`Ambiguous hour 2 (Latvia): ${formatInLatviaTime(ambiguousHour2, 'yyyy-MM-dd HH:mm:ss')}`);
}

// Run all the tests
runAllTests();