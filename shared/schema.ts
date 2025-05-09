import { pgTable, text, serial, integer, boolean, timestamp, time, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Generate a consistent, universal ID for any time slot based on its date/time.
 * This function ensures that any slot for the same time period will have the same ID,
 * regardless of whether it's from the database or an empty slot being created dynamically.
 * 
 * @param date The date and time of the slot (start time)
 * @param duration The duration of the slot in minutes (default: 30)
 * @param useUTC Whether to use UTC time (default: true)
 * @returns A string ID in the format YYYYMMDD-HHMM-DUR
 */
export function generateTimeSlotId(date: Date, duration: number = 30, useUTC: boolean = true): string {
  // Extract date components based on whether we use UTC or local time
  const year = useUTC ? date.getUTCFullYear() : date.getFullYear();
  const month = useUTC ? date.getUTCMonth() : date.getMonth(); // 0-11
  const day = useUTC ? date.getUTCDate() : date.getDate(); // 1-31
  const hour = useUTC ? date.getUTCHours() : date.getHours(); // 0-23
  const minute = useUTC ? date.getUTCMinutes() : date.getMinutes(); // 0-59
  
  // Format: YYYYMMDD-HHMM-DUR (duration in minutes)
  return `${year}${(month + 1).toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}-${duration}`;
}

// Define user roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'operator', 'athlete']);

// User table with roles and email
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(), // Email as unique identifier
  username: text("username").notNull(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default('athlete'),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phoneNumber: text("phone_number"),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Day of week operating hours
export const operatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: time("open_time").notNull(),
  closeTime: time("close_time").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  timezone: text("timezone").default("Europe/Riga").notNull(), // Add timezone field
  useLocalTime: boolean("use_local_time").default(false).notNull(), // For special events with non-Latvia time
});

// Standard pricing 
export const pricing = pgTable("pricing", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "standard", "peak", "weekend"
  price: real("price").notNull(),
  startTime: time("start_time"), // For time-based pricing
  endTime: time("end_time"),     // For time-based pricing
  applyToWeekends: boolean("apply_to_weekends"), // For weekend pricing
  weekendMultiplier: real("weekend_multiplier"), // For weekend pricing
});

// Configuration for system settings
export const configuration = pgTable("configuration", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: text("value").notNull(),
});

// Time slots table with timezone support
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  price: real("price").notNull(),
  status: text("status").notNull().default("available"), // available, booked
  storageTimezone: text("storage_timezone").default("UTC").notNull(), // Explicit timezone field
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),  // Optional email field added
  notes: text("notes"),  // Optional notes field for admin bookings
  experienceLevel: text("experience_level"),  // Made optional (nullable) as per requirements
  equipmentRental: boolean("equipment_rental").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reference: text("reference").notNull(),
});

// Booking time slots join table
export const bookingTimeSlots = pgTable("booking_time_slots", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  timeSlotId: integer("time_slot_id").notNull(),
});

// Time format preferences table for application-wide settings
export const timeFormatPreferences = pgTable("time_format_preferences", {
  id: serial("id").primaryKey(),
  use24HourFormat: boolean("use_24_hour_format").default(true).notNull(),
  showTimezoneIndicator: boolean("show_timezone_indicator").default(true).notNull(),
  dateFormat: text("date_format").default("dd.MM.yyyy").notNull(), // EU format by default
  timeFormat: text("time_format").default("HH:mm").notNull(), // 24hr format by default
  defaultTimezone: text("default_timezone").default("Europe/Riga").notNull(),
});

// Lead time restriction mode enum
export const leadTimeRestrictionModeEnum = pgEnum("lead_time_restriction_mode", [
  "enforced",    // Always enforce lead time restrictions
  "booking_based", // Only enforce when no bookings exist for that date
  "off"          // No lead time restrictions
]);

// Lead time settings table for controlling booking deadlines
export const leadTimeSettings = pgTable("lead_time_settings", {
  id: serial("id").primaryKey(),
  restrictionMode: leadTimeRestrictionModeEnum("restriction_mode").default("enforced").notNull(),
  leadTimeDays: integer("lead_time_days").default(0).notNull(), // 0 = same day, 1 = previous day
  operatorOnSite: boolean("operator_on_site").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users);
export const insertOperatingHoursSchema = createInsertSchema(operatingHours);
export const insertPricingSchema = createInsertSchema(pricing);
export const insertConfigurationSchema = createInsertSchema(configuration);
export const insertTimeSlotSchema = createInsertSchema(timeSlots);
export const insertBookingSchema = createInsertSchema(bookings).omit({ reference: true });
export const insertBookingTimeSlotsSchema = createInsertSchema(bookingTimeSlots);
export const insertTimeFormatPreferencesSchema = createInsertSchema(timeFormatPreferences).omit({ id: true });
export const insertLeadTimeSettingsSchema = createInsertSchema(leadTimeSettings).omit({ id: true, updatedAt: true });

// Custom schemas
export const bookingFormSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  phoneNumber: z.string().regex(/^[0-9]{8,15}$/, {
    message: "Phone number must be between 8-15 digits",
  }),
  email: z.union([
    z.string().email({ message: "Invalid email format" }),
    z.string().length(0)
  ]).optional(),
  timeSlotIds: z.array(z.union([z.number(), z.string()])).min(1, { message: "Select at least one time slot" }),
});

