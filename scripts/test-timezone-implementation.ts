/**
 * Test Script for Timezone Implementation
 * 
 * This script tests the timezone implementation by:
 * 1. Creating a time slot with explicit timezone information
 * 2. Fetching and analyzing the time slot
 * 3. Validating the consistency of the timezone data
 */

import { db } from "../server/db";
import { timeSlots } from "../shared/schema";
import { analyzeTimeSlotTimezone, UTC_TIMEZONE, LATVIA_TIMEZONE } from "../server/utils/timezone";
import { eq } from "drizzle-orm";

async function testTimezoneImplementation() {
  console.log("🔍 Testing Timezone Implementation");
  console.log("-----------------------------------");
  
  try {
    // Step 1: Query most recent time slots
    console.log("1. Fetching recent time slots...");
    const recentTimeSlots = await db.select()
      .from(timeSlots)
      .orderBy(timeSlots.id)
      .limit(5);
      
    console.log(`   Found ${recentTimeSlots.length} time slots`);
    
    if (recentTimeSlots.length === 0) {
      console.error("❌ No time slots found in the database");
      return;
    }
    
    // Step 2: Analyze time slots
    console.log("\n2. Analyzing time slots for timezone consistency...");
    for (const slot of recentTimeSlots) {
      const analysis = analyzeTimeSlotTimezone(slot);
      
      console.log(`\n📊 Time Slot #${analysis.id}:`);
      console.log(`   Storage Timezone: ${analysis.storageTimezone || 'Not set (defaulting to UTC)'}`);
      console.log(`   Start Time (Raw ISO): ${analysis.startTime.raw}`);
      console.log(`   Start Time (UTC): ${analysis.startTime.utc}`);
      console.log(`   Start Time (Latvia): ${analysis.startTime.latvia}`);
      console.log(`   End Time (Raw ISO): ${analysis.endTime.raw}`);
      console.log(`   End Time (UTC): ${analysis.endTime.utc}`);
      console.log(`   End Time (Latvia): ${analysis.endTime.latvia}`);
      console.log(`   Duration: ${analysis.duration} minutes`);
      console.log(`   Valid: ${analysis.isValid ? '✅' : '❌'}`);
      
      // Verify proper timezone handling
      if (!analysis.storageTimezone) {
        console.log("⚠️ Missing storageTimezone - older time slot?");
      }
    }
    
    // Step 3: Create a new test time slot with explicit UTC timezone
    console.log("\n3. Creating a new test time slot with explicit UTC timezone...");
    
    // Current time in UTC
    const now = new Date();
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);  // 30 minutes later
    
    // Insert with explicit UTC timezone
    const [newSlot] = await db.insert(timeSlots)
      .values({
        startTime,
        endTime,
        price: 25,
        status: 'available',
        reservationExpiry: null,
        storageTimezone: UTC_TIMEZONE
      })
      .returning();
    
    console.log("✅ Created new test time slot:");
    const newSlotAnalysis = analyzeTimeSlotTimezone(newSlot);
    console.log(`   ID: ${newSlotAnalysis.id}`);
    console.log(`   Storage Timezone: ${newSlotAnalysis.storageTimezone}`);
    console.log(`   Start Time (Latvia): ${newSlotAnalysis.startTime.latvia}`);
    console.log(`   End Time (Latvia): ${newSlotAnalysis.endTime.latvia}`);
    
    // Step 4: Clean up - delete the test time slot
    console.log("\n4. Cleaning up - removing test time slot...");
    await db.delete(timeSlots)
      .where(eq(timeSlots.id, newSlot.id));
      
    console.log("✅ Test time slot removed");
    
    console.log("\n✅ Timezone implementation test completed successfully!");
  
  } catch (error) {
    console.error("❌ Error testing timezone implementation:", error);
  } finally {
    // Note: In a production environment, you would close the database connection
    // but in this case we'll let the Node.js process terminate naturally
  }
}

// Run the test
testTimezoneImplementation();