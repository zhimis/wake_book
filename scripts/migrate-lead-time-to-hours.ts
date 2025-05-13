/**
 * Migration Script: Convert Lead Time From Days to Hours
 * 
 * This script migrates the existing lead_time_settings table
 * by adding a lead_time_hours column and converting the existing
 * lead_time_days values to hours (days * 24). 
 * 
 * After verification, the script renames the columns.
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateToDaysToHours() {
  try {
    console.log("Starting lead time migration from days to hours...");
    
    // Check if lead_time_hours column already exists
    const checkColumnExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lead_time_settings' 
        AND column_name = 'lead_time_hours'
      );
    `);
    
    // @ts-ignore - PostgreSQL specific result format
    const columnExists = checkColumnExists.rows[0].exists;
    
    if (columnExists) {
      console.log("Column 'lead_time_hours' already exists, migration may have already been completed.");
      return;
    }
    
    // 1. Add new lead_time_hours column
    console.log("Adding lead_time_hours column...");
    await db.execute(sql`
      ALTER TABLE lead_time_settings
      ADD COLUMN lead_time_hours INTEGER NOT NULL DEFAULT 0;
    `);
    
    // 2. Fetch current settings to see what to migrate
    const settings = await db.execute(sql`
      SELECT id, lead_time_days FROM lead_time_settings;
    `);
    
    // 3. Update lead_time_hours values based on lead_time_days
    console.log("Converting days to hours...");
    for (const row of settings.rows) {
      const days = row.lead_time_days;
      const hours = days * 24; // Convert days to hours
      
      await db.execute(sql`
        UPDATE lead_time_settings
        SET lead_time_hours = ${hours}
        WHERE id = ${row.id};
      `);
      
      console.log(`Converted ${days} days to ${hours} hours for setting ID ${row.id}`);
    }
    
    // 4. Remove the old lead_time_days column
    console.log("Removing lead_time_days column...");
    await db.execute(sql`
      ALTER TABLE lead_time_settings
      DROP COLUMN lead_time_days;
    `);
    
    console.log("Lead time migration completed successfully!");
  } catch (error) {
    console.error("Error migrating lead time settings:", error);
  }
}

// Run the migration
migrateToDaysToHours().then(() => {
  console.log("Migration script completed, exiting.");
  process.exit(0);
}).catch(err => {
  console.error("Migration script failed:", err);
  process.exit(1);
});