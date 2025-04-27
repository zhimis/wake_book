import {
  User, InsertUser, TimeSlot, InsertTimeSlot, 
  Booking, InsertBooking, OperatingHours, InsertOperatingHours,
  Pricing, InsertPricing, Configuration, InsertConfiguration,
  BookingTimeSlot, InsertBookingTimeSlot
} from "@shared/schema";
import { nanoid } from 'nanoid';
import session from "express-session";
import createMemoryStore from "memorystore";

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
  reserveTimeSlot(id: number, expiryTime: Date): Promise<TimeSlot | undefined>;
  releaseReservation(id: number): Promise<TimeSlot | undefined>;
  
  // Booking methods
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingByReference(reference: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
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
              status: 'available',
              reservationExpiry: null
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
    return Array.from(this.timeSlots.values()).filter(
      slot => slot.startTime >= startDate && slot.startTime <= endDate
    );
  }
  
  async createTimeSlot(timeSlot: InsertTimeSlot): Promise<TimeSlot> {
    const id = this.currentTimeSlotId++;
    const newTimeSlot: TimeSlot = { ...timeSlot, id };
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
  
  async reserveTimeSlot(id: number, expiryTime: Date): Promise<TimeSlot | undefined> {
    const existingTimeSlot = this.timeSlots.get(id);
    
    if (!existingTimeSlot || existingTimeSlot.status !== 'available') {
      return undefined;
    }
    
    const updatedTimeSlot: TimeSlot = { 
      ...existingTimeSlot, 
      status: 'reserved',
      reservationExpiry: expiryTime
    };
    
    this.timeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }
  
  async releaseReservation(id: number): Promise<TimeSlot | undefined> {
    const existingTimeSlot = this.timeSlots.get(id);
    
    if (!existingTimeSlot || existingTimeSlot.status !== 'reserved') {
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

export const storage = new MemStorage();
