/**
 * Draft Schema Changes for Timezone Improvements
 * 
 * This is a draft of the schema changes required for better timezone handling.
 * This file is for documentation purposes only and should not be used in production.
 */

import { pgTable, serial, text, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/******************************************
 * CURRENT SCHEMA (FOR REFERENCE)
 ******************************************/

// Current TimeSlots schema
export const currentTimeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  price: numeric("price").notNull(),
  reservationExpiry: timestamp("reservation_expiry"),
});

// Current OperatingHours schema
export const currentOperatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
});

/******************************************
 * PROPOSED SCHEMA CHANGES
 ******************************************/

// 1. Enhanced TimeSlots schema with explicit timezone awareness
export const enhancedTimeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(), // Add timezone
  endTime: timestamp("end_time", { withTimezone: true }).notNull(), // Add timezone
  price: numeric("price").notNull(),
  reservationExpiry: timestamp("reservation_expiry", { withTimezone: true }), // Add timezone
  storageTimezone: text("storage_timezone").default("UTC").notNull(), // Add explicit timezone field
});

// 2. Enhanced OperatingHours schema with timezone awareness
export const enhancedOperatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: text("open_time").notNull(), // Format: "HH:MM"
  closeTime: text("close_time").notNull(), // Format: "HH:MM"
  isClosed: boolean("is_closed").notNull().default(false),
  timezone: text("timezone").default("Europe/Riga").notNull(), // Add timezone field
  useLocalTime: boolean("use_local_time").default(false).notNull(), // For special events with non-Latvia time
});

// 3. New TimeFormatPreferences table for application-wide settings
export const timeFormatPreferences = pgTable("time_format_preferences", {
  id: serial("id").primaryKey(),
  use24HourFormat: boolean("use_24_hour_format").default(true).notNull(),
  showTimezoneIndicator: boolean("show_timezone_indicator").default(true).notNull(),
  dateFormat: text("date_format").default("dd.MM.yyyy").notNull(), // EU format by default
  timeFormat: text("time_format").default("HH:mm").notNull(), // 24hr format by default
  defaultTimezone: text("default_timezone").default("Europe/Riga").notNull(),
});

/******************************************
 * UPDATED SCHEMAS FOR ZOD VALIDATION
 ******************************************/

// Updated Insert schemas with new fields
export const insertEnhancedTimeSlotSchema = createInsertSchema(enhancedTimeSlots)
  .extend({
    // Add additional validation for the new fields
    storageTimezone: z.string().min(1).default("UTC"),
  })
  .omit({ id: true });

export const insertEnhancedOperatingHoursSchema = createInsertSchema(enhancedOperatingHours)
  .extend({
    // Add validation for time format (HH:MM)
    openTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Time must be in HH:MM format"),
    closeTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Time must be in HH:MM format"),
    timezone: z.string().min(1).default("Europe/Riga"),
  })
  .omit({ id: true });

export const insertTimeFormatPreferencesSchema = createInsertSchema(timeFormatPreferences)
  .omit({ id: true });

// Types
export type InsertEnhancedTimeSlot = z.infer<typeof insertEnhancedTimeSlotSchema>;
export type EnhancedTimeSlot = typeof enhancedTimeSlots.$inferSelect;

export type InsertEnhancedOperatingHours = z.infer<typeof insertEnhancedOperatingHoursSchema>;
export type EnhancedOperatingHours = typeof enhancedOperatingHours.$inferSelect;

export type InsertTimeFormatPreferences = z.infer<typeof insertTimeFormatPreferencesSchema>;
export type TimeFormatPreferences = typeof timeFormatPreferences.$inferSelect;

/******************************************
 * MIGRATION NOTES
 ******************************************/

/**
 * Migration Steps:
 * 
 * 1. For TimeSlots:
 *    - Create a new table with the enhanced schema
 *    - Copy data with proper timezone information
 *    - Rename tables
 * 
 * 2. For OperatingHours:
 *    - Create a new table with the enhanced schema
 *    - Copy data with timezone and fix time format issues
 *    - Rename tables
 * 
 * 3. For TimeFormatPreferences:
 *    - Create the new table
 *    - Add default values
 * 
 * Detailed SQL migration scripts for these operations are provided in the
 * scripts/test-operating-hours-migration.ts file.
 */