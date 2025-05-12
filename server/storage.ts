import {
  User, InsertUser, TimeSlot, InsertTimeSlot, 
  Booking, InsertBooking, OperatingHours, InsertOperatingHours,
  Pricing, InsertPricing, Configuration, InsertConfiguration,
  BookingTimeSlot, InsertBookingTimeSlot, LeadTimeSettings, InsertLeadTimeSettings,
  users, timeSlots, bookings, bookingTimeSlots, operatingHours, pricing, configuration,
  leadTimeSettings
} from "@shared/schema";
import { nanoid } from 'nanoid';
import session from "express-session";
import createMemoryStore from "memorystore";
import { eq, and, gte, lte, not } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { formatInTimeZone } from "date-fns-tz";

// Helper functions for day conversion between standard JS (0=Sunday) and Latvian (0=Monday) format
function getWeekdayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}

// Convert from standard JS day index (0=Sunday) to Latvian day index (0=Monday)
function toLatvianDayIndex(jsDayIndex: number): number {
  return (jsDayIndex + 6) % 7; // Shift by 6 to make Monday=0
}

// Convert from Latvian day index (0=Monday) to standard JS day index (0=Sunday)
function fromLatvianDayIndex(latvianDayIndex: number): number {
  return (latvianDayIndex + 1) % 7; // Shift by 1 to make Sunday=0
}

// Get Latvian day name (with Monday as first day)
function getLatvianWeekdayName(latvianDayIndex: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[latvianDayIndex];
}

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  adminUserExists(): Promise<boolean>;
  updateUserLastLogin(id: number): Promise<void>;
  
  // TimeSlot methods
  getTimeSlot(id: number): Promise<TimeSlot | undefined>;
  getTimeSlotsByDateRange(startDate: Date, endDate: Date): Promise<TimeSlot[]>;
  createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot>;
  updateTimeSlot(id: number, timeSlot: Partial<TimeSlot>): Promise<TimeSlot | undefined>;
  blockTimeSlot(id: number, reason: string): Promise<TimeSlot | undefined>;
  regenerateTimeSlots(): Promise<{ success: boolean, preservedBookings: number, conflicts: any[] }>;
  
  // Booking methods
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingByReference(reference: string): Promise<Booking | undefined>;
  getBookings(): Promise<Booking[]>;
  getBookingsByEmail(email: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, booking: Partial<Booking>): Promise<Booking | undefined>;
  deleteBooking(id: number): Promise<boolean>;
  getBookingTimeSlots(bookingId: number): Promise<TimeSlot[]>;
  addTimeSlotToBooking(bookingTimeSlot: InsertBookingTimeSlot): Promise<BookingTimeSlot>;
  
  // Configuration methods
  getOperatingHours(): Promise<OperatingHours[]>;
  updateOperatingHours(id: number, hours: Partial<OperatingHours>): Promise<OperatingHours | undefined>;
  createOperatingHours(hours: InsertOperatingHours): Promise<OperatingHours>;
  
  getPricing(): Promise<Pricing[]>;
  updatePricing(id: number, pricing: Partial<Pricing>): Promise<Pricing | undefined>;
  createPricing(pricing: InsertPricing): Promise<Pricing>;
  
  getConfiguration(name: string): Promise<Configuration | undefined>;
  updateConfiguration(name: string, value: string): Promise<Configuration | undefined>;
  createConfiguration(config: InsertConfiguration): Promise<Configuration>;
  
  // Lead time settings methods
  getLeadTimeSettings(): Promise<LeadTimeSettings | undefined>;
  updateLeadTimeSettings(settings: Partial<LeadTimeSettings>): Promise<LeadTimeSettings | undefined>;
  createLeadTimeSettings(settings: InsertLeadTimeSettings): Promise<LeadTimeSettings>;
  checkBookingAllowedByLeadTime(date: Date): Promise<{
    allowed: boolean;
    reason?: string;
    leadTimeDays?: number;
    mode?: string;
  }>;
  
  // Statistics methods
  getBookingStats(startDate: Date, endDate: Date): Promise<any>;
  
  // Session store
  sessionStore: session.Store;
}

