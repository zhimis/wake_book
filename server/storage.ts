import {
  User, InsertUser, TimeSlot, InsertTimeSlot, 
  Booking, InsertBooking, OperatingHours, InsertOperatingHours,
  Pricing, InsertPricing, Configuration, InsertConfiguration,
  BookingTimeSlot, InsertBookingTimeSlot,
  users, timeSlots, bookings, bookingTimeSlots, operatingHours, pricing, configuration
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
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Statistics methods
  getBookingStats(startDate: Date, endDate: Date): Promise<any>;
  
  // Session store
  sessionStore: session.SessionStore;
}

import { db, pool } from "./db";

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

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
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
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
  
  // Public method to regenerate time slots with timezone awareness
  async regenerateTimeSlots(): Promise<{ success: boolean, preservedBookings: number, conflicts: any[] }> {
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
      
      // First find all future time slots with bookings to preserve them
      const bookedTimeSlots = await db.select()
        .from(timeSlots)
        .where(
          and(
            gte(timeSlots.startTime, utcToday),
            eq(timeSlots.status, "booked")
          )
        );
      
      console.log(`Found ${bookedTimeSlots.length} booked time slots to preserve during regeneration`);
      
      // Store detailed information about each booked slot for later reference
      const bookedSlotDetails = bookedTimeSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        price: slot.price
      }));
      
      // Delete all future time slots EXCEPT booked ones
      await db.delete(timeSlots)
        .where(
          and(
            gte(timeSlots.startTime, utcToday),
            not(eq(timeSlots.status, "booked"))
          )
        );
      
      console.log(`Deleted all non-booked future time slots`);
      
      // Now generate new time slots
      await this.generateTimeSlots();
      
      // After regeneration, check for any conflicts - this is more of a sanity check
      // and shouldn't happen due to our delete condition, but we check to be safe
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
        conflicts: conflicts
      };
    } catch (error) {
      console.error("Error regenerating time slots:", error);
      throw error; // Re-throw to handle in the calling function
    }
  }
  
  async getBookings(): Promise<Booking[]> {
    return db.select().from(bookings);
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
    // First get the booking time slots to update their status
    const bookingTimeSlotEntries = await db.select()
      .from(bookingTimeSlots)
      .where(eq(bookingTimeSlots.bookingId, id));
    
    // Update time slots to available
    for (const bts of bookingTimeSlotEntries) {
      await db.update(timeSlots)
        .set({ 
          status: "available"
        })
        .where(eq(timeSlots.id, bts.timeSlotId));
    }
    
    // Delete booking time slots
    await db.delete(bookingTimeSlots)
      .where(eq(bookingTimeSlots.bookingId, id));
    
    // Delete the booking
    const result = await db.delete(bookings).where(eq(bookings.id, id));
    return result.rowCount > 0;
  }
  
  async getBookingTimeSlots(bookingId: number): Promise<TimeSlot[]> {
    const bookingSlots = await db.select({
        timeSlot: timeSlots
      })
      .from(bookingTimeSlots)
      .innerJoin(timeSlots, eq(bookingTimeSlots.timeSlotId, timeSlots.id))
      .where(eq(bookingTimeSlots.bookingId, bookingId));
    
    return bookingSlots.map(item => item.timeSlot);
  }
  
  async addTimeSlotToBooking(bookingTimeSlot: InsertBookingTimeSlot): Promise<BookingTimeSlot> {
    // First update the time slot status to booked
    await db.update(timeSlots)
      .set({
        status: "booked"
      })
      .where(eq(timeSlots.id, bookingTimeSlot.timeSlotId));
    
    // Then add the booking time slot entry
    const [newBookingTimeSlot] = await db.insert(bookingTimeSlots)
      .values(bookingTimeSlot)
      .returning();
    
    return newBookingTimeSlot;
  }
  
  async getOperatingHours(): Promise<OperatingHours[]> {
    return db.select().from(operatingHours);
  }
  
  async updateOperatingHours(id: number, hours: Partial<OperatingHours>): Promise<OperatingHours | undefined> {
    const [updatedHours] = await db.update(operatingHours)
      .set(hours)
      .where(eq(operatingHours.id, id))
      .returning();
    
    // Regenerate time slots after operating hours change
    try {
      await this.regenerateTimeSlots();
      console.log(`Regenerated time slots after operating hours update for day ${updatedHours.dayOfWeek}`);
    } catch (error) {
      console.error("Error regenerating time slots in DatabaseStorage:", error);
    }
    
    return updatedHours;
  }
  
  async createOperatingHours(hours: InsertOperatingHours): Promise<OperatingHours> {
    const [newHours] = await db.insert(operatingHours).values(hours).returning();
    return newHours;
  }
  
  async getPricing(): Promise<Pricing[]> {
    return db.select().from(pricing);
  }
  
  async updatePricing(id: number, pricingData: Partial<Pricing>): Promise<Pricing | undefined> {
    const [updatedPricing] = await db.update(pricing)
      .set(pricingData)
      .where(eq(pricing.id, id))
      .returning();
    
    return updatedPricing;
  }
  
  async createPricing(pricingData: InsertPricing): Promise<Pricing> {
    const [newPricing] = await db.insert(pricing).values(pricingData).returning();
    return newPricing;
  }
  
  async getConfiguration(name: string): Promise<Configuration | undefined> {
    const [config] = await db.select().from(configuration).where(eq(configuration.name, name));
    return config;
  }
  
  async updateConfiguration(name: string, value: string): Promise<Configuration | undefined> {
    const [updatedConfig] = await db.update(configuration)
      .set({ value })
      .where(eq(configuration.name, name))
      .returning();
    
    return updatedConfig;
  }
  
  async createConfiguration(config: InsertConfiguration): Promise<Configuration> {
    const [newConfig] = await db.insert(configuration).values(config).returning();
    return newConfig;
  }
  
  async getBookingStats(startDate: Date, endDate: Date): Promise<any> {
    // Get all bookings in date range
    const bookingsInRange = await db.select()
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, startDate),
          lte(bookings.createdAt, endDate)
        )
      );
    
    const totalBookings = bookingsInRange.length;
    
    // Get time slots for these bookings
    let totalSlots = 0;
    let totalIncome = 0;
    let totalDuration = 0;
    
    const bookingsByDay = new Map<string, number>();
    const timeSlotCounts = new Map<string, number>();
    
    // Initialize days of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => bookingsByDay.set(day, 0));
    
    // Initialize time slots
    for (let hour = 8; hour < 22; hour++) {
      for (let minute of [0, 30]) {
        const timeKey = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        timeSlotCounts.set(timeKey, 0);
      }
    }
    
    // Process each booking
    for (const booking of bookingsInRange) {
      const bookingDate = new Date(booking.createdAt);
      
      // Add to day counts
      const dayOfWeek = days[bookingDate.getDay()];
      bookingsByDay.set(dayOfWeek, (bookingsByDay.get(dayOfWeek) || 0) + 1);
      
      // Get time slots for this booking
      const bookingSlots = await this.getBookingTimeSlots(booking.id);
      
      totalSlots += bookingSlots.length;
      totalIncome += bookingSlots.reduce((sum, slot) => sum + slot.price, 0);
      
      // Count time slot popularity
      for (const slot of bookingSlots) {
        const slotDate = new Date(slot.startTime);
        const timeKey = `${slotDate.getHours().toString().padStart(2, '0')}:${slotDate.getMinutes().toString().padStart(2, '0')}`;
        
        timeSlotCounts.set(timeKey, (timeSlotCounts.get(timeKey) || 0) + 1);
        
        if (bookingSlots.length > 0) {
          totalDuration += 30; // Each slot is 30 minutes
        }
      }
    }
    
    // Calculate booking rate (% of total time slots that were booked)
    const totalAvailableSlots = (await this.getTimeSlotsByDateRange(startDate, endDate)).length;
    const bookingRate = totalAvailableSlots > 0 ? (totalSlots / totalAvailableSlots) * 100 : 0;
    
    // Format booking by day percentages
    const bookingsByDayFormatted = days.map(day => {
      const count = bookingsByDay.get(day) || 0;
      return {
        day,
        count,
        percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0
      };
    });
    
    // Find most popular time slots
    const timeSlotsSorted = Array.from(timeSlotCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([time, count]) => ({
        time,
        percentage: totalSlots > 0 ? (count / totalSlots) * 100 : 0
      }));
    
    return {
      bookingRate: parseFloat(bookingRate.toFixed(1)),
      totalBookings,
      forecastedIncome: totalIncome,
      avgSessionLength: totalBookings > 0 ? totalDuration / totalBookings : 0,
      bookingsByDay: bookingsByDayFormatted,
      popularTimeSlots: timeSlotsSorted
    };
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
  
  currentUserId: number;
  currentTimeSlotId: number;
  currentBookingId: number;
  currentBookingTimeSlotId: number;
  currentOperatingHoursId: number;
  currentPricingId: number;
  currentConfigurationId: number;
  
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.timeSlots = new Map();
    this.bookings = new Map();
    this.bookingTimeSlots = new Map();
    this.operatingHoursMap = new Map();
    this.pricingMap = new Map();
    this.configurationMap = new Map();
    
    this.currentUserId = 1;
    this.currentTimeSlotId = 1;
    this.currentBookingId = 1;
    this.currentBookingTimeSlotId = 1;
    this.currentOperatingHoursId = 1;
    this.currentPricingId = 1;
    this.currentConfigurationId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize with default data
    this.initializeDefaults();
  }
  
  private async initializeDefaults() {
    // Create default operating hours for each day of the week
    for (let i = 0; i < 7; i++) {
      await this.createOperatingHours({
        dayOfWeek: i,
        openTime: new Date(`1970-01-01T09:00:00`),
        closeTime: new Date(`1970-01-01T18:00:00`),
        isClosed: i === 1 // Mondays closed by default
      });
    }
    
    // Create default pricing options
    await this.createPricing({
      name: 'standard',
      price: 50,
      startTime: null,
      endTime: null,
      applyToWeekends: false,
      weekendMultiplier: null
    });
    
    await this.createPricing({
      name: 'peak',
      price: 60,
      startTime: new Date(`1970-01-01T12:00:00`),
      endTime: new Date(`1970-01-01T16:00:00`),
      applyToWeekends: false,
      weekendMultiplier: null
    });
    
    await this.createPricing({
      name: 'weekend',
      price: 0, // Base price not used for weekends
      startTime: null,
      endTime: null,
      applyToWeekends: true,
      weekendMultiplier: 1.2
    });
    
    // Create default configurations
    await this.createConfiguration({
      name: 'visibility_weeks',
      value: '4'
    });
    
    // Generate timeslots for the next 4 weeks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 28); // 4 weeks
    
    let currentDate = new Date(today);
    
    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();
      const operatingHours = Array.from(this.operatingHoursMap.values())
        .find(oh => oh.dayOfWeek === dayOfWeek);
      
      // Skip if the day is closed
      if (operatingHours && !operatingHours.isClosed) {
        const openHour = new Date(operatingHours.openTime).getHours();
        const closeHour = new Date(operatingHours.closeTime).getHours();
        
        // Create 30-minute slots
        for (let hour = openHour; hour < closeHour; hour++) {
          for (let minute of [0, 30]) {
            const startTime = new Date(currentDate);
            startTime.setHours(hour, minute, 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 30);
            
            // Determine price based on time and day
            const standardPricing = Array.from(this.pricingMap.values())
              .find(p => p.name === 'standard');
            
            const peakPricing = Array.from(this.pricingMap.values())
              .find(p => p.name === 'peak');
            
            const weekendPricing = Array.from(this.pricingMap.values())
              .find(p => p.name === 'weekend');
            
            let price = standardPricing ? standardPricing.price : 50; // Default
            
            // Check if it's peak hours
            if (peakPricing) {
              const peakStart = new Date(peakPricing.startTime as Date).getHours();
              const peakEnd = new Date(peakPricing.endTime as Date).getHours();
              
              if (hour >= peakStart && hour < peakEnd) {
                price = peakPricing.price;
              }
            }
            
            // Apply weekend multiplier if applicable
            if (weekendPricing && weekendPricing.applyToWeekends && 
                (dayOfWeek === 0 || dayOfWeek === 6)) { // Saturday or Sunday
              price = price * (weekendPricing.weekendMultiplier as number);
            }
            
            await this.createTimeSlot({
              startTime,
              endTime,
              price,
              status: 'available'
            });
          }
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // TimeSlot methods
  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    return this.timeSlots.get(id);
  }
  
  async getTimeSlotsByDateRange(startDate: Date, endDate: Date): Promise<TimeSlot[]> {
    // We need to find slots that overlap with the given range,
    // not just slots whose start time is in the range
    return Array.from(this.timeSlots.values()).filter(slot => {
      // Check for different types of overlaps
      const slotStart = new Date(slot.startTime);
      const slotEnd = new Date(slot.endTime);
      
      // Case 1: Slot starts within the range
      const startWithinRange = slotStart >= startDate && slotStart < endDate;
      
      // Case 2: Slot ends within the range
      const endWithinRange = slotEnd > startDate && slotEnd <= endDate;
      
      // Case 3: Slot completely contains the range
      const containsRange = slotStart <= startDate && slotEnd >= endDate;
      
      return startWithinRange || endWithinRange || containsRange;
    });
  }
  
  async createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot> {
    const id = this.currentTimeSlotId++;
    // Ensure storageTimezone is always set, defaulting to UTC if not provided
    const newTimeSlot: TimeSlot = { 
      ...timeSlot, 
      id,
      status: timeSlot.status || 'available', // Ensure status is set
      storageTimezone: timeSlot.storageTimezone || 'UTC' // Ensure storageTimezone is set
    };
    this.timeSlots.set(id, newTimeSlot);
    return newTimeSlot;
  }
  
  async updateTimeSlot(id: number, timeSlot: Partial<TimeSlot>): Promise<TimeSlot | undefined> {
    const existingTimeSlot = this.timeSlots.get(id);
    
    if (!existingTimeSlot) {
      return undefined;
    }
    
    const updatedTimeSlot = { ...existingTimeSlot, ...timeSlot };
    this.timeSlots.set(id, updatedTimeSlot);
    
    return updatedTimeSlot;
  }
  
  async temporaryHoldTimeSlot(id: number, expiryTime: Date): Promise<TimeSlot | undefined> {
    const existingTimeSlot = this.timeSlots.get(id);
    
    if (!existingTimeSlot || existingTimeSlot.status !== 'available') {
      return undefined;
    }
    
    const updatedTimeSlot: TimeSlot = { 
      ...existingTimeSlot, 
      status: 'booked',
      reservationExpiry: expiryTime
    };
    
    this.timeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }
  
  async releaseReservation(id: number): Promise<TimeSlot | undefined> {
    const existingTimeSlot = this.timeSlots.get(id);
    
    if (!existingTimeSlot || existingTimeSlot.status !== 'booked' || !existingTimeSlot.reservationExpiry) {
      return undefined;
    }
    
    const updatedTimeSlot: TimeSlot = { 
      ...existingTimeSlot, 
      status: 'available',
      reservationExpiry: null
    };
    
    this.timeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }
  
  async blockTimeSlot(id: number, reason: string): Promise<TimeSlot | undefined> {
    const existingTimeSlot = this.timeSlots.get(id);
    
    if (!existingTimeSlot) {
      return undefined;
    }
    
    // Instead of updating to blocked status, we'll delete the time slot entirely
    // This will make it appear as an unallocated gray slot in the UI
    const removedTimeSlot = {...existingTimeSlot};
    this.timeSlots.delete(id);
    
    // Store the reason in configuration
    const configId = this.currentConfigurationId++;
    this.configurationMap.set(`block_reason_${id}`, {
      id: configId,
      name: `block_reason_${id}`,
      value: reason
    });
    
    return removedTimeSlot;
  }
  
  async regenerateTimeSlots(): Promise<{ success: boolean, preservedBookings: number, conflicts: any[] }> {
    // Clear existing time slots for future dates while preserving booked slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all booked time slots to preserve
    const bookedTimeSlots: TimeSlot[] = [];
    for (const [id, slot] of this.timeSlots.entries()) {
      if (slot.startTime >= today && slot.status === "booked") {
        bookedTimeSlots.push(slot);
      }
    }
    
    console.log(`Found ${bookedTimeSlots.length} booked time slots to preserve during regeneration`);
    
    // Create a new map with only past time slots and booked future slots
    const newTimeSlotsMap = new Map<number, TimeSlot>();
    this.timeSlots.forEach((timeSlot, id) => {
      const slotDate = new Date(timeSlot.startTime);
      if (slotDate < today) {
        newTimeSlotsMap.set(id, timeSlot);
      }
    });
    
    this.timeSlots = newTimeSlotsMap;
    
    // Regenerate future time slots
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 28); // 4 weeks
    
    let currentDate = new Date(today);
    
    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();
      const operatingHours = Array.from(this.operatingHoursMap.values())
        .find(oh => oh.dayOfWeek === dayOfWeek);
      
      // Skip if the day is closed
      if (operatingHours && !operatingHours.isClosed) {
        const [openHour, openMinute] = operatingHours.openTime.split(':').map(Number);
        const [closeHour, closeMinute] = operatingHours.closeTime.split(':').map(Number);
        
        // Create time slots in 30-minute increments
        for (let hour = openHour; hour < closeHour; hour++) {
          for (let minute of [0, 30]) {
            // Skip if we're at opening time but have non-zero minutes
            if (hour === openHour && minute < openMinute) continue;
            
            // Skip if we're at closing time
            if (hour === closeHour - 1 && minute >= closeMinute) continue;
            
            const startTime = new Date(currentDate);
            startTime.setHours(hour, minute, 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 30);
            
            // Determine price based on time and day
            const standardPricing = Array.from(this.pricingMap.values())
              .find(p => p.name === 'standard');
            const peakPricing = Array.from(this.pricingMap.values())
              .find(p => p.name === 'peak');
            const weekendPricing = Array.from(this.pricingMap.values())
              .find(p => p.name === 'weekend');
            
            let price = standardPricing ? standardPricing.price : 50; // Default
            
            // Check if it's peak hours
            if (peakPricing && peakPricing.startTime && peakPricing.endTime) {
              const [peakStartHour, peakStartMinute] = peakPricing.startTime.split(':').map(Number);
              const [peakEndHour, peakEndMinute] = peakPricing.endTime.split(':').map(Number);
              
              const isPeakHour = 
                (hour > peakStartHour || (hour === peakStartHour && minute >= peakStartMinute)) && 
                (hour < peakEndHour || (hour === peakEndHour && minute < peakEndMinute));
              
              if (isPeakHour) {
                price = peakPricing.price;
              }
            }
            
            // Apply weekend multiplier if applicable
            if (weekendPricing && weekendPricing.applyToWeekends && 
                (dayOfWeek === 0 || dayOfWeek === 6)) { // Saturday or Sunday
              price = price * (weekendPricing.weekendMultiplier || 1.2);
            }
            
            // Create a new time slot
            const timeSlotId = this.currentTimeSlotId++;
            this.timeSlots.set(timeSlotId, {
              id: timeSlotId,
              startTime,
              endTime,
              price: Math.round(price), // Round to nearest whole number
              status: 'available',
              storageTimezone: 'UTC' // Add the required storageTimezone field
            });
          }
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log("Time slots regenerated successfully in MemStorage.");
    
    // Check for overlaps between new available slots and existing booked slots
    const conflicts = [];
    
    // Create a map of times that are already booked
    const bookedTimesMap = new Map();
    for (const bookedSlot of bookedTimeSlots) {
      // Use the rounded hour/minute as key to detect overlapping slots
      const start = new Date(bookedSlot.startTime);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}-${start.getHours()}-${start.getMinutes()}`;
      bookedTimesMap.set(key, bookedSlot);
    }
    
    console.log(`Checking ${this.timeSlots.size} newly generated slots against ${bookedTimesMap.size} booked slots`);
    
    // Check if any newly created available slots overlap with booked slots
    const overlappingSlots = [];
    for (const [newId, newSlot] of this.timeSlots.entries()) {
      if (newSlot.status === 'available') {
        const newStart = new Date(newSlot.startTime);
        const key = `${newStart.getFullYear()}-${newStart.getMonth()}-${newStart.getDate()}-${newStart.getHours()}-${newStart.getMinutes()}`;
        
        // If this time is already booked, delete the new available slot to avoid conflict
        if (bookedTimesMap.has(key)) {
          console.log(`Removing conflicting new available slot ${newId} that overlaps with booked slot`);
          this.timeSlots.delete(newId);
          overlappingSlots.push(newId);
          conflicts.push({
            newSlotId: newId,
            bookedSlotId: bookedTimesMap.get(key).id,
            time: newStart.toISOString()
          });
        }
      }
    }
    
    console.log(`Removed ${overlappingSlots.length} overlapping available slots`);
    
    // Restore the booked time slots after removing conflicts
    for (const bookedSlot of bookedTimeSlots) {
      this.timeSlots.set(bookedSlot.id, bookedSlot);
    }
    
    return {
      success: true,
      preservedBookings: bookedTimeSlots.length,
      conflicts: conflicts
    };
  }
  
  async getBookings(): Promise<Booking[]> {
    return Array.from(this.bookings.values());
  }
  
  // Booking methods
  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }
  
  async getBookingByReference(reference: string): Promise<Booking | undefined> {
    return Array.from(this.bookings.values()).find(
      booking => booking.reference === reference
    );
  }
  
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.currentBookingId++;
    const reference = `WB-${nanoid(8).toUpperCase()}`;
    
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
    try {
      // Get existing booking
      const existingBooking = this.bookings.get(id);
      if (!existingBooking) {
        return undefined;
      }
      
      // Create a copy of the booking data to update
      const safeUpdate = { ...bookingData };
      
      // Don't allow changing reference or createdAt fields
      delete safeUpdate.reference;
      delete safeUpdate.createdAt;
      
      // Merge existing booking with updates
      const updatedBooking: Booking = {
        ...existingBooking,
        ...safeUpdate
      };
      
      // Update in our map
      this.bookings.set(id, updatedBooking);
      
      return updatedBooking;
    } catch (error) {
      console.error("Error updating booking in MemStorage:", error);
      return undefined;
    }
  }
  
  async deleteBooking(id: number): Promise<boolean> {
    // First find and delete all associated booking time slots
    const bookingTimeSlotEntries = Array.from(this.bookingTimeSlots.values())
      .filter(bts => bts.bookingId === id);
    
    for (const bts of bookingTimeSlotEntries) {
      // Free up the time slot
      const timeSlot = this.timeSlots.get(bts.timeSlotId);
      if (timeSlot) {
        timeSlot.status = 'available';
        timeSlot.reservationExpiry = null;
        this.timeSlots.set(timeSlot.id, timeSlot);
      }
      
      // Delete the booking time slot entry
      this.bookingTimeSlots.delete(bts.id);
    }
    
    // Now delete the booking
    return this.bookings.delete(id);
  }
  
  async getBookingTimeSlots(bookingId: number): Promise<TimeSlot[]> {
    const bookingTimeSlotEntries = Array.from(this.bookingTimeSlots.values())
      .filter(bts => bts.bookingId === bookingId);
    
    const timeSlotIds = bookingTimeSlotEntries.map(bts => bts.timeSlotId);
    
    return Array.from(this.timeSlots.values())
      .filter(ts => timeSlotIds.includes(ts.id));
  }
  
  async addTimeSlotToBooking(bookingTimeSlot: InsertBookingTimeSlot): Promise<BookingTimeSlot> {
    const id = this.currentBookingTimeSlotId++;
    const newBookingTimeSlot: BookingTimeSlot = { ...bookingTimeSlot, id };
    this.bookingTimeSlots.set(id, newBookingTimeSlot);
    
    // Update the time slot status to booked
    const timeSlot = this.timeSlots.get(bookingTimeSlot.timeSlotId);
    if (timeSlot) {
      timeSlot.status = 'booked';
      timeSlot.reservationExpiry = null;
      this.timeSlots.set(timeSlot.id, timeSlot);
    }
    
    return newBookingTimeSlot;
  }
  
  // Operating hours methods
  async getOperatingHours(): Promise<OperatingHours[]> {
    return Array.from(this.operatingHoursMap.values());
  }
  
  async updateOperatingHours(id: number, hours: Partial<OperatingHours>): Promise<OperatingHours | undefined> {
    const existingHours = this.operatingHoursMap.get(id);
    
    if (!existingHours) {
      return undefined;
    }
    
    const updatedHours = { ...existingHours, ...hours };
    this.operatingHoursMap.set(id, updatedHours);
    
    // Regenerate time slots after operating hours change
    try {
      await this.regenerateTimeSlots();
      console.log(`Regenerated time slots after operating hours update for day ${updatedHours.dayOfWeek}`);
    } catch (error) {
      console.error("Error regenerating time slots in MemStorage:", error);
    }
    
    return updatedHours;
  }
  
  async createOperatingHours(hours: InsertOperatingHours): Promise<OperatingHours> {
    const id = this.currentOperatingHoursId++;
    const newHours: OperatingHours = { ...hours, id };
    this.operatingHoursMap.set(id, newHours);
    return newHours;
  }
  
  // Pricing methods
  async getPricing(): Promise<Pricing[]> {
    return Array.from(this.pricingMap.values());
  }
  
  async updatePricing(id: number, pricing: Partial<Pricing>): Promise<Pricing | undefined> {
    const existingPricing = this.pricingMap.get(id);
    
    if (!existingPricing) {
      return undefined;
    }
    
    const updatedPricing = { ...existingPricing, ...pricing };
    this.pricingMap.set(id, updatedPricing);
    
    return updatedPricing;
  }
  
  async createPricing(pricing: InsertPricing): Promise<Pricing> {
    const id = this.currentPricingId++;
    const newPricing: Pricing = { ...pricing, id };
    this.pricingMap.set(id, newPricing);
    return newPricing;
  }
  
  // Configuration methods
  async getConfiguration(name: string): Promise<Configuration | undefined> {
    return Array.from(this.configurationMap.values()).find(
      config => config.name === name
    );
  }
  
  async updateConfiguration(name: string, value: string): Promise<Configuration | undefined> {
    const existingConfig = Array.from(this.configurationMap.values()).find(
      config => config.name === name
    );
    
    if (!existingConfig) {
      return undefined;
    }
    
    const updatedConfig = { ...existingConfig, value };
    this.configurationMap.set(existingConfig.id.toString(), updatedConfig);
    
    return updatedConfig;
  }
  
  async createConfiguration(config: InsertConfiguration): Promise<Configuration> {
    const id = this.currentConfigurationId++;
    const newConfig: Configuration = { ...config, id };
    this.configurationMap.set(newConfig.name, newConfig);
    return newConfig;
  }
  
  // Statistics methods
  async getBookingStats(startDate: Date, endDate: Date): Promise<any> {
    // Get bookings in date range
    const bookingsInRange: Booking[] = [];
    const bookingTimeSlotMap: Map<number, TimeSlot[]> = new Map();
    
    // First get all time slots in the range
    const timeSlotsInRange = await this.getTimeSlotsByDateRange(startDate, endDate);
    
    // Group time slots by booking
    for (const timeSlot of timeSlotsInRange) {
      if (timeSlot.status === 'booked') {
        // Find which booking this time slot belongs to
        const bookingTimeSlot = Array.from(this.bookingTimeSlots.values()).find(
          bts => bts.timeSlotId === timeSlot.id
        );
        
        if (bookingTimeSlot) {
          const booking = this.bookings.get(bookingTimeSlot.bookingId);
          
          if (booking) {
            if (!bookingsInRange.some(b => b.id === booking.id)) {
              bookingsInRange.push(booking);
            }
            
            if (!bookingTimeSlotMap.has(booking.id)) {
              bookingTimeSlotMap.set(booking.id, []);
            }
            
            bookingTimeSlotMap.get(booking.id)?.push(timeSlot);
          }
        }
      }
    }
    
    // Calculate booking rate
    const totalSlots = timeSlotsInRange.length;
    const bookedSlots = timeSlotsInRange.filter(ts => ts.status === 'booked').length;
    const bookingRate = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;
    
    // Calculate forecasted income
    let forecastedIncome = 0;
    for (const timeSlot of timeSlotsInRange) {
      if (timeSlot.status === 'booked') {
        forecastedIncome += timeSlot.price;
      }
    }
    
    // Add equipment rental income
    for (const booking of bookingsInRange) {
      if (booking.equipmentRental) {
        forecastedIncome += 30; // $30 per equipment rental
      }
    }
    
    // Calculate average session length
    let totalSessionHours = 0;
    for (const [bookingId, timeSlots] of bookingTimeSlotMap.entries()) {
      // Each time slot is 30 minutes
      totalSessionHours += (timeSlots.length * 0.5);
    }
    
    const avgSessionLength = bookingsInRange.length > 0 ? 
      totalSessionHours / bookingsInRange.length : 0;
    
    // Calculate bookings by day of week
    const bookingsByDay = [0, 0, 0, 0, 0, 0, 0]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    
    for (const [bookingId, timeSlots] of bookingTimeSlotMap.entries()) {
      // Take the first time slot to determine the day
      if (timeSlots.length > 0) {
        const dayOfWeek = new Date(timeSlots[0].startTime).getDay();
        bookingsByDay[dayOfWeek]++;
      }
    }
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totalBookings = bookingsInRange.length;
    
    const bookingsByDayFormatted = bookingsByDay.map((count, index) => ({
      day: dayNames[index],
      count,
      percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0
    }));
    
    // Calculate popular time slots
    const timeSlotCounts: Record<string, number> = {};
    
    for (const timeSlot of timeSlotsInRange) {
      if (timeSlot.status === 'booked') {
        const hour = new Date(timeSlot.startTime).getHours();
        const timeKey = `${hour}:00`;
        
        if (!timeSlotCounts[timeKey]) {
          timeSlotCounts[timeKey] = 0;
        }
        
        timeSlotCounts[timeKey]++;
      }
    }
    
    const popularTimeSlots = Object.entries(timeSlotCounts)
      .map(([time, count]) => ({
        time,
        percentage: bookedSlots > 0 ? (count / bookedSlots) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5); // Top 5
    
    return {
      bookingRate,
      totalBookings,
      forecastedIncome,
      avgSessionLength,
      bookingsByDay: bookingsByDayFormatted,
      popularTimeSlots
    };
  }
}

export const storage = new DatabaseStorage();