// Admin booking form - like the regular booking form but without experienceLevel requirement
export const manualBookingSchema = z.object({
  customerName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  phoneNumber: z.string().regex(/^[0-9]{8,15}$/, {
    message: "Phone number must be between 8-15 digits",
  }),
  email: z.union([
    z.string().email({ message: "Invalid email format" }),
    z.string().length(0)
  ]).optional(),
  timeSlotIds: z.array(z.union([z.number(), z.string()])).min(1, { message: "Select at least one time slot" }),
  // Include information about unallocated slots that need to be created
  unallocatedSlots: z.array(z.object({
    id: z.union([z.number(), z.string()]), // Allow both number and string IDs
    startTime: z.string().or(z.date()), // Accept either string or Date
    endTime: z.string().or(z.date())
  })).optional(),
});

// Admin custom booking form - for creating bookings with custom time slots
export const adminCustomBookingSchema = z.object({
  customerName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  phoneNumber: z.string().regex(/^[0-9]{8,15}$/, {
    message: "Phone number must be between 8-15 digits",
  }),
  email: z.union([
    z.string().email({ message: "Invalid email format" }),
    z.string().length(0)
  ]).optional(),
  notes: z.string().optional(),
  timeSlots: z.array(z.object({
    startTime: z.date(),
    endTime: z.date(),
    price: z.number().optional(),
    status: z.string().optional(),
  })).min(1, { message: "At least one time slot is required" }),
});

// Block time slot form
export const blockTimeSlotSchema = z.object({
  reason: z.string().min(1, { message: "Reason is required" }),
  timeSlotIds: z.array(z.union([z.number(), z.string()])).min(1, { message: "Select at least one time slot" }),
});

// Make available form
export const makeAvailableSchema = z.object({
  price: z.number().positive({ message: "Price must be a positive number" }),
  timeSlotIds: z.array(z.union([z.number(), z.string()])).min(1, { message: "Select at least one time slot" }),
  unallocatedSlots: z.array(z.object({
    id: z.union([z.number(), z.string()]), // Allow both number and string IDs
    startTime: z.string().or(z.date()), // Accept either string or Date
    endTime: z.string().or(z.date())
  })).optional(),
});

// Lead time settings form for admin configuration
export const leadTimeSettingsFormSchema = z.object({
  restrictionMode: z.enum(["enforced", "booking_based", "off"], {
    errorMap: () => ({ message: "Please select a valid restriction mode" })
  }),
  leadTimeDays: z.number().int().min(0, { 
    message: "Lead time days must be a non-negative integer" 
  }),
  operatorOnSite: z.boolean(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type OperatingHours = typeof operatingHours.$inferSelect;
export type InsertOperatingHours = z.infer<typeof insertOperatingHoursSchema>;

export type Pricing = typeof pricing.$inferSelect;
export type InsertPricing = z.infer<typeof insertPricingSchema>;

export type Configuration = typeof configuration.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;

export type TimeSlot = typeof timeSlots.$inferSelect & {
  // Include optional fields for UI display that aren't in the database schema
  originalStartTime?: Date;
  originalEndTime?: Date;
  isPast?: boolean; // Flag to indicate if the time slot is in the past
  id: number | string; // Explicitly support both number and string IDs
};
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type BookingTimeSlot = typeof bookingTimeSlots.$inferSelect;
export type InsertBookingTimeSlot = z.infer<typeof insertBookingTimeSlotsSchema>;

export type TimeFormatPreferences = typeof timeFormatPreferences.$inferSelect;
export type InsertTimeFormatPreferences = z.infer<typeof insertTimeFormatPreferencesSchema>;

export type LeadTimeSettings = typeof leadTimeSettings.$inferSelect;
export type InsertLeadTimeSettings = z.infer<typeof insertLeadTimeSettingsSchema>;
export type LeadTimeRestrictionMode = "enforced" | "booking_based" | "off";

export type BookingFormData = z.infer<typeof bookingFormSchema>;
export type ManualBookingFormData = z.infer<typeof manualBookingSchema>;
export type AdminCustomBookingData = z.infer<typeof adminCustomBookingSchema>;
export type BlockTimeSlotFormData = z.infer<typeof blockTimeSlotSchema>;
export type MakeAvailableFormData = z.infer<typeof makeAvailableSchema>;
export type LeadTimeSettingsFormData = z.infer<typeof leadTimeSettingsFormSchema>;

// For frontend use
export type TimeSlotStatus = "available" | "booked" | "selected";

export type DaySchedule = {
  date: Date;
  dayName: string;
  dayShort: string;
  slots: TimeSlot[];
};

export type WeekSchedule = {
  startDate: Date;
  endDate: Date;
  days: DaySchedule[];
};

export type WeatherForecast = {
  date: Date;
  dayName: string;
  temperature: number;
  condition: string;
  icon: string;
};

export type BookingDetails = {
  booking: Booking;
  timeSlots: TimeSlot[];
  totalPrice: number;
};

export type StatsData = {
  bookingRate: number;
  totalBookings: number;
  forecastedIncome: number;
  avgSessionLength: number;
  bookingsByDay: Array<{ day: string; count: number; percentage: number }>;
  popularTimeSlots: Array<{ time: string; percentage: number }>;
};
