/**
 * Database Timezone Consistency Analysis Tool
 * 
 * This script analyzes existing time slot data in the database to check for
 * timezone-related inconsistencies and report on them for planning migration.
 */

import { db, pool } from "../server/db";
import { timeSlots, bookings, bookingTimeSlots, operatingHours } from "../shared/schema";
import { formatInTimeZone } from "date-fns-tz";
import { format, isValid, parseISO } from "date-fns";
import { eq, and, gte, lte } from "drizzle-orm";
import { toLatviaTime, fromLatviaTime, LATVIA_TIMEZONE } from "../server/utils/timezone";

// Types to track issues
interface TimeSlotIssue {
  id: number;
  startTime: Date;
  endTime: Date;
  issue: string;
  details: string;
}

interface OperatingHoursIssue {
  id: number;
  dayOfWeek: number;
  issue: string;
  details: string;
}

interface BookingIssue {
  id: number;
  reference: string;
  createdAt: Date;
  issue: string;
  details: string;
}

// Main analysis function
async function analyzeTimeSlotData() {
  console.log('\n=====================================================');
  console.log('DATABASE TIMEZONE CONSISTENCY ANALYSIS');
  console.log('=====================================================\n');
  
  // Track issues
  const timeSlotIssues: TimeSlotIssue[] = [];
  const operatingHoursIssues: OperatingHoursIssue[] = [];
  const bookingIssues: BookingIssue[] = [];
  
  try {
    // 1. Fetch all records
    const allTimeSlots = await db.select().from(timeSlots);
    const allBookingRecords = await db.select().from(bookings);
    const allOperatingHours = await db.select().from(operatingHours);
    
    console.log(`Found ${allTimeSlots.length} time slots`);
    console.log(`Found ${allBookingRecords.length} bookings`);
    console.log(`Found ${allOperatingHours.length} operating hours records\n`);
    
    // 2. Analyze time slots
    console.log('Analyzing time slots for timezone issues...');
    
    for (const slot of allTimeSlots) {
      // Check if dates are valid
      if (!isValid(new Date(slot.startTime)) || !isValid(new Date(slot.endTime))) {
        timeSlotIssues.push({
          id: slot.id,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          issue: "Invalid date",
          details: `Start: ${slot.startTime}, End: ${slot.endTime}`
        });
        continue;
      }
      
      // Convert to Latvia timezone for checking
      const startInLatvia = toLatviaTime(slot.startTime);
      const endInLatvia = toLatviaTime(slot.endTime);
      
      // Check time slot duration (should be 30 minutes)
      const durationMinutes = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60);
      if (durationMinutes !== 30) {
        timeSlotIssues.push({
          id: slot.id,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          issue: "Incorrect duration",
          details: `Duration: ${durationMinutes} minutes (should be 30)`
        });
      }
      
      // Check if time slot is within operating hours
      const dayOfWeek = startInLatvia.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hourInLatvia = startInLatvia.getHours();
      const minuteInLatvia = startInLatvia.getMinutes();
      
      // Get operating hours for this day
      const [dayOperatingHours] = await db.select()
        .from(operatingHours)
        .where(eq(operatingHours.dayOfWeek, dayOfWeek));
      
      if (dayOperatingHours) {
        if (dayOperatingHours.isClosed) {
          timeSlotIssues.push({
            id: slot.id,
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
            issue: "Slot on closed day",
            details: `Day ${dayOfWeek} (${getDayName(dayOfWeek)}) is marked as closed`
          });
        } else {
          // Check if slot is within operating hours
          const [openHour, openMinute] = dayOperatingHours.openTime.split(':').map(Number);
          const [closeHour, closeMinute] = dayOperatingHours.closeTime.split(':').map(Number);
          
          const isBeforeOpening = hourInLatvia < openHour || (hourInLatvia === openHour && minuteInLatvia < openMinute);
          const isAfterClosing = hourInLatvia >= closeHour;
          
          if (isBeforeOpening || isAfterClosing) {
            timeSlotIssues.push({
              id: slot.id,
              startTime: new Date(slot.startTime),
              endTime: new Date(slot.endTime),
              issue: "Outside operating hours",
              details: `Time ${formatInTimeZone(startInLatvia, LATVIA_TIMEZONE, 'HH:mm')} is outside operating hours (${dayOperatingHours.openTime}-${dayOperatingHours.closeTime})`
            });
          }
        }
      } else {
        timeSlotIssues.push({
          id: slot.id,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          issue: "No operating hours",
          details: `No operating hours defined for day ${dayOfWeek} (${getDayName(dayOfWeek)})`
        });
      }
    }
    
    // 3. Analyze operating hours
    console.log('Analyzing operating hours for consistency...');
    
    // Check for duplicate days
    const daysCovered = new Set<number>();
    for (const oh of allOperatingHours) {
      if (daysCovered.has(oh.dayOfWeek)) {
        operatingHoursIssues.push({
          id: oh.id,
          dayOfWeek: oh.dayOfWeek,
          issue: "Duplicate day",
          details: `Multiple operating hours entries for day ${oh.dayOfWeek} (${getDayName(oh.dayOfWeek)})`
        });
      }
      daysCovered.add(oh.dayOfWeek);
      
      // Check for missing days (should have 0-6)
      for (let day = 0; day <= 6; day++) {
        if (!daysCovered.has(day)) {
          operatingHoursIssues.push({
            id: 0, // No ID as it's missing
            dayOfWeek: day,
            issue: "Missing day",
            details: `No operating hours defined for day ${day} (${getDayName(day)})`
          });
        }
      }
      
      // Check time format validity
      if (!oh.openTime.match(/^\d{1,2}:\d{2}$/) || !oh.closeTime.match(/^\d{1,2}:\d{2}$/)) {
        operatingHoursIssues.push({
          id: oh.id,
          dayOfWeek: oh.dayOfWeek,
          issue: "Invalid time format",
          details: `Open: ${oh.openTime}, Close: ${oh.closeTime}`
        });
      }
    }
    
    // 4. Analyze bookings and their time slots
    console.log('Analyzing bookings and their associated time slots...');
    
    for (const booking of allBookingRecords) {
      // Get this booking's time slots
      const bookingSlots = await db.select({
          timeSlot: timeSlots
        })
        .from(bookingTimeSlots)
        .innerJoin(timeSlots, eq(bookingTimeSlots.timeSlotId, timeSlots.id))
        .where(eq(bookingTimeSlots.bookingId, booking.id));
      
      if (bookingSlots.length === 0) {
        bookingIssues.push({
          id: booking.id,
          reference: booking.reference,
          createdAt: new Date(booking.createdAt),
          issue: "No time slots",
          details: `Booking has no associated time slots`
        });
        continue;
      }
      
      // Check if all slots have status "booked"
      for (const { timeSlot } of bookingSlots) {
        if (timeSlot.status !== "booked") {
          bookingIssues.push({
            id: booking.id,
            reference: booking.reference,
            createdAt: new Date(booking.createdAt),
            issue: "Incorrect slot status",
            details: `Time slot ${timeSlot.id} has status "${timeSlot.status}" instead of "booked"`
          });
        }
      }
      
      // Check if slots are contiguous (no gaps)
      const sortedSlots = bookingSlots
        .map(bs => bs.timeSlot)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      for (let i = 0; i < sortedSlots.length - 1; i++) {
        const currentEnd = new Date(sortedSlots[i].endTime).getTime();
        const nextStart = new Date(sortedSlots[i + 1].startTime).getTime();
        
        if (currentEnd !== nextStart) {
          bookingIssues.push({
            id: booking.id,
            reference: booking.reference,
            createdAt: new Date(booking.createdAt),
            issue: "Non-contiguous slots",
            details: `Gap between slots: ${formatInTimeZone(new Date(sortedSlots[i].endTime), LATVIA_TIMEZONE, 'HH:mm')} and ${formatInTimeZone(new Date(sortedSlots[i + 1].startTime), LATVIA_TIMEZONE, 'HH:mm')}`
          });
        }
      }
    }
    
    // Output summary
    console.log('\n=====================================================');
    console.log('ANALYSIS SUMMARY');
    console.log('=====================================================\n');
    
    console.log(`Found ${timeSlotIssues.length} time slot issues`);
    console.log(`Found ${operatingHoursIssues.length} operating hours issues`);
    console.log(`Found ${bookingIssues.length} booking issues\n`);
    
    // Output detailed issues if any are found
    if (timeSlotIssues.length > 0) {
      console.log('\n----- TIME SLOT ISSUES -----');
      for (const issue of timeSlotIssues.slice(0, 10)) { // Limit to first 10 for brevity
        console.log(`ID: ${issue.id}, Issue: ${issue.issue}`);
        console.log(`Time: ${formatInTimeZone(new Date(issue.startTime), LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm')} - ${formatInTimeZone(new Date(issue.endTime), LATVIA_TIMEZONE, 'HH:mm')} (Latvia time)`);
        console.log(`Details: ${issue.details}\n`);
      }
      
      if (timeSlotIssues.length > 10) {
        console.log(`... and ${timeSlotIssues.length - 10} more issues (showing first 10 only)`);
      }
    }
    
    if (operatingHoursIssues.length > 0) {
      console.log('\n----- OPERATING HOURS ISSUES -----');
      for (const issue of operatingHoursIssues) {
        console.log(`ID: ${issue.id}, Day: ${issue.dayOfWeek} (${getDayName(issue.dayOfWeek)})`);
        console.log(`Issue: ${issue.issue}`);
        console.log(`Details: ${issue.details}\n`);
      }
    }
    
    if (bookingIssues.length > 0) {
      console.log('\n----- BOOKING ISSUES -----');
      for (const issue of bookingIssues.slice(0, 10)) { // Limit to first 10 for brevity
        console.log(`ID: ${issue.id}, Reference: ${issue.reference}`);
        console.log(`Created: ${formatInTimeZone(new Date(issue.createdAt), LATVIA_TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
        console.log(`Issue: ${issue.issue}`);
        console.log(`Details: ${issue.details}\n`);
      }
      
      if (bookingIssues.length > 10) {
        console.log(`... and ${bookingIssues.length - 10} more issues (showing first 10 only)`);
      }
    }
    
    console.log('\n=====================================================');
    console.log('RECOMMENDATIONS FOR SCHEMA CHANGES');
    console.log('=====================================================\n');
    
    console.log('1. Add explicit timezone field to time slots table');
    console.log('   - This will help clarify which timezone the stored times are in (UTC)');
    console.log('   - Add a migrate function to standardize all times to UTC');
    console.log('   - Include validation to ensure all incoming times are consistently handled\n');
    
    console.log('2. Add timezone awareness to operating hours');
    console.log('   - Explicitly store that operating hours are in Latvia timezone');
    console.log('   - Consider adding a timezone override for special events\n');
    
    console.log('3. Add time formatting preferences to configurations');
    console.log('   - Store default display format (24h vs 12h)');
    console.log('   - Store whether to show timezone indicators');
    console.log('   - Store how to format dates (EU style vs US style)\n');
    
    console.log('4. Create database constraint for time slot duration');
    console.log('   - Ensure all time slots are exactly 30 minutes');
    console.log('   - Add validation to prevent incorrect durations\n');
    
    // Close database connection
    await pool.end();
    
  } catch (error) {
    console.error('Error analyzing database:', error);
    await pool.end();
  }
}

// Helper function to get day name
function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek] || 'Unknown';
}

// Run the analysis
analyzeTimeSlotData();