import { db, pool } from "./db";

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Initialize session store with PostgreSQL
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool,
      createTableIfMissing: true 
    });
    
    // Initialize default data
    this.initializeDefaults();
  }

  private async initializeDefaults() {
    try {
      // Admin user will be created from auth.ts to ensure proper password hashing
      
      // Create default operating hours (8:00 - 22:00)
      const existingOperatingHours = await db.select().from(operatingHours);
      if (existingOperatingHours.length === 0) {
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          await db.insert(operatingHours).values({
            dayOfWeek,
            openTime: "08:00",
            closeTime: "22:00",
            isClosed: dayOfWeek === 1 // Mondays closed by default
          });
        }
        console.log("Default operating hours created");
      }
      
      // Create default pricing options
      const existingPricing = await db.select().from(pricing);
      if (existingPricing.length === 0) {
        await db.insert(pricing).values([
          {
            name: 'standard',
            price: 50,
            startTime: null,
            endTime: null,
            applyToWeekends: false,
            weekendMultiplier: null
          },
          {
            name: 'peak',
            price: 60,
            startTime: '12:00',
            endTime: '16:00',
            applyToWeekends: false,
            weekendMultiplier: null
          },
          {
            name: 'weekend',
            price: 0, // Base price not used for weekends
            startTime: null,
            endTime: null,
            applyToWeekends: true,
            weekendMultiplier: 1.2
          }
        ]);
        console.log("Default pricing options created");
      }
      
      // Create default configuration
      const existingConfig = await db.select().from(configuration);
      if (existingConfig.length === 0) {
        await db.insert(configuration).values([
          {
            name: 'visibility_weeks',
            value: '4'
          }
        ]);
        console.log("Default configuration created");
      }

      // Initialize lead time settings if none exist
      const existingSettings = await db.select().from(leadTimeSettings);
      if (existingSettings.length === 0) {
        await db.insert(leadTimeSettings).values({
          restrictionMode: "off", // Default to no restrictions
          leadTimeDays: 0,        // Same day by default
          operatorOnSite: false   // Default to no operator on-site
        });
        console.log("Default lead time settings created");
      }

      // Initialize time slots if none exist
      const existingTimeSlots = await db.select().from(timeSlots);
      if (existingTimeSlots.length === 0) {
        console.log("Generating time slots for the next 4 weeks...");
        await this.generateTimeSlots();
      }
    } catch (error) {
      console.error("Error initializing default data:", error);
    }
  }
  
  // Helper method to generate time slots for the next few weeks
  private async generateTimeSlots() {
    try {
      // Get all operating hours and pricing rules
      const allOperatingHours = await db.select().from(operatingHours);
      const allPricing = await db.select().from(pricing);
      
      // Generate time slots for the next 4 weeks
      const today = new Date();
      
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 28); // 4 weeks
      
      console.log(`Starting time slot generation from ${today.toISOString()} to ${endDate.toISOString()}`);
      
      // Import the timezone-aware generator
      const { generateTimeSlotsWithTimezone } = await import('./utils/time-slot-generator');
      
      // Generate time slots with proper timezone handling
      const timeSlotBatches = await generateTimeSlotsWithTimezone(
        today,
        endDate,
        allOperatingHours,
        allPricing
      );
      
      // Insert time slots in batches to avoid memory issues
      const BATCH_SIZE = 100;
      let currentBatch = [];
      
      for (const timeSlot of timeSlotBatches) {
        currentBatch.push(timeSlot);
        
        if (currentBatch.length >= BATCH_SIZE) {
          await db.insert(timeSlots).values(currentBatch);
          currentBatch = [];
        }
      }
      
      // Insert any remaining time slots
      if (currentBatch.length > 0) {
        await db.insert(timeSlots).values(currentBatch);
      }
      
      console.log(`Time slots generated successfully (${timeSlotBatches.length} slots).`);
    } catch (error) {
      console.error("Error generating time slots:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ ...userData })
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    return updatedUser;
  }
  
  async adminUserExists(): Promise<boolean> {
    const [admin] = await db.select()
      .from(users)
      .where(eq(users.role, 'admin'));
    return !!admin;
  }
  
  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }
  
  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    const [timeSlot] = await db.select().from(timeSlots).where(eq(timeSlots.id, id));
    return timeSlot;
  }
  
  async getTimeSlotsByDateRange(startDate: Date, endDate: Date): Promise<TimeSlot[]> {
    // Import the timezone utilities
    const { toLatviaTime, fromLatviaTime, formatInLatviaTime, LATVIA_TIMEZONE } = await import('./utils/timezone');
    
    // Log the input dates for debugging
    console.log(`Fetching time slots from ${formatInLatviaTime(startDate, 'yyyy-MM-dd HH:mm:ss')} to ${formatInLatviaTime(endDate, 'yyyy-MM-dd HH:mm:ss')} (Latvia time)`);
    
    // Query using the original dates (which are already in UTC format for database storage)
    return db.select()
      .from(timeSlots)
      .where(
        and(
          gte(timeSlots.startTime, startDate),
          lte(timeSlots.startTime, endDate)
        )
      );
  }
  
  async createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot> {
    // Import timezone utilities
    const { UTC_TIMEZONE } = await import('./utils/timezone');
    
    // Ensure the storageTimezone field is set to UTC by default
    const timeSlotWithTimezone = {
      ...timeSlot,
      storageTimezone: timeSlot.storageTimezone || UTC_TIMEZONE
    };
    
    const [newTimeSlot] = await db.insert(timeSlots).values(timeSlotWithTimezone).returning();
    return newTimeSlot;
  }
  
  async updateTimeSlot(id: number, timeSlot: Partial<TimeSlot>): Promise<TimeSlot | undefined> {
    const [updatedTimeSlot] = await db.update(timeSlots)
      .set(timeSlot)
      .where(eq(timeSlots.id, id))
      .returning();
    return updatedTimeSlot;
  }
  

  
  async blockTimeSlot(id: number, reason: string): Promise<TimeSlot | undefined> {
    // Instead of updating to blocked status, we'll delete the time slot entirely
    // This will make it appear as an unallocated gray slot in the UI
    const [removedTimeSlot] = await db.delete(timeSlots)
      .where(eq(timeSlots.id, id))
      .returning();
    
    // Store the reason for blocking in configuration if needed
    await db.insert(configuration)
      .values({
        name: `block_reason_${id}`,
        value: reason
      })
      .onConflictDoUpdate({
        target: configuration.name,
        set: { value: reason }
      });
      
    return removedTimeSlot;
  }
  
  // Helper method to get a preview of time slots that would be generated
  // but without actually inserting them into the database
  async generateTimeSlotsPreview(): Promise<Omit<InsertTimeSlot, 'id'>[]> {
    // Import timezone utilities
    const { fromLatviaTime, toLatviaTime, UTC_TIMEZONE } = await import('./utils/timezone');
    
    // Get operating hours
    const operatingHours = await db.select().from(operatingHours);
    
    // Get today's date in Latvia timezone for consistency
    const today = toLatviaTime(new Date());
    today.setHours(0, 0, 0, 0);
    
    // Generate slots for 28 days by default
    const leadTimeSettings = await this.getLeadTimeSettings();
    const numDays = leadTimeSettings?.bookingWindowDays || 28;
    
    let allSlots: Omit<InsertTimeSlot, 'id'>[] = [];
    
    // For each day
    for (let i = 0; i < numDays; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + i);
      
      // Day of week (0 = Sunday, 6 = Saturday)
      const dayOfWeek = currentDate.getDay();
      // Convert to our calendar system (0 = Monday, 6 = Sunday)
      const calendarDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      // Get operating hours for this day
      const dayHours = operatingHours.find(oh => oh.dayOfWeek === calendarDay);
      if (!dayHours || dayHours.isClosed) {
        continue; // Skip closed days
      }
      
      // Create start and end hours in Latvia time
      const openTime = dayHours.openTime.split(':');
      const closeTime = dayHours.closeTime.split(':');
      
      // Set dates using Latvia time first for consistency
      let startDateTime = new Date(currentDate);
      startDateTime.setHours(parseInt(openTime[0]), parseInt(openTime[1]), 0, 0);
      
      const endDateTime = new Date(currentDate);
      endDateTime.setHours(parseInt(closeTime[0]), parseInt(closeTime[1]), 0, 0);
      
      // Generate slots in 30-minute increments
      while (startDateTime < endDateTime) {
        const slotEndTime = new Date(startDateTime);
        slotEndTime.setMinutes(slotEndTime.getMinutes() + 30);
        
        // Convert to UTC for storage
        const utcStartTime = fromLatviaTime(startDateTime);
        const utcEndTime = fromLatviaTime(slotEndTime);
        
        // Generate a price based on peak/non-peak hours
        const isPeakHour = (
          // Weekend
          (dayOfWeek === 0 || dayOfWeek === 6) ||
          // Weekday evening (after 5pm)
          (startDateTime.getHours() >= 17)
        );
        
        const price = isPeakHour ? 25 : 20;
        
        // Create the time slot
        allSlots.push({
          startTime: utcStartTime,
          endTime: utcEndTime,
          price,
          status: 'available',
          reservationExpiry: null,
          storageTimezone: UTC_TIMEZONE
        });
        
        // Increment by 30 minutes
        startDateTime = slotEndTime;
      }
    }
    
    return allSlots;
  }

  // Public method to regenerate time slots with timezone awareness - IMPROVED VERSION
  async regenerateTimeSlots(): Promise<{ success: boolean, preservedBookings: number, conflicts: any[], duplicatesPrevented: number }> {
    try {
      // Import timezone utilities
      const { toLatviaTime, fromLatviaTime, formatInLatviaTime, LATVIA_TIMEZONE } = await import('./utils/timezone');
      const { checkTimeSlotConflicts } = await import('./utils/time-slot-generator');
      
      // Get today's date in Latvia timezone for consistency
      const today = new Date();
      const latviaToday = toLatviaTime(today);
      latviaToday.setHours(0, 0, 0, 0);
      
      // Convert back to UTC for database queries
      const utcToday = fromLatviaTime(latviaToday);
      
      console.log(`Regenerating time slots from ${formatInLatviaTime(today, 'yyyy-MM-dd')} onwards (Latvia time)`);
      
      // Find ALL future time slots with bookings to preserve them
      const bookedTimeSlots = await db.select()
        .from(timeSlots)
        .where(
          and(
            gte(timeSlots.startTime, utcToday),
            eq(timeSlots.status, "booked")
          )
        );
      
      console.log(`Found ${bookedTimeSlots.length} booked time slots to preserve during regeneration`);
      
      // Create a set of all start times (in ISO format) that are already booked
      // We'll use this set to prevent generating duplicates for these time periods
      const bookedStartTimes = new Set(
        bookedTimeSlots.map(slot => new Date(slot.startTime).toISOString())
      );
      
      console.log(`Preserving ${bookedStartTimes.size} unique time periods with bookings`);
      
      // Store detailed information about each booked slot for later reference
      const bookedSlotDetails = bookedTimeSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        price: slot.price
      }));
      
      // IMPORTANT CHANGE: Delete all future time slots EXCEPT booked ones
      await db.delete(timeSlots)
        .where(
          and(
            gte(timeSlots.startTime, utcToday),
            not(eq(timeSlots.status, "booked"))
          )
        );
      
      console.log(`Deleted all non-booked future time slots`);
      
      // Now get the list of time slots that would normally be generated
      const newTimeSlots = await this.generateTimeSlotsPreview();
      
      // Filter out any time slots that would overlap with already booked slots
      // to prevent creating duplicates
      let duplicatesPrevented = 0;
      
      const filteredNewTimeSlots = newTimeSlots.filter(newSlot => {
        // Convert slot start time to ISO string for comparison
        const slotStartIso = new Date(newSlot.startTime).toISOString();
        
        // Check if this time is already booked
        const isDuplicate = bookedStartTimes.has(slotStartIso);
        
        if (isDuplicate) {
          duplicatesPrevented++;
          return false; // Filter out this slot
        }
        
        return true; // Keep this slot
      });
      
      console.log(`Prevented ${duplicatesPrevented} duplicates for already booked time periods`);
      
      // Now insert only the filtered time slots that won't create duplicates
      if (filteredNewTimeSlots.length > 0) {
        await db.insert(timeSlots).values(filteredNewTimeSlots);
      }
      
      console.log(`Inserted ${filteredNewTimeSlots.length} new time slots (avoiding duplicates)`);
      
      // After regeneration, check for any conflicts 
      const conflicts: { id: number, startTime: Date, conflictTime: string }[] = [];
      
      for (const bookedSlot of bookedSlotDetails) {
        // Format the dates for logs in Latvia timezone for better readability
        const formattedStart = formatInLatviaTime(bookedSlot.startTime, 'yyyy-MM-dd HH:mm:ss');
        console.log(`Preserved booked slot: ID ${bookedSlot.id}, time: ${formattedStart}`);
      }
      
      console.log("Time slots regenerated successfully with timezone awareness, preserving existing bookings.");
      return {
        success: true,
        preservedBookings: bookedTimeSlots.length,
        conflicts,
        duplicatesPrevented
      };
    } catch (error) {
      console.error("Error regenerating time slots:", error);
      throw error; // Re-throw to handle in the calling function
    }
  }
  
  async getBookings(): Promise<Booking[]> {
    return db.select().from(bookings);
  }
  
  async getBookingsByEmail(email: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.email, email));
  }
  
  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }
  
  async getBookingByReference(reference: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.reference, reference));
    return booking;
  }
  
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const reference = `WB-${nanoid(8).toUpperCase()}`;
    
    const bookingToInsert = {
      ...booking,
      reference,
      createdAt: new Date()
    };
    
    const [newBooking] = await db.insert(bookings).values(bookingToInsert).returning();
    return newBooking;
  }
  
  async updateBooking(id: number, bookingData: Partial<Booking>): Promise<Booking | undefined> {
    try {
      // Ensure we're not trying to update fields that shouldn't be modified
      const safeUpdate = { ...bookingData };
      
      // Don't allow changing reference or createdAt fields
      delete safeUpdate.reference;
      delete safeUpdate.createdAt;
      
      // Update the booking
      const [updatedBooking] = await db.update(bookings)
        .set(safeUpdate)
        .where(eq(bookings.id, id))
        .returning();
      
      return updatedBooking;
    } catch (error) {
      console.error("Error updating booking:", error);
      return undefined;
    }
  }
  
  async deleteBooking(id: number): Promise<boolean> {
    try {
      console.log(`Storage.deleteBooking(${id}) called`);
      
      // First, check if the booking exists
      const booking = await this.getBooking(id);
      if (!booking) {
        console.log(`No booking found with ID ${id}`);
        return false;
      }
      
      console.log(`Found booking to delete:`, booking);
      
      // Find all time slots associated with this booking
      const timeSlotIds = await db.select()
        .from(bookingTimeSlots)
        .where(eq(bookingTimeSlots.bookingId, id));
      
      console.log(`Found ${timeSlotIds.length} time slots associated with booking ${id}:`, timeSlotIds);
      
      // Delete the booking-time slot connections
      const bookingTimeSlotsResult = await db.delete(bookingTimeSlots)
        .where(eq(bookingTimeSlots.bookingId, id))
        .returning();
      
      console.log(`Deleted ${bookingTimeSlotsResult.length} booking-time slot connections`);
      
      // Update the time slots back to available
      for (const timeSlotRef of timeSlotIds) {
        const updateResult = await db.update(timeSlots)
          .set({ status: "available" })
          .where(eq(timeSlots.id, timeSlotRef.timeSlotId))
          .returning();
        
        console.log(`Updated time slot ${timeSlotRef.timeSlotId} status to "available":`, updateResult);
      }
      
      // Delete the booking itself
      const result = await db.delete(bookings)
        .where(eq(bookings.id, id))
        .returning();
      
      console.log(`Booking deletion result:`, result);
      
      return result.length === 1;
    } catch (error) {
      console.error("Error deleting booking:", error);
      return false;
    }
  }
  
  async getBookingTimeSlots(bookingId: number): Promise<TimeSlot[]> {
    // Get all time slot IDs for this booking
    const timeSlotRefs = await db.select()
      .from(bookingTimeSlots)
      .where(eq(bookingTimeSlots.bookingId, bookingId));
    
    // If no time slots found, return empty array
    if (timeSlotRefs.length === 0) {
      return [];
    }
    
    // Get the actual time slots
    const timeSlotPromises = timeSlotRefs.map(ref => 
      this.getTimeSlot(ref.timeSlotId)
    );
    
    // Filter out any undefined results (in case a time slot was deleted)
    const timeSlots = (await Promise.all(timeSlotPromises)).filter(
      (slot): slot is TimeSlot => slot !== undefined
    );
    
    // Return the time slots sorted by start time
    return timeSlots.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }
  
  async addTimeSlotToBooking(bookingTimeSlot: InsertBookingTimeSlot): Promise<BookingTimeSlot> {
    // First, update the time slot status to booked
    await db.update(timeSlots)
      .set({ status: "booked" })
      .where(eq(timeSlots.id, bookingTimeSlot.timeSlotId));
    
    // Then create the booking-time slot connection
    const [newBookingTimeSlot] = await db.insert(bookingTimeSlots)
      .values(bookingTimeSlot)
      .returning();
    
    return newBookingTimeSlot;
  }
  
  async getOperatingHours(): Promise<OperatingHours[]> {
    return db.select().from(operatingHours)
      .orderBy((hours) => hours.dayOfWeek);
  }
  
  async updateOperatingHours(id: number, hours: Partial<OperatingHours>): Promise<OperatingHours | undefined> {
    try {
      const [updatedHours] = await db.update(operatingHours)
        .set(hours)
        .where(eq(operatingHours.id, id))
        .returning();
      
      return updatedHours;
    } catch (error) {
      console.error("Error updating operating hours:", error);
      return undefined;
    }
  }
  
  async createOperatingHours(hours: InsertOperatingHours): Promise<OperatingHours> {
    const [newHours] = await db.insert(operatingHours)
      .values(hours)
      .returning();
    
    return newHours;
  }
  
  async getPricing(): Promise<Pricing[]> {
    return db.select().from(pricing);
  }
  
  async updatePricing(id: number, pricingData: Partial<Pricing>): Promise<Pricing | undefined> {
    try {
      const [updatedPricing] = await db.update(pricing)
        .set(pricingData)
        .where(eq(pricing.id, id))
        .returning();
      
      return updatedPricing;
    } catch (error) {
      console.error("Error updating pricing:", error);
      return undefined;
    }
  }
  
  async createPricing(pricingData: InsertPricing): Promise<Pricing> {
    const [newPricing] = await db.insert(pricing)
      .values(pricingData)
      .returning();
    
    return newPricing;
  }
  
  async getConfiguration(name: string): Promise<Configuration | undefined> {
    const [config] = await db.select()
      .from(configuration)
      .where(eq(configuration.name, name));
    
    return config;
  }
  
  async updateConfiguration(name: string, value: string): Promise<Configuration | undefined> {
    try {
      // Check if configuration exists
      const existingConfig = await this.getConfiguration(name);
      
      if (!existingConfig) {
        // If it doesn't exist, create it
        return this.createConfiguration({ name, value });
      }
      
      // Otherwise, update it
      const [updatedConfig] = await db.update(configuration)
        .set({ value })
        .where(eq(configuration.name, name))
        .returning();
      
      return updatedConfig;
    } catch (error) {
      console.error(`Error updating configuration ${name}:`, error);
      return undefined;
    }
  }
  
  async createConfiguration(config: InsertConfiguration): Promise<Configuration> {
    const [newConfig] = await db.insert(configuration)
      .values(config)
      .returning();
    
    return newConfig;
  }
  
  // Lead time settings methods
  async getLeadTimeSettings(): Promise<LeadTimeSettings | undefined> {
    // Get the first (and should be only) lead time settings record
    const [settings] = await db.select().from(leadTimeSettings).limit(1);
    return settings;
  }

  async updateLeadTimeSettings(settings: Partial<LeadTimeSettings>): Promise<LeadTimeSettings | undefined> {
    try {
      const existingSettings = await this.getLeadTimeSettings();
      
      if (!existingSettings) {
        return this.createLeadTimeSettings(settings as InsertLeadTimeSettings);
      }
      
      // Add updatedAt timestamp
      const updatedSettings = {
        ...settings,
        updatedAt: new Date()
      };
      
      // Update the settings
      const [updated] = await db.update(leadTimeSettings)
        .set(updatedSettings)
        .where(eq(leadTimeSettings.id, existingSettings.id))
        .returning();
      
      return updated;
    } catch (error) {
      console.error("Error updating lead time settings:", error);
      return undefined;
    }
  }

  async createLeadTimeSettings(settings: InsertLeadTimeSettings): Promise<LeadTimeSettings> {
    const [created] = await db.insert(leadTimeSettings)
      .values(settings)
      .returning();
    
    return created;
  }

  async checkBookingAllowedByLeadTime(date: Date): Promise<{
    allowed: boolean;
    reason?: string;
    leadTimeDays?: number;
    mode?: string;
  }> {
    try {
      // Import timezone utilities
      const { toLatviaTime, formatInLatviaTime } = await import('./utils/timezone');
      
      // Get current settings
      const settings = await this.getLeadTimeSettings();
      
      // If no settings or mode is off, booking is allowed
      if (!settings || settings.restrictionMode === "off") {
        return { allowed: true };
      }
      
      // If operator is on-site, booking is allowed
      if (settings.operatorOnSite) {
        return { allowed: true, mode: "operator_on_site" };
      }
      
      // Convert the requested date to Latvia time for consistency
      const latviaDate = toLatviaTime(date);
      const today = toLatviaTime(new Date());
      
      // Reset time parts to compare just the dates
      today.setHours(0, 0, 0, 0);
      
      // Extract just the date part for comparison
      const bookingDate = new Date(latviaDate);
      bookingDate.setHours(0, 0, 0, 0);
      
      // Calculate days difference
      const daysDiff = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if the booking date meets the lead time requirement
      const hasEnoughLeadTime = daysDiff >= settings.leadTimeDays;
      
      // For booking-based mode, check if there are existing bookings for this date
      if (settings.restrictionMode === "booking_based" && !hasEnoughLeadTime) {
        // Check if there are any bookings for this date
        const startOfDay = new Date(bookingDate);
        const endOfDay = new Date(bookingDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Get all time slots for this date
        const dateSlots = await this.getTimeSlotsByDateRange(startOfDay, endOfDay);
        
        // Check if any slots are booked
        const hasBookings = dateSlots.some(slot => slot.status === "booked");
        
        if (hasBookings) {
          // If there are bookings, then lead time restriction is bypassed
          return { 
            allowed: true, 
            mode: "booking_based_override",
            leadTimeDays: settings.leadTimeDays 
          };
        }
      }
      
      // If enforced mode or booking-based mode without existing bookings
      if (!hasEnoughLeadTime) {
        return {
          allowed: false,
          reason: `Online booking requires ${settings.leadTimeDays} days lead time`,
          leadTimeDays: settings.leadTimeDays,
          mode: settings.restrictionMode
        };
      }
      
      // If we get here, booking is allowed
      return { allowed: true, leadTimeDays: settings.leadTimeDays, mode: settings.restrictionMode };
    } catch (error) {
      console.error("Error checking lead time restrictions:", error);
      // Default to allowing bookings if there's an error
      return { allowed: true };
    }
  }
  
  async getBookingStats(startDate: Date, endDate: Date): Promise<any> {
    try {
      // Get all bookings first
      const allBookings = await this.getBookings();
      
      // Filter bookings by date range
      const bookingsInRange = allBookings.filter(booking => {
        const bookingDate = new Date(booking.createdAt);
        return bookingDate >= startDate && bookingDate <= endDate;
      });
      
      const totalBookings = bookingsInRange.length;
      
      // Get all booked time slots for these bookings
      let totalDuration = 0;
      let totalIncome = 0;
      const bookingsByDay: Record<number, number> = {}; // Day of week -> count
      const timeSlotCounts: Record<string, number> = {}; // Hour -> count
      
      // For each booking in the range, get its time slots
      for (const booking of bookingsInRange) {
        const timeSlots = await this.getBookingTimeSlots(booking.id);
        
        // Calculate duration and income
        if (timeSlots.length > 0) {
          // Duration in minutes
          for (const slot of timeSlots) {
            const slotDuration = 30; // Fixed 30-minute slots
            totalDuration += slotDuration;
            totalIncome += slot.price || 0;
            
            // Count by day of week
            const slotDate = new Date(slot.startTime);
            const dayOfWeek = slotDate.getDay(); // 0-6 (0 is Sunday)
            bookingsByDay[dayOfWeek] = (bookingsByDay[dayOfWeek] || 0) + 1;
            
            // Count by hour with better formatting
            const hour = slotDate.getHours();
            const timeKey = `${hour.toString().padStart(2, '0')}:00-${((hour + 1) % 24).toString().padStart(2, '0')}:00`;
            timeSlotCounts[timeKey] = (timeSlotCounts[timeKey] || 0) + 1;
          }
        }
      }
      
      // Get all time slots in the date range (available, booked, and blocked)
      const allTimeSlots = await this.getTimeSlotsByDateRange(startDate, endDate);
      
      // Calculate booking rate based on actual time slots (booked slots / total slots)
      const totalTimeSlots = allTimeSlots.length;
      const bookedSlots = allTimeSlots.filter(slot => slot.status === 'booked').length;
      
      // Calculate booking rate as percentage of booked slots out of all slots
      const bookingRate = totalTimeSlots > 0 ? (bookedSlots / totalTimeSlots) * 100 : 0;
      
      // Calculate total booked slots
      const totalBookedSlots = Object.values(bookingsByDay).reduce((sum, count) => sum + count, 0);
      
      // Format booking by day data
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const bookingsByDayFormatted = daysOfWeek.map((day, index) => {
        const count = bookingsByDay[index] || 0;
        // Calculate percentage of total booked slots, not total bookings
        const percentage = totalBookedSlots > 0 ? (count / totalBookedSlots) * 100 : 0;
        return {
          day,
          count,
          percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal place
        };
      });
      
      // Format popular time slots - calculate as percentage of total booked slots
      const timeSlotsSorted = Object.entries(timeSlotCounts)
        .map(([time, count]) => ({
          time,
          count,
          percentage: totalBookedSlots > 0 ? (count / totalBookedSlots) * 100 : 0
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5) // Top 5 time slots
        .map(item => ({
          ...item,
          percentage: Math.round(item.percentage * 10) / 10 // Round to 1 decimal place
        }));
      
      // Calculate average session length (in minutes) per booking
      // A session is the average duration of all time slots booked by a single customer
      const avgSessionLengthPerBooking = totalBookings > 0 ? Math.round(totalDuration / totalBookings) : 0;
      
      return {
        bookingRate: Math.round(bookingRate * 10) / 10, // Percentage with 1 decimal place
        totalBookings,
        forecastedIncome: Math.round(totalIncome),
        avgSessionLength: avgSessionLengthPerBooking, // Average minutes per booking
        bookingsByDay: bookingsByDayFormatted,
        popularTimeSlots: timeSlotsSorted
      };
    } catch (error) {
      console.error("Error getting booking stats:", error);
      return {
        bookingRate: 0,
        totalBookings: 0,
        forecastedIncome: 0,
        avgSessionLength: 0,
        bookingsByDay: [],
        popularTimeSlots: []
      };
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private timeSlots: Map<number, TimeSlot>;
  private bookings: Map<number, Booking>;
  private bookingTimeSlots: Map<number, BookingTimeSlot>;
  private operatingHoursMap: Map<number, OperatingHours>;
  private pricingMap: Map<number, Pricing>;
  private configurationMap: Map<string, Configuration>;
  private leadTimeSettingsMap: Map<number, LeadTimeSettings>;
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const newUser: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async adminUserExists(): Promise<boolean> {
    return Array.from(this.users.values()).some(user => user.role === 'admin');
  }
  
  async updateUserLastLogin(id: number): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      user.lastLogin = new Date();
      this.users.set(id, user);
    }
  }
  
  // TimeSlot methods
  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    return this.timeSlots.get(id);
  }
  
  async getTimeSlotsByDateRange(startDate: Date, endDate: Date): Promise<TimeSlot[]> {
    return Array.from(this.timeSlots.values()).filter(slot => {
      const slotDate = new Date(slot.startTime);
      return slotDate >= startDate && slotDate <= endDate;
    });
  }
  
  async createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot> {
    const id = this.currentTimeSlotId++;
    const newTimeSlot: TimeSlot = { ...timeSlot, id };
    this.timeSlots.set(id, newTimeSlot);
    return newTimeSlot;
  }
  
  async updateTimeSlot(id: number, timeSlotData: Partial<TimeSlot>): Promise<TimeSlot | undefined> {
    const timeSlot = await this.getTimeSlot(id);
    if (!timeSlot) {
      return undefined;
    }
    
    const updatedTimeSlot = { ...timeSlot, ...timeSlotData };
    this.timeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }
  
  async blockTimeSlot(id: number, reason: string): Promise<TimeSlot | undefined> {
    return this.updateTimeSlot(id, { status: "blocked", notes: reason });
  }
  
  async regenerateTimeSlots(): Promise<{ success: boolean, preservedBookings: number, conflicts: any[] }> {
    return { success: true, preservedBookings: 0, conflicts: [] };
  }
  
  // Booking methods  
  async getBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }
  
  async getBookingsByEmail(email: string): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(booking => booking.email === email);
  }
  
  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }
  
  async getBookingByReference(reference: string): Promise<Booking | undefined> {
    return Array.from(this.bookings.values()).find(booking => booking.reference === reference);
  }
  
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.currentBookingId++;
    const reference = `WB-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    const newBooking: Booking = { 
      ...booking, 
      id, 
      reference,
      createdAt: new Date()
    };
    
    this.bookings.set(id, newBooking);
    return newBooking;
  }
  
  async updateBooking(id: number, bookingData: Partial<Booking>): Promise<Booking | undefined> {
    const booking = await this.getBooking(id);
    if (!booking) {
      return undefined;
    }
    
    const updatedBooking = { ...booking, ...bookingData };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }
  
  async deleteBooking(id: number): Promise<boolean> {
    return this.bookings.delete(id);
  }
  
  async getBookingTimeSlots(bookingId: number): Promise<TimeSlot[]> {
    const bookingTimeSlotRels = Array.from(this.bookingTimeSlots.values())
      .filter(rel => rel.bookingId === bookingId);
      
    const timeSlotIds = bookingTimeSlotRels.map(rel => rel.timeSlotId);
    
    return Array.from(this.timeSlots.values())
      .filter(slot => timeSlotIds.includes(slot.id));
  }
  
  async addTimeSlotToBooking(bookingTimeSlot: InsertBookingTimeSlot): Promise<BookingTimeSlot> {
    const id = this.currentBookingTimeSlotId++;
    const newBookingTimeSlot: BookingTimeSlot = { ...bookingTimeSlot, id };
    this.bookingTimeSlots.set(id, newBookingTimeSlot);
    return newBookingTimeSlot;
  }
  
  // Configuration methods
  async getOperatingHours(): Promise<OperatingHours[]> {
    return Array.from(this.operatingHoursMap.values());
  }
  
  async updateOperatingHours(id: number, hours: Partial<OperatingHours>): Promise<OperatingHours | undefined> {
    const operatingHours = this.operatingHoursMap.get(id);
    if (!operatingHours) {
      return undefined;
    }
    
    const updatedHours = { ...operatingHours, ...hours };
    this.operatingHoursMap.set(id, updatedHours);
    return updatedHours;
  }
  
  async createOperatingHours(hours: InsertOperatingHours): Promise<OperatingHours> {
    const id = this.currentOperatingHoursId++;
    const newOperatingHours: OperatingHours = { ...hours, id };
    this.operatingHoursMap.set(id, newOperatingHours);
    return newOperatingHours;
  }
  
  async getPricing(): Promise<Pricing[]> {
    return Array.from(this.pricingMap.values());
  }
  
  async updatePricing(id: number, pricingData: Partial<Pricing>): Promise<Pricing | undefined> {
    const pricing = this.pricingMap.get(id);
    if (!pricing) {
      return undefined;
    }
    
    const updatedPricing = { ...pricing, ...pricingData };
    this.pricingMap.set(id, updatedPricing);
    return updatedPricing;
  }
  
  async createPricing(pricingData: InsertPricing): Promise<Pricing> {
    const id = this.currentPricingId++;
    const newPricing: Pricing = { ...pricingData, id };
    this.pricingMap.set(id, newPricing);
    return newPricing;
  }
  
  async getConfiguration(name: string): Promise<Configuration | undefined> {
    return this.configurationMap.get(name);
  }
  
  async updateConfiguration(name: string, value: string): Promise<Configuration | undefined> {
    const config = this.configurationMap.get(name);
    if (!config) {
      return undefined;
    }
    
    config.value = value;
    this.configurationMap.set(name, config);
    return config;
  }
  
  async createConfiguration(config: InsertConfiguration): Promise<Configuration> {
    const newConfig: Configuration = { ...config };
    this.configurationMap.set(config.name, newConfig);
    return newConfig;
  }
  
  async getBookingStats(startDate: Date, endDate: Date): Promise<any> {
    return { totalBookings: this.bookings.size };
  }
  
  // Lead time settings methods
  async getLeadTimeSettings(): Promise<LeadTimeSettings | undefined> {
    const values = Array.from(this.leadTimeSettingsMap.values());
    return values.length > 0 ? values[0] : undefined;
  }
  
  async updateLeadTimeSettings(settings: Partial<LeadTimeSettings>): Promise<LeadTimeSettings | undefined> {
    const existingSettings = await this.getLeadTimeSettings();
    
    if (!existingSettings) {
      // Handle missing required fields if they're not provided
      const fullSettings: InsertLeadTimeSettings = {
        restrictionMode: settings.restrictionMode as "enforced" | "booking_based" | "off" || "off",
        leadTimeDays: settings.leadTimeDays ?? 0,
        operatorOnSite: settings.operatorOnSite ?? false,
      };
      return this.createLeadTimeSettings(fullSettings);
    }
    
    const updatedSettings: LeadTimeSettings = {
      ...existingSettings,
      ...settings,
      // Ensure required fields have values
      restrictionMode: (settings.restrictionMode || existingSettings.restrictionMode) as "enforced" | "booking_based" | "off",
      leadTimeDays: settings.leadTimeDays ?? existingSettings.leadTimeDays,
      operatorOnSite: settings.operatorOnSite ?? existingSettings.operatorOnSite,
      updatedAt: new Date()
    };
    
    this.leadTimeSettingsMap.set(existingSettings.id, updatedSettings);
    return updatedSettings;
  }
  
  async createLeadTimeSettings(settings: InsertLeadTimeSettings): Promise<LeadTimeSettings> {
    const id = this.currentLeadTimeSettingsId++;
    
    const newSettings: LeadTimeSettings = {
      id,
      restrictionMode: settings.restrictionMode,
      leadTimeDays: settings.leadTimeDays,
      operatorOnSite: settings.operatorOnSite,
      updatedAt: new Date()
    };
    
    this.leadTimeSettingsMap.set(id, newSettings);
    return newSettings;
  }
  
  async checkBookingAllowedByLeadTime(date: Date): Promise<{
    allowed: boolean;
    reason?: string;
    leadTimeDays?: number;
    mode?: string;
  }> {
    const settings = await this.getLeadTimeSettings();
    
    // If no settings or mode is off, booking is allowed
    if (!settings || settings.restrictionMode === "off") {
      return { allowed: true };
    }
    
    // If operator is on-site, booking is allowed
    if (settings.operatorOnSite) {
      return { allowed: true, mode: "operator_on_site" };
    }
    
    // Calculate days difference
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if the booking date meets the lead time requirement
    const hasEnoughLeadTime = daysDiff >= settings.leadTimeDays;
    
    // For booking-based mode, check if there are existing bookings for this date
    if (settings.restrictionMode === "booking_based" && !hasEnoughLeadTime) {
      // Get all time slots for this date
      const startOfDay = new Date(bookingDate);
      const endOfDay = new Date(bookingDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const dateSlots = await this.getTimeSlotsByDateRange(startOfDay, endOfDay);
      
      // Check if any slots are booked
      const hasBookings = dateSlots.some(slot => slot.status === "booked");
      
      if (hasBookings) {
        return { 
          allowed: true, 
          mode: "booking_based_override",
          leadTimeDays: settings.leadTimeDays 
        };
      }
    }
    
    // If enforced mode or booking-based mode without existing bookings
    if (!hasEnoughLeadTime) {
      return {
        allowed: false,
        reason: `Booking must be made at least ${settings.leadTimeDays} days in advance.`,
        leadTimeDays: settings.leadTimeDays,
        mode: settings.restrictionMode
      };
    }
    
    return { allowed: true };
  }

  currentUserId: number;
  currentTimeSlotId: number;
  currentBookingId: number;
  currentBookingTimeSlotId: number;
  currentOperatingHoursId: number;
  currentPricingId: number;
  currentConfigurationId: number;
  currentLeadTimeSettingsId: number;

  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.timeSlots = new Map();
    this.bookings = new Map();
    this.bookingTimeSlots = new Map();
    this.operatingHoursMap = new Map();
    this.pricingMap = new Map();
    this.configurationMap = new Map();
    this.leadTimeSettingsMap = new Map();

    this.currentUserId = 1;
    this.currentTimeSlotId = 1;
    this.currentBookingId = 1;
    this.currentBookingTimeSlotId = 1;
    this.currentOperatingHoursId = 1;
    this.currentPricingId = 1;
    this.currentConfigurationId = 1;
    this.currentLeadTimeSettingsId = 1;

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });

    this.initializeDefaults();
  }

  // Implement all interface methods for MemStorage
  // (implementation details omitted for brevity, but would include all methods required by IStorage)
  
  // Lead time settings methods for MemStorage
  async getLeadTimeSettings(): Promise<LeadTimeSettings | undefined> {
    // Get first settings from map or undefined
    if (this.leadTimeSettingsMap.size === 0) return undefined;
    return Array.from(this.leadTimeSettingsMap.values())[0];
  }

  async updateLeadTimeSettings(settings: Partial<LeadTimeSettings>): Promise<LeadTimeSettings | undefined> {
    const existingSettings = await this.getLeadTimeSettings();
    
    if (!existingSettings) {
      return this.createLeadTimeSettings(settings as InsertLeadTimeSettings);
    }
    
    const updatedSettings: LeadTimeSettings = {
      ...existingSettings,
      ...settings,
      updatedAt: new Date()
    };
    
    this.leadTimeSettingsMap.set(existingSettings.id, updatedSettings);
    return updatedSettings;
  }

  async createLeadTimeSettings(settings: InsertLeadTimeSettings): Promise<LeadTimeSettings> {
    const id = this.currentLeadTimeSettingsId++;
    
    const newSettings: LeadTimeSettings = {
      id,
      ...settings,
      updatedAt: new Date()
    };
    
    this.leadTimeSettingsMap.set(id, newSettings);
    return newSettings;
  }

  async checkBookingAllowedByLeadTime(date: Date): Promise<{
    allowed: boolean;
    reason?: string;
    leadTimeDays?: number;
    mode?: string;
  }> {
    // Similar implementation as in DatabaseStorage, but using in-memory data
    const settings = await this.getLeadTimeSettings();
    
    // If no settings or mode is off, booking is allowed
    if (!settings || settings.restrictionMode === "off") {
      return { allowed: true };
    }
    
    // If operator is on-site, booking is allowed
    if (settings.operatorOnSite) {
      return { allowed: true, mode: "operator_on_site" };
    }
    
    // Calculate days difference
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check if the booking date meets the lead time requirement
    const hasEnoughLeadTime = daysDiff >= settings.leadTimeDays;
    
    // For booking-based mode, check if there are existing bookings for this date
    if (settings.restrictionMode === "booking_based" && !hasEnoughLeadTime) {
      // Get all time slots for this date
      const startOfDay = new Date(bookingDate);
      const endOfDay = new Date(bookingDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const dateSlots = await this.getTimeSlotsByDateRange(startOfDay, endOfDay);
      
      // Check if any slots are booked
      const hasBookings = dateSlots.some(slot => slot.status === "booked");
      
      if (hasBookings) {
        return { 
          allowed: true, 
          mode: "booking_based_override",
          leadTimeDays: settings.leadTimeDays 
        };
      }
    }
    
    // If enforced mode or booking-based mode without existing bookings
    if (!hasEnoughLeadTime) {
      return {
        allowed: false,
        reason: `Online booking requires ${settings.leadTimeDays} days lead time`,
        leadTimeDays: settings.leadTimeDays,
        mode: settings.restrictionMode
      };
    }
    
    return { allowed: true, leadTimeDays: settings.leadTimeDays, mode: settings.restrictionMode };
  }
  
  // Initialize default data
  private async initializeDefaults() {
    // Admin user is created in auth.ts
    // Create default lead time settings with same values as in DatabaseStorage
    if (this.leadTimeSettingsMap.size === 0) {
      await this.createLeadTimeSettings({
        restrictionMode: "off",
        leadTimeDays: 0,
        operatorOnSite: false
      });
    }
  }
}

export const storage = new DatabaseStorage();