/**
 * Lead Time Settings Table Creation Script
 * 
 * This script creates the lead_time_settings table manually without using drizzle-kit
 * to avoid disrupting existing tables. This is a safer approach for production systems.
 */

import { db } from "../server/db";
import { leadTimeSettings } from "../shared/schema";
import { sql } from "drizzle-orm";

async function createLeadTimeSettingsTable() {
  try {
    console.log("Starting lead time settings table creation...");
    
    // Check if table exists first
    const checkTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'lead_time_settings'
      );
    `);
    
    // @ts-ignore - PostgreSQL specific result format
    const tableExists = checkTableExists.rows[0].exists;
    
    if (tableExists) {
      console.log("Table 'lead_time_settings' already exists, skipping creation.");
      return;
    }
    
    // Create the enum type first
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_time_restriction_mode') THEN
          CREATE TYPE lead_time_restriction_mode AS ENUM ('enforced', 'booking_based', 'off');
        END IF;
      END $$;
    `);
    
    console.log("Created lead_time_restriction_mode enum if it didn't exist");
    
    // Create the lead_time_settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lead_time_settings (
        id SERIAL PRIMARY KEY,
        restriction_mode lead_time_restriction_mode NOT NULL DEFAULT 'enforced',
        lead_time_days INTEGER NOT NULL DEFAULT 0,
        operator_on_site BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log("Created lead_time_settings table");
    
    // Insert default settings
    await db.execute(sql`
      INSERT INTO lead_time_settings 
        (restriction_mode, lead_time_days, operator_on_site)
      VALUES
        ('off', 0, false)
      ON CONFLICT DO NOTHING;
    `);
    
    console.log("Inserted default lead time settings");
    
    console.log("Lead time settings table creation completed successfully!");
  } catch (error) {
    console.error("Error creating lead time settings table:", error);
  }
}

// Run the function
createLeadTimeSettingsTable()
  .then(() => {
    console.log("Script completed successfully");
    // Don't call process.exit as it might terminate the process prematurely
  })
  .catch((error) => {
    console.error("Script failed:", error);
  });

export { createLeadTimeSettingsTable };