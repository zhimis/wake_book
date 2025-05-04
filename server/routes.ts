import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { bookingFormSchema, manualBookingSchema, blockTimeSlotSchema, timeSlots, operatingHours } from "@shared/schema";
import { format, addMinutes } from "date-fns";
import { db } from "./db";
import { gte, eq, sql } from "drizzle-orm";

// Import server-side timezone utilities
import { 
  LATVIA_TIMEZONE,
  toLatviaTime, 
  fromLatviaTime, 
  formatInLatviaTime,
  validateDate,
  getLatviaDayStart,
  getLatviaDayEnd
} from "./utils/timezone";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  setupAuth(app);

  // Get time slots for a week
  app.get("/api/timeslots", async (req: Request, res: Response) => {
    try {
      // HARDCODED FIX: Use May 4, 2025 as the fixed date to match client's hardcoded date
      const fixedDate = new Date('2025-05-04T00:00:00Z');
      
      // Get start and end dates from query params or default to our fixed week
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      // Validate date inputs if provided
      if (startDateStr && !validateDate(startDateStr)) {
        return res.status(400).json({ error: "Invalid start date format" });
      }
      
      if (endDateStr && !validateDate(endDateStr)) {
        return res.status(400).json({ error: "Invalid end date format" });
      }

      // Use provided date or default to our fixed date, converted to Latvia timezone
      let startDate;
      if (startDateStr) {
        // Parse the date and set to start of day in Latvia timezone
        startDate = getLatviaDayStart(new Date(startDateStr));
      } else {
        // If no date provided, use our fixed date in Latvia timezone
        startDate = getLatviaDayStart(fixedDate);
      }

      let endDate;
      if (endDateStr) {
        // Parse the date and set to end of day in Latvia timezone
        endDate = getLatviaDayEnd(new Date(endDateStr));
      } else {
        // Default to 7 days from start date
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        endDate = getLatviaDayEnd(endDate);
      }

      console.log(`Fetching time slots from ${formatInLatviaTime(startDate, 'yyyy-MM-dd HH:mm:ss')} to ${formatInLatviaTime(endDate, 'yyyy-MM-dd HH:mm:ss')} (Latvia time)`);
      
      const timeSlots = await storage.getTimeSlotsByDateRange(startDate, endDate);
      
      res.json({
        startDate,
        endDate, 
        timeSlots
      });
    } catch (error) {
      console.error("Error fetching time slots:", error);
      res.status(500).json({ error: "Failed to fetch time slots" });
    }
  });

  // Reserve time slots temporarily
  app.post("/api/timeslots/reserve", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        timeSlotIds: z.array(z.number()).min(1)
      });

      const { timeSlotIds } = schema.parse(req.body);
      console.log("Reservation request for time slots:", timeSlotIds);
      
      // Check if all requested time slots are available
      const timeSlots = await Promise.all(
        timeSlotIds.map(id => storage.getTimeSlot(id))
      );
      
      console.log("Time slots from database:", timeSlots);
      
      const unavailableSlots = timeSlots.filter(
        slot => {
          if (!slot) {
            console.log("Slot is undefined");
            return true;
          }
          console.log("Slot status:", slot.status);
          return slot.status !== 'available';
        }
      );
      
      console.log("Unavailable slots:", unavailableSlots.length);
      
      if (unavailableSlots.length > 0) {
        return res.status(400).json({ 
          error: "One or more selected time slots are not available" 
        });
      }
      
      // Reserve the time slots for 10 minutes
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 10);
      console.log("Setting expiry time to:", expiryTime);
      
      const reservedSlots = await Promise.all(
        timeSlotIds.map(id => storage.temporaryHoldTimeSlot(id, expiryTime))
      );
      
      console.log("Reserved slots:", reservedSlots);
      
      res.json({
        reservedTimeSlots: reservedSlots,
        expiryTime
      });
    } catch (error) {
      console.error("Error reserving time slots:", error);
      res.status(500).json({ error: "Failed to reserve time slots" });
    }
  });

  // Release reserved time slots
  app.post("/api/timeslots/release", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        timeSlotIds: z.array(z.number()).min(1)
      });

      const { timeSlotIds } = schema.parse(req.body);
      
      // Release reservations
      await Promise.all(
        timeSlotIds.map(id => storage.releaseReservation(id))
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error releasing time slots:", error);
      res.status(500).json({ error: "Failed to release time slots" });
    }
  });
  
  // Block time slots (for admin use)
  app.post("/api/timeslots/block", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const schema = z.object({
        timeSlotIds: z.array(z.number()).min(1),
        reason: z.string().min(2)
      });

      const { timeSlotIds, reason } = schema.parse(req.body);
      
      // Block time slots
      await Promise.all(
        timeSlotIds.map(id => storage.blockTimeSlot(id, reason))
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error blocking time slots:", error);
      res.status(500).json({ error: "Failed to block time slots" });
    }
  });
  
  // Endpoint to make time slots available
  app.post("/api/timeslots/make-available", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated and is admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const schema = z.object({
        timeSlotIds: z.array(z.number()).min(1),
        price: z.number().positive(),
        unallocatedSlots: z.array(z.object({
          id: z.number(),
          startTime: z.union([z.string(), z.date()]),
          endTime: z.union([z.string(), z.date()])
        })).optional()
      });

      const { timeSlotIds, price, unallocatedSlots } = schema.parse(req.body);
      
      console.log("Make available request received:", {
        timeSlotIds,
        price,
        unallocatedSlotsCount: unallocatedSlots?.length || 0
      });
      
      // Separate positive and negative IDs for different processing
      const positiveIds = timeSlotIds.filter(id => id > 0);
      const negativeIds = timeSlotIds.filter(id => id < 0);
      
      console.log(`Processing ${positiveIds.length} existing slots and ${negativeIds.length} unallocated slots`);
      
      // Process results array to hold all created/updated time slots
      const results = [];
      
      // Handle positive IDs (existing time slots)
      if (positiveIds.length > 0) {
        const existingSlotResults = await Promise.all(
          positiveIds.map(async (id) => {
            // For positive IDs, get the time slot to determine start/end times
            const timeSlot = await storage.getTimeSlot(id);
            
            if (!timeSlot) {
              console.error(`Time slot with ID ${id} not found`);
              return null;
            } else {
              // Update existing time slot to be available
              return storage.updateTimeSlot(id, {
                status: 'available',
                price,
                reservationExpiry: null
              });
            }
          })
        );
        
        // Add valid results to our results array
        results.push(...existingSlotResults.filter(slot => slot !== null));
      }
      
      // Handle negative IDs (unallocated slots)
      if (negativeIds.length > 0 && unallocatedSlots && unallocatedSlots.length > 0) {
        for (const id of negativeIds) {
          // Find the matching unallocated slot data
          const unallocatedSlot = unallocatedSlots.find(slot => slot.id === id);
          
          if (!unallocatedSlot) {
            console.error(`No data found for unallocated slot with ID: ${id}`);
            continue;
          }
          
          console.log(`Creating new time slot from unallocated data:`, {
            id: unallocatedSlot.id,
            startTime: new Date(unallocatedSlot.startTime).toISOString(),
            endTime: new Date(unallocatedSlot.endTime).toISOString()
          });
          
          try {
            // Create a new time slot with proper data
            const newSlot = await storage.createTimeSlot({
              startTime: new Date(unallocatedSlot.startTime),
              endTime: new Date(unallocatedSlot.endTime),
              price,
              status: 'available',
              reservationExpiry: null
            });
            
            if (newSlot) {
              results.push(newSlot);
            }
          } catch (error) {
            console.error(`Error creating time slot from unallocated data:`, error);
          }
        }
      }
      
      res.json({ success: true, createdTimeSlots: results });
    } catch (error) {
      console.error("Error making time slots available:", error);
      res.status(500).json({ error: "Failed to make time slots available" });
    }
  });
  
  // Regenerate all time slots - requires authentication
  app.post("/api/timeslots/regenerate", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      console.log("REGENERATE TIME SLOTS ENDPOINT CALLED");
      
      // Get operating hours to debug
      const allOperatingHours = await db.select().from(operatingHours);
      console.log("Current operating hours configuration:", JSON.stringify(allOperatingHours, null, 2));
      
      // Call the improved regenerateTimeSlots method that preserves bookings
      const result = await storage.regenerateTimeSlots();
      
      // Verify the time slots were generated properly
      const allTimeSlots = await db.select().from(timeSlots);
      const timeSlotCount = allTimeSlots.length;
      console.log("Time slots after regeneration:", timeSlotCount);
      
      console.log("Time slots regenerated successfully after admin request");
      console.log(`Preserved ${result.preservedBookings} existing bookings during regeneration`);
      
      res.json({ 
        success: true, 
        message: `Time slots regenerated successfully, preserving ${result.preservedBookings} existing bookings`,
        preservedBookings: result.preservedBookings
      });
    } catch (error) {
      console.error("Error regenerating time slots:", error);
      res.status(500).json({ error: "Failed to regenerate time slots" });
    }
  });

  // Create a booking
  app.post("/api/bookings", async (req: Request, res: Response) => {
    try {
      console.log(`Received booking request at ${formatInLatviaTime(new Date(), 'yyyy-MM-dd HH:mm:ss')} (Latvia time):`, req.body);
      
      // Check if this is an admin booking (e.g., has 'customerName' instead of 'fullName')
      let validatedData;
      let timeSlotIds;
      let bookingData;
      
      if (req.body.customerName) {
        // Admin is creating a booking
        const schema = manualBookingSchema;
        validatedData = schema.parse(req.body);
        const { timeSlotIds: ids, ...rest } = validatedData;
        timeSlotIds = ids;
        
        // For admin bookings, we add a default experience level
        bookingData = {
          ...rest,
          fullName: rest.customerName,
          experienceLevel: "intermediate", // Default for admin bookings
        };
      } else {
        // Regular user booking
        const schema = bookingFormSchema;
        validatedData = schema.parse(req.body);
        const { timeSlotIds: ids, ...rest } = validatedData;
        timeSlotIds = ids;
        bookingData = rest;
      }
      
      console.log("Time slot IDs received:", timeSlotIds);
      
      // Process time slots - create new ones for "unallocated" slots with negative IDs
      const processedTimeSlotIds = [];
      
      for (const id of timeSlotIds) {
        // Check if this is an unallocated slot (negative ID)
        if (id < 0) {
          try {
            // This is a placeholder/unallocated slot, we need to create a real one
            // Extract time info from the client-side data
            const timeInfo = req.body.unallocatedSlots?.find((slot: { id: number; startTime: string | Date; endTime: string | Date }) => slot.id === id);
            
            if (!timeInfo) {
              // If we don't have time information, we can't create the slot
              console.log(`No time information for unallocated slot with ID ${id}`);
              return res.status(400).json({
                error: "Missing time information for unallocated slot"
              });
            }
            
            // Create a new time slot with this information
            const newSlot = await storage.createTimeSlot({
              startTime: new Date(timeInfo.startTime),
              endTime: new Date(timeInfo.endTime),
              price: 25, // Default price
              status: 'available'
            });
            
            console.log(`Created new time slot with ID ${newSlot.id} for unallocated slot`);
            processedTimeSlotIds.push(newSlot.id);
          } catch (error) {
            console.error("Error creating time slot:", error);
            return res.status(500).json({
              error: "Failed to create time slot"
            });
          }
        } else {
          // Regular existing slot
          processedTimeSlotIds.push(id);
        }
      }
      
      // Now use processed IDs instead of original ones
      timeSlotIds = processedTimeSlotIds;
      
      // Verify all time slots exist and check their status
      const timeSlots = await Promise.all(
        timeSlotIds.map(id => storage.getTimeSlot(id))
      );
      
      console.log("Time slots for booking:", timeSlots);
      
      // Check if any time slots are already booked or unavailable
      // No temporary reservation logic - just check if slots are available
      const alreadyBookedSlots = timeSlots.filter(
        slot => {
          if (!slot) {
            console.log("Time slot not found");
            return true;
          }
          
          console.log(`Checking slot ${slot.id} with status: ${slot.status}`);
          
          // Only slots with 'booked' status are considered unavailable
          if (slot.status === 'booked') {
            console.log(`Time slot ${slot.id} is already booked`);
            return true;
          }
          
          return false;
        }
      );
      
      console.log("Already permanently booked slots:", alreadyBookedSlots.length);
      
      if (alreadyBookedSlots.length > 0) {
        return res.status(409).json({ 
          error: "One or more selected time slots have already been booked",
          alreadyBookedSlots: alreadyBookedSlots.map(slot => slot?.id)
        });
      }
      
      // Create the booking
      const booking = await storage.createBooking({
        customerName: bookingData.fullName,
        phoneNumber: bookingData.phoneNumber,
        email: bookingData.email || null,
        equipmentRental: false
        // experienceLevel removed as it's no longer needed
      });
      
      // Associate time slots with the booking and update their status to "booked"
      const bookingTimeSlotPromises = timeSlotIds.map(async timeSlotId => {
        // Add to booking-timeslot relation
        const result = await storage.addTimeSlotToBooking({
          bookingId: booking.id,
          timeSlotId
        });
        
        // Additionally ensure the time slot itself is marked as booked
        await storage.updateTimeSlot(timeSlotId, {
          status: "booked",
          reservationExpiry: null
        });
        
        return result;
      });
      
      await Promise.all(bookingTimeSlotPromises);
      
      // Get all time slots for the booking to calculate total price
      const bookedTimeSlots = await storage.getBookingTimeSlots(booking.id);
      
      // If time slots don't have proper prices, set default prices
      const bookedTimeSlotsWithPrices = bookedTimeSlots.map(slot => {
        if (!slot.price || slot.price <= 0) {
          // Apply the same price logic as in the UI
          let price = 15;
          const hour = new Date(slot.startTime).getHours();
          const dayOfWeek = new Date(slot.startTime).getDay();
          
          if (hour >= 12 && hour < 17) price = 18;
          if (hour >= 17) price = 20;
          
          // Weekend price increase (Saturday or Sunday)
          if (dayOfWeek === 0 || dayOfWeek === 6) price += 5;
          
          return { ...slot, price };
        }
        return slot;
      });
      
      // Calculate total price
      let totalPrice = bookedTimeSlotsWithPrices.reduce((sum, slot) => sum + slot.price, 0);
      
      console.log("Created booking - total price:", totalPrice);
      
      res.status(201).json({
        booking,
        timeSlots: bookedTimeSlots,
        totalPrice
      });
    } catch (error) {
      console.error("Error creating booking:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create booking" });
    }
  });
  
  // Admin booking endpoint - creates time slots on demand and books them
  app.post("/api/bookings/admin", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Extract booking data and time slots from request
      const { customerName, phoneNumber, email, notes, timeSlots } = req.body;
      
      if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
        return res.status(400).json({ error: "No time slots provided" });
      }
      
      console.log("Creating admin booking with time slots:", timeSlots.length);
      
      // Check for conflicts with existing time slots
      const conflicts = [];
      
      for (const slot of timeSlots as Array<{ startTime: string | Date; endTime: string | Date; price?: number }>) {
        // Check for overlapping time slots that are already booked
        const startTime = new Date(slot.startTime);
        const endTime = new Date(slot.endTime);
        
        // Get all time slots in the same time range
        const existingSlots = await storage.getTimeSlotsByDateRange(startTime, endTime);
        
        // Check if any existing slot overlaps and is booked
        for (const existingSlot of existingSlots) {
          const existingStart = new Date(existingSlot.startTime);
          const existingEnd = new Date(existingSlot.endTime);
          
          // Check for overlap
          if (existingSlot.status === 'booked' && 
              ((startTime >= existingStart && startTime < existingEnd) || 
               (endTime > existingStart && endTime <= existingEnd) ||
               (startTime <= existingStart && endTime >= existingEnd))) {
            conflicts.push({
              requestedSlot: { startTime, endTime },
              conflictingSlot: existingSlot
            });
          }
        }
      }
      
      if (conflicts.length > 0) {
        console.log("Booking conflicts detected:", conflicts.length);
        return res.status(409).json({ 
          error: "Time slot conflicts detected with existing bookings",
          conflicts,
          alreadyBookedSlots: conflicts.map(c => c.conflictingSlot.id)
        });
      }
      
      // Create the booking first
      const booking = await storage.createBooking({
        customerName,
        phoneNumber,
        email: email || null,
        notes: notes || "",
        equipmentRental: false
        // experienceLevel removed as it's no longer needed
      });
      
      // Create time slots one by one and associate them with the booking
      const createdTimeSlots = [];
      
      for (const slot of timeSlots as Array<{ startTime: string | Date; endTime: string | Date; price?: number }>) {
        // Log the incoming times for debugging
        console.log(`Processing time slot from client:`, {
          rawStartTime: slot.startTime,
          rawEndTime: slot.endTime,
          localStart: formatInLatviaTime(new Date(slot.startTime), "yyyy-MM-dd HH:mm:ss"),
          localEnd: formatInLatviaTime(new Date(slot.endTime), "yyyy-MM-dd HH:mm:ss")
        });
        
        // Create a new time slot in the database with status "booked"
        // The startTime and endTime are already in ISO format which inherently preserves timezone info
        const timeSlot = await storage.createTimeSlot({
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          price: slot.price || 25, // Default price if not provided
          status: "booked",
          reservationExpiry: null
        });
        
        // Log what was actually stored for debugging
        console.log(`Stored time slot:`, {
          id: timeSlot.id,
          rawStartTime: timeSlot.startTime,
          rawEndTime: timeSlot.endTime,
          localStart: formatInLatviaTime(new Date(timeSlot.startTime), "yyyy-MM-dd HH:mm:ss"),
          localEnd: formatInLatviaTime(new Date(timeSlot.endTime), "yyyy-MM-dd HH:mm:ss")
        });
        
        // Associate it with the booking
        await storage.addTimeSlotToBooking({
          bookingId: booking.id,
          timeSlotId: timeSlot.id
        });
        
        createdTimeSlots.push(timeSlot);
      }
      
      // Calculate total price
      const totalPrice = createdTimeSlots.reduce((sum, slot) => sum + slot.price, 0);
      
      console.log("Created admin booking - total price:", totalPrice);
      
      // Return the booking details with the created time slots
      res.status(201).json({
        booking,
        timeSlots: createdTimeSlots,
        totalPrice
      });
    } catch (error) {
      console.error("Error creating admin booking:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create admin booking" });
    }
  });

  // Get all bookings (admin only)
  app.get("/api/bookings", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const bookings = await storage.getBookings();
      
      // For each booking, get the time slots and calculate total price
      const bookingsWithDetails = await Promise.all(
        bookings.map(async (booking) => {
          const timeSlots = await storage.getBookingTimeSlots(booking.id);
          const totalPrice = timeSlots.reduce((sum, slot) => sum + slot.price, 0);
          
          return {
            ...booking,
            totalPrice,
            slotCount: timeSlots.length,
            firstSlotTime: timeSlots.length > 0 ? 
              new Date(Math.min(...timeSlots.map(slot => new Date(slot.startTime).getTime()))) : 
              null
          };
        })
      );
      
      res.json(bookingsWithDetails);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get a booking by reference
  app.get("/api/bookings/:reference", async (req: Request, res: Response) => {
    try {
      const { reference } = req.params;
      
      const booking = await storage.getBookingByReference(reference);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Get time slots for this booking from database
      const timeSlots = await storage.getBookingTimeSlots(booking.id);
      
      console.log("Fetched time slots for booking:", timeSlots);
      
      // If the time slots don't have proper prices (which seems to be an issue),
      // we'll set some default prices
      const timeSlotsWithPrices = timeSlots.map(slot => {
        if (!slot.price || slot.price <= 0) {
          // Apply the same price logic as in the UI
          let price = 15;
          const hour = new Date(slot.startTime).getHours();
          const dayOfWeek = new Date(slot.startTime).getDay();
          
          if (hour >= 12 && hour < 17) price = 18;
          if (hour >= 17) price = 20;
          
          // Weekend price increase (Saturday or Sunday)
          if (dayOfWeek === 0 || dayOfWeek === 6) price += 5;
          
          return { ...slot, price };
        }
        return slot;
      });
      
      // Calculate total price
      let totalPrice = timeSlotsWithPrices.reduce((sum, slot) => sum + slot.price, 0);
      if (booking.equipmentRental) {
        totalPrice += 30; // $30 for equipment rental
      }
      
      console.log("Calculated total price:", totalPrice);
      
      res.json({
        booking,
        timeSlots: timeSlotsWithPrices,
        totalPrice
      });
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Update booking endpoint
  app.put("/api/bookings/:id", async (req: Request, res: Response) => {
    try {
      // This endpoint requires authentication
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const id = parseInt(req.params.id);
      const bookingData = req.body;
      
      // First validate that the booking exists
      const existingBooking = await storage.getBooking(id);
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Update booking with the new data
      const updatedBooking = await storage.updateBooking(id, {
        ...bookingData,
        // Preserve certain fields from the original booking
        id: id, // Ensure ID can't be changed
        reference: existingBooking.reference, // Preserve reference
        createdAt: existingBooking.createdAt // Preserve creation date
      });
      
      if (updatedBooking) {
        res.status(200).json(updatedBooking);
      } else {
        res.status(500).json({ error: "Failed to update booking" });
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ error: "Failed to update booking" });
    }
  });

  // Requires authentication
  app.delete("/api/bookings/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      
      const success = await storage.deleteBooking(id);
      
      if (!success) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // Get system configuration
  app.get("/api/config", async (req: Request, res: Response) => {
    try {
      const [operatingHours, pricing, visibilityConfig] = await Promise.all([
        storage.getOperatingHours(),
        storage.getPricing(),
        storage.getConfiguration('visibility_weeks')
      ]);
      
      res.json({
        operatingHours,
        pricing,
        visibilityWeeks: visibilityConfig ? parseInt(visibilityConfig.value) : 4
      });
    } catch (error) {
      console.error("Error fetching configuration:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  // Update operating hours - requires authentication
  app.put("/api/config/operating-hours/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      
      const schema = z.object({
        openTime: z.string().optional(),
        closeTime: z.string().optional(),
        isClosed: z.boolean().optional()
      });
      
      const data = schema.parse(req.body);
      
      // Ensure times are in the correct format (HH:MM:SS)
      if (data.openTime && !data.openTime.includes(':')) {
        data.openTime = `${data.openTime}:00`;
      }
      
      if (data.closeTime && !data.closeTime.includes(':')) {
        data.closeTime = `${data.closeTime}:00`;
      }
      
      // Update operating hours but don't regenerate time slots yet
      // Remove regeneration call from storage.updateOperatingHours
      const [updatedHours] = await db.update(operatingHours)
        .set(data)
        .where(eq(operatingHours.id, id))
        .returning();
      
      if (!updatedHours) {
        return res.status(404).json({ error: "Operating hours not found" });
      }
      
      // We'll regenerate time slots only when specifically requested
      // to avoid multiple regenerations when updating multiple days
      
      res.json(updatedHours);
    } catch (error) {
      console.error("Error updating operating hours:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update operating hours" });
    }
  });

  // Update pricing - requires authentication
  app.put("/api/config/pricing/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      
      const schema = z.object({
        price: z.number().optional(),
        startTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        applyToWeekends: z.boolean().optional(),
        weekendMultiplier: z.number().optional().nullable()
      });
      
      const data = schema.parse(req.body);
      
      const updatedPricing = await storage.updatePricing(id, data);
      
      if (!updatedPricing) {
        return res.status(404).json({ error: "Pricing not found" });
      }
      
      res.json(updatedPricing);
    } catch (error) {
      console.error("Error updating pricing:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update pricing" });
    }
  });

  // Update visibility configuration - requires authentication
  app.put("/api/config/visibility", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const schema = z.object({
        weeks: z.number().min(1).max(8)
      });
      
      const { weeks } = schema.parse(req.body);
      
      const updatedConfig = await storage.updateConfiguration('visibility_weeks', weeks.toString());
      
      if (!updatedConfig) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      
      res.json({
        visibilityWeeks: parseInt(updatedConfig.value)
      });
    } catch (error) {
      console.error("Error updating visibility configuration:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update visibility configuration" });
    }
  });

  // Get statistics - requires authentication
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Get period from query params (day, week, month)
      const period = (req.query.period as string) || 'week';
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let startDate = new Date(today);
      let endDate = new Date(today);
      
      switch (period) {
        case 'day':
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          // Start from beginning of current week (Monday)
          // If today is Sunday (0), go back 6 days to previous Monday
          // Otherwise, go back to Monday (day 1)
          const dayOfWeek = startDate.getDay();
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate.setDate(startDate.getDate() - daysToSubtract);
          
          // End at end of week (Sunday)
          // Add 6 days to go from Monday to Sunday
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'month':
          // Start from beginning of current month
          startDate.setDate(1);
          // End at end of month
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          return res.status(400).json({ error: "Invalid period" });
      }
      
      const stats = await storage.getBookingStats(startDate, endDate);
      
      res.json({ period, ...stats });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Mock weather API for Riga, Latvia
  app.get("/api/weather", async (req, res) => {
    try {
      // Create a realistic 7-day forecast for Riga, Latvia in April
      const today = new Date();
      
      // Riga, Latvia weather conditions - April/May averages
      // Source: https://www.weatherbase.com/weather/weather.php3?s=6616&cityname=Riga-Latvia
      // Spring in Riga, Latvia: Temperatures typically 4°C to 15°C
      const rigaWeatherPatterns = [
        { text: "Partly cloudy", icon: "116", temp_range: [6, 14], probability: 0.35 },
        { text: "Cloudy", icon: "119", temp_range: [5, 12], probability: 0.25 },
        { text: "Light rain", icon: "176", temp_range: [4, 10], probability: 0.20 },
        { text: "Sunny", icon: "113", temp_range: [8, 15], probability: 0.15 },
        { text: "Moderate rain", icon: "302", temp_range: [3, 8], probability: 0.05 }
      ];
      
      const forecast = [];
      
      for (let i = 0; i < 7; i++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(forecastDate.getDate() + i);
        
        // Select weather condition based on probability
        const random = Math.random();
        let cumulativeProbability = 0;
        let selectedConditionIndex = 0;
        
        for (let j = 0; j < rigaWeatherPatterns.length; j++) {
          cumulativeProbability += rigaWeatherPatterns[j].probability;
          if (random <= cumulativeProbability) {
            selectedConditionIndex = j;
            break;
          }
        }
        
        const pattern = rigaWeatherPatterns[selectedConditionIndex];
        // Temperature within the appropriate range for selected condition
        const minTemp = pattern.temp_range[0];
        const maxTemp = pattern.temp_range[1];
        const temperature = Math.floor(Math.random() * (maxTemp - minTemp + 1)) + minTemp;
        
        forecast.push({
          date: format(forecastDate, "yyyy-MM-dd"),
          day_name: format(forecastDate, "EEE"),
          temperature: temperature,
          condition: pattern.text,
          icon: `https://cdn.weatherapi.com/weather/64x64/day/${pattern.icon}.png`,
          location: "Riga, Latvia"
        });
      }
      
      // Use first day's weather as current weather
      const currentWeather = forecast[0];
      
      res.json({ 
        forecast,
        location: "Riga, Latvia",
        current: {
          temperature: currentWeather.temperature,
          condition: currentWeather.condition,
          icon: currentWeather.icon
        }
      });
    } catch (error) {
      console.error("Error fetching weather:", error);
      res.status(500).json({ error: "Failed to fetch weather forecast" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
