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
  
  // Use formatInLatviaTime directly on the UTC time (this is normally how it would be used)
  console.log(`Formatted Latvia:    ${formatInLatviaTime(utcNoon, 'yyyy-MM-dd HH:mm:ss.SSS')}`);
  
  // Let's try a direct conversion approach
  console.log("\nTrying direct approach:");
  // When we have a Latvia time (15:00), we want to get back to UTC (12:00)
  // We know Latvia is UTC+3 in summer, so we need to extract the time components
  // and create a new UTC date
  const latviaFormatted = formatInLatviaTime(latviaTime, 'yyyy-MM-dd HH:mm:ss.SSS');
  console.log(`Latvia time formatted: ${latviaFormatted}`);
  
  // Parse the formatted time
  const parts = latviaFormatted.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  
  if (parts) {
    // Create a UTC date with the same time components
    const utcFromParts = new Date(Date.UTC(
      parseInt(parts[1]),
      parseInt(parts[2]) - 1,
      parseInt(parts[3]),
      parseInt(parts[4]),
      parseInt(parts[5]),
      parseInt(parts[6]),
      parseInt(parts[7])
    ));
    console.log(`UTC from parts:    ${utcFromParts.toISOString()}`);
    
    // For debugging: subtract 3 hours (Latvia offset in summer)
    const manualAdjust = new Date(utcFromParts.getTime() - 3 * 60 * 60 * 1000);
    console.log(`Manual adjust:     ${manualAdjust.toISOString()}`);
    
    // Compare with original
    assertEqualDates(manualAdjust, utcNoon, "Manual conversion preserves time");
  }
  
  console.log("\nReal-world usage test:");
  console.log("===================");
  
  // 1. We have a UTC time in the database
  console.log(`Starting with UTC time: ${utcNoon.toISOString()}`);
  
  // 2. We format it in Latvia time for display
  const displayTime = formatInLatviaTime(utcNoon, 'yyyy-MM-dd HH:mm:ss');
  console.log(`Displayed to user in Latvia time: ${displayTime}`);
  
  // 3. Let's simulate what happens when a form gets submitted with these values
  // The user has selected 2025-05-03 15:00:00 in Latvia time
  
  // 4. We'd receive these as string inputs in a form submission
  const dateInput = "2025-05-03";
  const timeInput = "15:00:00";
  console.log(`User submits: date=${dateInput}, time=${timeInput}`);
  
  // 5. We'd parse and combine them 
  const [yearStr, monthStr, dayStr] = dateInput.split('-');
  const [hourStr, minuteStr, secondStr] = timeInput.split(':');
  
  // 6. Create a "fake" UTC date with these components (this is what APIs often get)
  const fakeUtcComponents = new Date(
    Date.UTC(
      parseInt(yearStr),
      parseInt(monthStr) - 1,
      parseInt(dayStr),
      parseInt(hourStr),
      parseInt(minuteStr),
      parseInt(secondStr || '0')
    )
  );
  console.log(`Created Date object with Latvia components as if UTC: ${fakeUtcComponents.toISOString()}`);
  
  // 7. But these components are actually Latvia time, so we need to convert them to real UTC
  // We can do this by subtracting the Latvia timezone offset (3 hours in summer)
  const latviaOffsetMs = 3 * 60 * 60 * 1000; // 3 hours in milliseconds in summer
  const manualUtc = new Date(fakeUtcComponents.getTime() - latviaOffsetMs);
  console.log(`Manually converted to real UTC: ${manualUtc.toISOString()}`);
  
  // 8. Now let's use our function for the same conversion
  // Convert back to UTC using our library function
  const backToUtc = fromLatviaTime(displayTime);
  console.log(`Library converted to UTC: ${backToUtc.toISOString()}`);
  
  // 9. Verify the manual and library approaches match
  console.log(`Manual vs Library: ${manualUtc.getTime() === backToUtc.getTime() ? 'MATCH!' : 'Different'}`);
  
  // 10. Verify round-trip conversion back to original UTC time
  assertEqualDates(manualUtc, utcNoon, "Manual round-trip conversion preserves time");
  assertEqualDates(backToUtc, utcNoon, "Library round-trip conversion preserves time");
  
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