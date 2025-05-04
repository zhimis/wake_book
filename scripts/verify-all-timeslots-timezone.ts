/**
 * Final Verification Script for Timezone Implementation
 * 
 * This script performs a comprehensive validation of all time slots in the database:
 * 1. Verifies all time slots have the storageTimezone field set to UTC
 * 2. Validates time slot durations are all standard (30 minutes)
 * 3. Checks for any timezone inconsistencies or conversion issues
 */

import { db } from "../server/db";
import { timeSlots } from "../shared/schema";
import { analyzeTimeSlotTimezone, UTC_TIMEZONE } from "../server/utils/timezone";

async function verifyAllTimeSlots() {
  console.log("🔍 COMPREHENSIVE TIMEZONE IMPLEMENTATION VERIFICATION");
  console.log("==================================================");
  
  try {
    // Get total time slot count
    const countResult = await db.select({ count: timeSlots.id }).from(timeSlots);
    const totalTimeSlots = Number(countResult[0].count);
    
    console.log(`Found ${totalTimeSlots} time slots in the database\n`);

    // Get all time slots
    console.log("1. Checking all time slots for timezone consistency...");
    const allTimeSlots = await db.select().from(timeSlots);
    
    // Stats tracking
    let missingTimezoneCount = 0;
    let invalidDurationCount = 0;
    let inconsistentTimezoneCount = 0;
    
    // Analyze each time slot
    for (const slot of allTimeSlots) {
      const analysis = analyzeTimeSlotTimezone(slot);
      
      // Check for missing timezone
      if (!analysis.storageTimezone) {
        missingTimezoneCount++;
        console.log(`⚠️ Time Slot #${analysis.id} - Missing storageTimezone`);
      }
      
      // Check for non-standard duration
      if (analysis.duration !== 30) {
        invalidDurationCount++;
        console.log(`⚠️ Time Slot #${analysis.id} - Non-standard duration: ${analysis.duration} minutes`);
      }
      
      // Check for timezone inconsistency
      if (analysis.storageTimezone && analysis.storageTimezone !== UTC_TIMEZONE) {
        inconsistentTimezoneCount++;
        console.log(`⚠️ Time Slot #${analysis.id} - Non-UTC storageTimezone: ${analysis.storageTimezone}`);
      }
      
      // Validate time slot
      if (!analysis.isValid) {
        console.log(`❌ Time Slot #${analysis.id} - INVALID: start/end time issue`);
        console.log(`   Start: ${analysis.startTime.raw}`);
        console.log(`   End: ${analysis.endTime.raw}`);
      }
    }
    
    // Print summary
    console.log("\n2. Validation Summary");
    console.log("------------------");
    console.log(`Total time slots: ${totalTimeSlots}`);
    console.log(`Time slots with missing timezone: ${missingTimezoneCount}`);
    console.log(`Time slots with non-standard duration: ${invalidDurationCount}`);
    console.log(`Time slots with non-UTC timezone: ${inconsistentTimezoneCount}`);
    
    // Calculate percentage of valid time slots
    const validPercentage = ((totalTimeSlots - missingTimezoneCount - inconsistentTimezoneCount) / totalTimeSlots) * 100;
    
    // Overall status
    console.log("\n3. Overall Status");
    console.log("---------------");
    if (missingTimezoneCount === 0 && inconsistentTimezoneCount === 0) {
      console.log(`✅ ALL TIMEZONE DATA VALID (100%)`);
    } else {
      console.log(`⚠️ TIMEZONE DATA VALID: ${validPercentage.toFixed(2)}%`);
      
      if (missingTimezoneCount > 0) {
        console.log(`   - ${missingTimezoneCount} time slots need storageTimezone field set`);
      }
      
      if (inconsistentTimezoneCount > 0) {
        console.log(`   - ${inconsistentTimezoneCount} time slots need timezone corrected to UTC`);
      }
    }
    
    console.log("\n4. Recommendations");
    console.log("----------------");
    if (missingTimezoneCount > 0 || inconsistentTimezoneCount > 0) {
      console.log("Consider running a database update to fix inconsistent timezone data:");
      console.log("UPDATE time_slots SET storage_timezone = 'UTC' WHERE storage_timezone IS NULL OR storage_timezone != 'UTC';");
    } else {
      console.log("✅ No database fixes needed - all time slots have consistent timezone data");
    }
    
    console.log("\n✅ Timezone validation complete!");
  
  } catch (error) {
    console.error("❌ Error verifying time slots:", error);
  }
}

// Run the verification
verifyAllTimeSlots();