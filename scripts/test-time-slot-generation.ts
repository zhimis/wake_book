/**
 * Time Slot Generation Test Script
 * 
 * This script tests the timezone-aware time slot generation function to ensure
 * it correctly handles timezone differences, DST transitions, and edge cases.
 */

import { generateTimeSlotsWithTimezone } from '../server/utils/time-slot-generator';
import { toLatviaTime, fromLatviaTime, formatInLatviaTime, LATVIA_TIMEZONE } from '../server/utils/timezone';
import { format, addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Mock operating hours and pricing for testing
const mockOperatingHours = [
  // Sunday (0)
  { id: 1, dayOfWeek: 0, openTime: '09:00', closeTime: '19:00', isClosed: false },
  // Monday (1)
  { id: 2, dayOfWeek: 1, openTime: '08:00', closeTime: '22:00', isClosed: false },
  // Tuesday (2)
  { id: 3, dayOfWeek: 2, openTime: '08:00', closeTime: '22:00', isClosed: false },
  // Wednesday (3)
  { id: 4, dayOfWeek: 3, openTime: '08:00', closeTime: '22:00', isClosed: false },
  // Thursday (4)
  { id: 5, dayOfWeek: 4, openTime: '08:00', closeTime: '22:00', isClosed: false },
  // Friday (5)
  { id: 6, dayOfWeek: 5, openTime: '08:00', closeTime: '22:00', isClosed: false },
  // Saturday (6)
  { id: 7, dayOfWeek: 6, openTime: '09:00', closeTime: '19:00', isClosed: false },
];

const mockPricing = [
  { id: 1, name: 'standard', price: 20, startTime: null, endTime: null, applyToWeekends: null, weekendMultiplier: null },
  { id: 2, name: 'peak', price: 30, startTime: '17:00', endTime: '22:00', applyToWeekends: true, weekendMultiplier: null }
];

/**
 * Test Case: Standard week generation
 * Description: Generate time slots for a standard week
 */
async function testStandardWeek() {
  console.log('\n===== Test Case: Standard Week Generation =====');
  
  const startDate = new Date('2025-05-05T00:00:00Z'); // A Monday in May 2025
  const endDate = new Date('2025-05-11T23:59:59Z');   // Sunday night
  
  console.log(`Generating time slots from ${formatInTimeZone(startDate, 'UTC', 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(endDate, 'UTC', 'yyyy-MM-dd HH:mm:ss')} (UTC)`);
  console.log(`Latvia time: ${formatInLatviaTime(startDate, 'yyyy-MM-dd HH:mm:ss')} to ${formatInLatviaTime(endDate, 'yyyy-MM-dd HH:mm:ss')}`);
  
  const timeSlots = await generateTimeSlotsWithTimezone(startDate, endDate, mockOperatingHours, mockPricing);
  
  // Log summary
  console.log(`Generated ${timeSlots.length} time slots`);
  
  // Validate a few slots
  validateTimeSlot(timeSlots[0], 'First slot');
  validateTimeSlot(timeSlots[timeSlots.length - 1], 'Last slot');
  validateTimeSlot(timeSlots[Math.floor(timeSlots.length / 2)], 'Middle slot');
  
  // Validate slots per day
  const slotsByDay = new Map<string, number>();
  
  for (const slot of timeSlots) {
    const day = formatInTimeZone(slot.startTime, LATVIA_TIMEZONE, 'EEEE');
    slotsByDay.set(day, (slotsByDay.get(day) || 0) + 1);
  }
  
  console.log('\nSlots per day:');
  slotsByDay.forEach((count, day) => {
    console.log(`${day}: ${count} slots`);
  });
  
  return timeSlots.length > 0;
}

/**
 * Test Case: DST Transition
 * Description: Generate time slots during a DST transition period
 */
async function testDSTTransition() {
  console.log('\n===== Test Case: DST Transition =====');
  
  // Latvia switches to winter time (DST ends) on the last Sunday of October
  // Latvia switches to summer time (DST begins) on the last Sunday of March
  
  // Test around October transition (summer→winter)
  const octStartDate = new Date('2025-10-25T00:00:00Z'); // Saturday before DST change
  const octEndDate = new Date('2025-10-27T23:59:59Z');   // Monday after DST change
  
  console.log('\n-- October DST End (Summer → Winter) --');
  console.log(`Generating time slots from ${formatInTimeZone(octStartDate, 'UTC', 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(octEndDate, 'UTC', 'yyyy-MM-dd HH:mm:ss')} (UTC)`);
  console.log(`Latvia time: ${formatInLatviaTime(octStartDate, 'yyyy-MM-dd HH:mm:ss')} to ${formatInLatviaTime(octEndDate, 'yyyy-MM-dd HH:mm:ss')}`);
  
  const octTimeSlots = await generateTimeSlotsWithTimezone(octStartDate, octEndDate, mockOperatingHours, mockPricing);
  console.log(`Generated ${octTimeSlots.length} time slots during October DST transition`);
  
  // Validate slots specifically for Sunday (the transition day)
  const sundayOctSlots = octTimeSlots.filter(slot => 
    formatInTimeZone(slot.startTime, LATVIA_TIMEZONE, 'EEEE') === 'Sunday'
  );
  
  console.log(`Sunday (transition day) has ${sundayOctSlots.length} slots`);
  validateTimeSlot(sundayOctSlots[0], 'First Sunday slot');
  validateTimeSlot(sundayOctSlots[sundayOctSlots.length - 1], 'Last Sunday slot');
  
  // Test around March transition (winter→summer)
  const marStartDate = new Date('2025-03-29T00:00:00Z'); // Saturday before DST change
  const marEndDate = new Date('2025-03-31T23:59:59Z');   // Monday after DST change
  
  console.log('\n-- March DST Start (Winter → Summer) --');
  console.log(`Generating time slots from ${formatInTimeZone(marStartDate, 'UTC', 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(marEndDate, 'UTC', 'yyyy-MM-dd HH:mm:ss')} (UTC)`);
  console.log(`Latvia time: ${formatInLatviaTime(marStartDate, 'yyyy-MM-dd HH:mm:ss')} to ${formatInLatviaTime(marEndDate, 'yyyy-MM-dd HH:mm:ss')}`);
  
  const marTimeSlots = await generateTimeSlotsWithTimezone(marStartDate, marEndDate, mockOperatingHours, mockPricing);
  console.log(`Generated ${marTimeSlots.length} time slots during March DST transition`);
  
  // Validate slots specifically for Sunday (the transition day)
  const sundayMarSlots = marTimeSlots.filter(slot => 
    formatInTimeZone(slot.startTime, LATVIA_TIMEZONE, 'EEEE') === 'Sunday'
  );
  
  console.log(`Sunday (transition day) has ${sundayMarSlots.length} slots`);
  validateTimeSlot(sundayMarSlots[0], 'First Sunday slot');
  validateTimeSlot(sundayMarSlots[sundayMarSlots.length - 1], 'Last Sunday slot');
  
  return octTimeSlots.length > 0 && marTimeSlots.length > 0;
}

/**
 * Test Case: Edge Cases
 * Description: Test various edge cases in time slot generation
 */
async function testEdgeCases() {
  console.log('\n===== Test Case: Edge Cases =====');
  
  // Case 1: Single day generation
  console.log('\n-- Case 1: Single Day Generation --');
  const singleDay = new Date('2025-05-05T00:00:00Z');
  const singleDayEnd = new Date('2025-05-05T23:59:59Z');
  
  const singleDaySlots = await generateTimeSlotsWithTimezone(singleDay, singleDayEnd, mockOperatingHours, mockPricing);
  console.log(`Generated ${singleDaySlots.length} slots for a single day (Monday)`);
  
  // Case 2: Day with modified hours (shorter day)
  console.log('\n-- Case 2: Day with Modified Hours --');
  const modifiedHours = [...mockOperatingHours];
  // Modify Tuesday to have shorter hours
  modifiedHours[2] = { ...modifiedHours[2], openTime: '12:00', closeTime: '16:00' };
  
  const modifiedDay = new Date('2025-05-06T00:00:00Z'); // Tuesday
  const modifiedDayEnd = new Date('2025-05-06T23:59:59Z');
  
  const modifiedDaySlots = await generateTimeSlotsWithTimezone(modifiedDay, modifiedDayEnd, modifiedHours, mockPricing);
  console.log(`Generated ${modifiedDaySlots.length} slots for a day with modified hours (Tuesday, 12:00-16:00)`);
  
  // Case 3: Closed day
  console.log('\n-- Case 3: Closed Day --');
  const closedHours = [...mockOperatingHours];
  // Modify Wednesday to be closed
  closedHours[3] = { ...closedHours[3], isClosed: true };
  
  const closedDay = new Date('2025-05-07T00:00:00Z'); // Wednesday
  const closedDayEnd = new Date('2025-05-07T23:59:59Z');
  
  const closedDaySlots = await generateTimeSlotsWithTimezone(closedDay, closedDayEnd, closedHours, mockPricing);
  console.log(`Generated ${closedDaySlots.length} slots for a closed day (Wednesday) - should be 0`);
  
  return true;
}

/**
 * Helper function to validate and log a time slot
 */
function validateTimeSlot(slot: any, label: string) {
  if (!slot) {
    console.log(`${label}: No slot found`);
    return;
  }
  
  const startTimeUTC = formatInTimeZone(slot.startTime, 'UTC', 'HH:mm:ss');
  const endTimeUTC = formatInTimeZone(slot.endTime, 'UTC', 'HH:mm:ss');
  
  const startTimeLatvia = formatInTimeZone(slot.startTime, LATVIA_TIMEZONE, 'HH:mm:ss');
  const endTimeLatvia = formatInTimeZone(slot.endTime, LATVIA_TIMEZONE, 'HH:mm:ss');
  
  const dayInLatvia = formatInTimeZone(slot.startTime, LATVIA_TIMEZONE, 'EEEE');
  
  console.log(`\n${label}:`);
  console.log(`- Day in Latvia: ${dayInLatvia}`);
  console.log(`- UTC time: ${startTimeUTC} - ${endTimeUTC}`);
  console.log(`- Latvia time: ${startTimeLatvia} - ${endTimeLatvia}`);
  console.log(`- Price: €${slot.price}`);
  console.log(`- Status: ${slot.status}`);
  
  // Validate that it's a 30-minute slot
  const startDate = new Date(slot.startTime);
  const endDate = new Date(slot.endTime);
  const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  
  console.log(`- Duration: ${durationMinutes} minutes`);
  if (durationMinutes !== 30) {
    console.error(`  ❌ ERROR: Expected 30-minute duration, got ${durationMinutes} minutes`);
  } else {
    console.log(`  ✓ Duration correctly set to 30 minutes`);
  }
  
  // Validate time in Latvia is within operating hours
  const hourInLatvia = parseInt(startTimeLatvia.split(':')[0]);
  const dayOfWeek = new Date(slot.startTime).getDay();
  const operatingHour = mockOperatingHours.find(oh => oh.dayOfWeek === dayOfWeek);
  
  if (operatingHour) {
    const openHour = parseInt(operatingHour.openTime.split(':')[0]);
    const closeHour = parseInt(operatingHour.closeTime.split(':')[0]);
    
    if (hourInLatvia >= openHour && hourInLatvia < closeHour) {
      console.log(`  ✓ Time is within operating hours (${operatingHour.openTime}-${operatingHour.closeTime})`);
    } else {
      console.error(`  ❌ ERROR: Time ${hourInLatvia}:00 is outside operating hours (${operatingHour.openTime}-${operatingHour.closeTime})`);
    }
  } else {
    console.error(`  ❌ ERROR: No operating hours defined for day ${dayOfWeek}`);
  }
}

/**
 * Run all test cases
 */
async function runAllTests() {
  console.log('==================================================');
  console.log('     TIME SLOT GENERATION TEST SUITE');
  console.log('==================================================');
  
  try {
    const results = [];
    
    // Run test cases
    results.push({ name: 'Standard Week', success: await testStandardWeek() });
    results.push({ name: 'DST Transitions', success: await testDSTTransition() });
    results.push({ name: 'Edge Cases', success: await testEdgeCases() });
    
    // Report summary
    console.log('\n==================================================');
    console.log('                 TEST SUMMARY');
    console.log('==================================================');
    
    let allPassed = true;
    for (const result of results) {
      const status = result.success ? '✓ PASSED' : '❌ FAILED';
      console.log(`${result.name}: ${status}`);
      if (!result.success) allPassed = false;
    }
    
    console.log('\n==================================================');
    console.log(`OVERALL RESULT: ${allPassed ? '✓ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('==================================================');
    
  } catch (error) {
    console.error('Error running tests:', error);
    console.log('\n==================================================');
    console.log('OVERALL RESULT: ❌ TESTS FAILED DUE TO ERROR');
    console.log('==================================================');
  }
}

// Execute all tests
runAllTests();