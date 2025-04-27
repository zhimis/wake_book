import { pgTable, text, serial, integer, boolean, timestamp, time, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table (admin users)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Day of week operating hours
export const operatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: time("open_time").notNull(),
  closeTime: time("close_time").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
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

// Time slots table
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  price: real("price").notNull(),
  status: text("status").notNull().default("available"), // available, booked, reserved
  reservationExpiry: timestamp("reservation_expiry"), // When reservation expires
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  experienceLevel: text("experience_level").notNull(),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users);
export const insertOperatingHoursSchema = createInsertSchema(operatingHours);
export const insertPricingSchema = createInsertSchema(pricing);
export const insertConfigurationSchema = createInsertSchema(configuration);
export const insertTimeSlotSchema = createInsertSchema(timeSlots);
export const insertBookingSchema = createInsertSchema(bookings).omit({ reference: true });
export const insertBookingTimeSlotsSchema = createInsertSchema(bookingTimeSlots);

// Custom schemas
export const bookingFormSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, {
    message: "Phone number must be between 10-15 digits",
  }),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  equipmentRental: z.boolean().default(false),
  timeSlotIds: z.array(z.number()).min(1, { message: "Select at least one time slot" }),
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

export type TimeSlot = typeof timeSlots.$inferSelect;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type BookingTimeSlot = typeof bookingTimeSlots.$inferSelect;
export type InsertBookingTimeSlot = z.infer<typeof insertBookingTimeSlotsSchema>;

export type BookingFormData = z.infer<typeof bookingFormSchema>;

// For frontend use
export type TimeSlotStatus = "available" | "booked" | "reserved" | "selected";

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
