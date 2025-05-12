import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { z } from "zod";
import { 
  bookingFormSchema, 
  manualBookingSchema, 
  blockTimeSlotSchema, 
  timeSlots, 
  operatingHours,
  leadTimeSettingsFormSchema,
  bookings,
  bookingTimeSlots
} from "@shared/schema";
import { format, addMinutes } from "date-fns";
import { db } from "./db";
import { gte, eq, sql, inArray, and, lte, not } from "drizzle-orm";

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
      // Get start and end dates from query params or default to current week
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      // Validate date inputs if provided
      if (startDateStr && !validateDate(startDateStr)) {
        return res.status(400).json({ error: "Invalid start date format" });
      }
      
      if (endDateStr && !validateDate(endDateStr)) {
        return res.status(400).json({ error: "Invalid end date format" });
      }

      // Use provided date or default to today, converted to Latvia timezone
      let startDate;
      if (startDateStr) {
        // Parse the date and set to start of day in Latvia timezone
        startDate = getLatviaDayStart(new Date(startDateStr));
      } else {
        // If no date provided, use today in Latvia timezone
        startDate = getLatviaDayStart(toLatviaTime(new Date()));
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
      
      // Get time slots from the database
      let timeSlots = await storage.getTimeSlotsByDateRange(startDate, endDate);
      
      try {
        // Get all bookingTimeSlots for this date range
        const bookingSlotJoins = await db.select()
          .from(bookingTimeSlots)
          .where(
            inArray(
              bookingTimeSlots.timeSlotId,
              timeSlots.map(slot => slot.id)
            )
          );
          
        console.log(`Found ${bookingSlotJoins.length} booking-timeslot joins to process`);
        
        // Get all booking IDs from these joins
        const bookingIds = [...new Set(bookingSlotJoins.map(join => join.bookingId))];
        
        // Get actual bookings
        const relevantBookings = await db.select()
          .from(bookings)
          .where(
            inArray(bookings.id, bookingIds)
          );
          
        console.log(`Found ${relevantBookings.length} bookings in the time range`);
        
        // Create lookup map for booking references
        const bookingMap = new Map();
        relevantBookings.forEach(booking => {
          bookingMap.set(booking.id, booking.reference);
        });
        
        // Create lookup map for time slot to booking ID
        const timeSlotToBookingMap = new Map();
        bookingSlotJoins.forEach(join => {
          timeSlotToBookingMap.set(join.timeSlotId, join.bookingId);
        });
        
        // Enhance time slots with booking references
        timeSlots = timeSlots.map(slot => {
          const bookingId = timeSlotToBookingMap.get(slot.id);
          const bookingReference = bookingId ? bookingMap.get(bookingId) : null;
          
          return {
            ...slot,
            bookingReference,
            bookingId
          };
        });
        
        console.log(`Enhanced ${timeSlots.length} time slots with booking references`);
      } catch (err) {
        console.error("Error enhancing time slots with booking data:", err);
        // Continue with original time slots if there's an error
      }
      
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

  // Note: Temporary reservation endpoints have been removed as they are not used in the current implementation
  // The system now checks for conflicts only at the time of final booking submission
  
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
                price
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
            // Create a new time slot with proper data and UTC timezone
            const newSlot = await storage.createTimeSlot({
              startTime: new Date(unallocatedSlot.startTime),
              endTime: new Date(unallocatedSlot.endTime),
              price,
              status: 'available',
              storageTimezone: 'UTC'
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
      
      // Call the enhanced regenerateTimeSlots method with strict duplicate prevention
      const result = await storage.regenerateTimeSlots();
      
      // Verify the time slots were generated properly
      const allTimeSlots = await db.select().from(timeSlots);
      const timeSlotCount = allTimeSlots.length;
      console.log("Time slots after regeneration:", timeSlotCount);
      
      console.log("Time slots regenerated successfully after admin request");
      console.log(`Preserved ${result.preservedBookings} existing bookings during regeneration`);
      console.log(`Prevented ${result.duplicatesPrevented || 0} duplicate slots for already booked time periods`);
      
      // Create a formatted message including information about out-of-hours bookings if any
      let message = `Time slots regenerated successfully. Preserved ${result.preservedBookings} bookings and prevented ${result.duplicatesPrevented || 0} duplicates.`;
      
      if (result.outOfHoursBookings && result.outOfHoursBookings > 0) {
        message += ` Note: ${result.outOfHoursBookings} preserved bookings are outside current operating hours but were retained.`;
      }
      
      // Return enhanced response with more information
      res.json({ 
        success: true,
        message,
        preservedBookings: result.preservedBookings,
        duplicatesPrevented: result.duplicatesPrevented || 0,
        outOfHoursBookings: result.outOfHoursBookings || 0,
        totalTimeSlots: timeSlotCount
      });
    } catch (error) {
      console.error("Error regenerating time slots:", error);
      res.status(500).json({ error: "Failed to regenerate time slots" });
    }
  });

  // Create a booking
  app.post("/api/bookings", async (req: Request, res: Response) => {
    try {
      console.log(`[BOOKING DEBUG] ===== BOOKING REQUEST =====`);
      console.log(`[BOOKING DEBUG] Received booking request at ${formatInLatviaTime(new Date(), 'yyyy-MM-dd HH:mm:ss')} (Latvia time)`);
      console.log(`[BOOKING DEBUG] Request body:`, JSON.stringify(req.body, null, 2));
      
      // Check if this is an admin booking (e.g., has 'customerName' instead of 'fullName')
      let validatedData;
      let timeSlotIds;
      let bookingData;
      
      // ENHANCED BOOKING: Check for date correction info
      const hasDateCorrectedSlots = req.body.hasDateCorrectedSlots || false;
      const timeSlotInfoArray = req.body.timeSlotInfoArray || [];
      
      // Log enhanced time slot information for debugging
      if (hasDateCorrectedSlots) {
        console.log(`[BOOKING DEBUG] ENHANCED BOOKING with date-corrected slots detected`);
        console.log(`[BOOKING DEBUG] Enhanced time slot information:`, JSON.stringify(timeSlotInfoArray, null, 2));
      }
      
      if (req.body.customerName) {
        // Admin is creating a booking
        console.log(`[BOOKING DEBUG] Processing as ADMIN booking`);
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
        console.log(`[BOOKING DEBUG] Processing as USER booking`);
        const schema = bookingFormSchema;
        validatedData = schema.parse(req.body);
        const { timeSlotIds: ids, ...rest } = validatedData;
        timeSlotIds = ids;
        bookingData = rest;
      }
      
      console.log(`[BOOKING DEBUG] Time slot IDs received (${timeSlotIds.length}):`, timeSlotIds);
      
      // COMPREHENSIVE FIX: Handle date-corrected slots properly
      // When we detect date-corrected slots, we need to find the ACTUAL time slots to book
      // based on the display dates shown to the user, not the original database IDs
      if (hasDateCorrectedSlots && timeSlotInfoArray.length > 0) {
        console.log(`[BOOKING DEBUG] FIXING DATE-CORRECTED SLOTS - Finding correct time slots based on display dates`);
        
        // We'll replace timeSlotIds with the corrected ones
        const correctedTimeSlotIds = [];
        
        for (const slotInfo of timeSlotInfoArray) {
          if (slotInfo.isDateCorrected) {
            console.log(`[BOOKING DEBUG] Processing date-corrected slot:`, {
              originalId: slotInfo.id,
              displayDate: new Date(slotInfo.displayDate).toDateString(),
              hour: slotInfo.hour,
              minute: slotInfo.minute
            });
            
            // Find a time slot with matching date and time (instead of using the wrong ID)
            const displayDate = new Date(slotInfo.displayDate);
            // Set time to midnight to match the date part only
            const startOfDay = new Date(displayDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(displayDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            // Query time slots for this specific day from database
            console.log(`[BOOKING DEBUG] Searching for time slots on ${startOfDay.toISOString()} with hour=${slotInfo.hour}, minute=${slotInfo.minute}`);
            const slotsForDay = await storage.getTimeSlotsByDateRange(startOfDay, endOfDay);
            
            // Find the slot that matches the time (hour, minute)
            const matchingSlot = slotsForDay.find(slot => {
              const slotDate = new Date(slot.startTime);
              return slotDate.getHours() === slotInfo.hour && 
                     slotDate.getMinutes() === slotInfo.minute;
            });
            
            if (matchingSlot) {
              console.log(`[BOOKING DEBUG] Found matching slot with correct date: ${matchingSlot.id}`);
              correctedTimeSlotIds.push(matchingSlot.id);
            } else {
              console.log(`[BOOKING DEBUG] WARNING: No matching slot found for date-corrected slot!`);
              // Fall back to original ID if no match found (should not happen if data is consistent)
              correctedTimeSlotIds.push(slotInfo.id);
            }
          } else {
            // For non-corrected slots, use the original ID
            correctedTimeSlotIds.push(slotInfo.id);
          }
        }
        
        // Replace the time slot IDs with our corrected ones
        console.log(`[BOOKING DEBUG] Using corrected time slot IDs:`, correctedTimeSlotIds);
        timeSlotIds = correctedTimeSlotIds;
      }
      
      // Process time slots - create new ones for "unallocated" slots with negative IDs
      const processedTimeSlotIds = [];
      
      // Log raw time slot IDs with date info for better debugging
      console.log(`[BOOKING DEBUG] Processing time slot IDs - checking for any unusual patterns`);
      
      // Check if time slot IDs appear in sequence
      const sortedIds = [...timeSlotIds].sort((a, b) => Number(a) - Number(b));
      console.log(`[BOOKING DEBUG] Time slots sorted by ID:`, sortedIds);
      
      // Count negative IDs (unallocated slots) if any
      const negativeIds = timeSlotIds.filter(id => Number(id) < 0).length;
      if (negativeIds > 0) {
        console.log(`[BOOKING DEBUG] Found ${negativeIds} unallocated slots (negative IDs)`);
      }
      
      for (const id of timeSlotIds) {
        // Check if this is an unallocated slot (negative ID)
        const numericId = Number(id);
        if (numericId < 0) {
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
            
            // Create a new time slot with this information and UTC timezone
            const newSlot = await storage.createTimeSlot({
              startTime: new Date(timeInfo.startTime),
              endTime: new Date(timeInfo.endTime),
              price: 25, // Default price
              status: 'available',
              storageTimezone: 'UTC'
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
        timeSlotIds.map(id => storage.getTimeSlot(Number(id)))
      );
      
      console.log("Time slots for booking:", timeSlots);
      
      // CRITICAL CROSS-DATE PROTECTION: Check if the booking spans multiple days
      // Group time slots by date to detect cross-date bookings
      const slotsByDate = timeSlots.reduce((acc, slot) => {
        if (!slot) return acc;
        
        const date = new Date(slot.startTime).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(slot.id);
        return acc;
      }, {} as Record<string, number[]>);
      
      // Check if booking spans across multiple dates
      if (Object.keys(slotsByDate).length > 1) {
        console.log(`[BOOKING DEBUG] Time slots span across ${Object.keys(slotsByDate).length} different days:`);
        
        // Log the days and slot counts for debugging
        Object.entries(slotsByDate).forEach(([date, slots]) => {
          console.log(`[BOOKING DEBUG] - ${date}: ${slots.length} slots (IDs: ${slots.join(', ')})`);
        });
        
        // Prevent cross-date bookings
        return res.status(400).json({
          error: "Cross-date bookings are not allowed. Please select time slots from a single day only.",
          dates: Object.keys(slotsByDate)
        });
      }
      
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
      
      // DEBUGGING: Check if booking spans multiple days and log detailed information
      const slotDates = new Map<string, number[]>();
      const validSlots = timeSlots.filter(slot => slot !== null) as any[];
      
      for (const slot of validSlots) {
        const startTime = new Date(slot.startTime);
        const dateStr = startTime.toISOString().split('T')[0];
        
        if (!slotDates.has(dateStr)) {
          slotDates.set(dateStr, []);
        }
        
        slotDates.get(dateStr)!.push(slot.id);
      }
      
      console.log(`[BOOKING DEBUG] Time slots span across ${slotDates.size} different days:`);
      for (const [date, slotIds] of slotDates.entries()) {
        console.log(`[BOOKING DEBUG] - ${date}: ${slotIds.length} slots (IDs: ${slotIds.join(', ')})`);
      }
      
      // This is just for debugging - we don't need to block multi-day bookings yet
      
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
        const numericTimeSlotId = Number(timeSlotId);
        // Add to booking-timeslot relation
        const result = await storage.addTimeSlotToBooking({
          bookingId: booking.id,
          timeSlotId: numericTimeSlotId
        });
        
        // Additionally ensure the time slot itself is marked as booked
        await storage.updateTimeSlot(numericTimeSlotId, {
          status: "booked"
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
      
      // CRITICAL CROSS-DATE PROTECTION: Check if the booking spans multiple days
      // Group time slots by date to detect cross-date bookings
      const slotsByDate = timeSlots.reduce((acc, slot) => {
        const date = new Date(slot.startTime).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(slot);
        return acc;
      }, {} as Record<string, Array<any>>);
      
      // Check if booking spans across multiple dates
      if (Object.keys(slotsByDate).length > 1) {
        console.log(`[BOOKING DEBUG] Admin booking spans across ${Object.keys(slotsByDate).length} different days:`);
        
        // Log the days and slot counts for debugging
        Object.entries(slotsByDate).forEach(([date, slots]) => {
          console.log(`[BOOKING DEBUG] - ${date}: ${slots.length} slots`);
        });
        
        // Prevent cross-date bookings
        return res.status(400).json({
          error: "Cross-date bookings are not allowed. Please select time slots from a single day only.",
          dates: Object.keys(slotsByDate)
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
          storageTimezone: 'UTC'
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

  // Get all bookings with different responses for admin/public
  app.get("/api/bookings", async (req: Request, res: Response) => {
    try {
      const bookings = await storage.getBookings();
      
      // Check if user is authenticated - full details for admin
      if (req.isAuthenticated()) {
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
      } else {
        // Public endpoint - only return minimal booking data needed for calendar display
        // No personal information, just dates for lead time calculations
        const publicBookingData = await Promise.all(
          bookings.map(async (booking) => {
            const timeSlots = await storage.getBookingTimeSlots(booking.id);
            
            return {
              // Only include data needed for calendar display and lead time calculations
              id: booking.id,
              firstSlotTime: timeSlots.length > 0 ? 
                new Date(Math.min(...timeSlots.map(slot => new Date(slot.startTime).getTime()))) : 
                null,
              timeSlotDates: timeSlots.map(slot => ({
                startTime: slot.startTime,
                endTime: slot.endTime
              }))
            };
          })
        );
        
        res.json(publicBookingData);
      }
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
      console.log(`DELETE /api/bookings/${req.params.id} request received`);
      
      if (!req.isAuthenticated()) {
        console.log("Delete booking request unauthorized");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      console.log(`Attempting to delete booking with ID ${id}`);
      
      // Get the booking info before we delete it (for logging)
      const bookingInfo = await storage.getBooking(id);
      console.log("Booking to delete:", bookingInfo);
      
      const success = await storage.deleteBooking(id);
      console.log(`Deletion of booking ${id} result: ${success ? 'success' : 'failure'}`);
      
      if (!success) {
        console.log(`Booking ${id} not found - returning 404`);
        return res.status(404).json({ error: "Booking not found" });
      }
      
      console.log(`Booking ${id} successfully deleted`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // Get system configuration
  app.get("/api/config", async (req: Request, res: Response) => {
    try {
      // Import the getTimeFormatPreferences function
      const { getTimeFormatPreferences } = await import('./utils/timezone');
      
      const [operatingHours, pricing, timeFormatPrefs] = await Promise.all([
        storage.getOperatingHours(),
        storage.getPricing(),
        getTimeFormatPreferences()
      ]);
      
      res.json({
        operatingHours,
        pricing,
        timeFormatPreferences: timeFormatPrefs
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
        isClosed: z.boolean().optional(),
        timezone: z.string().optional(),
        useLocalTime: z.boolean().optional()
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

  // Visibility configuration removed
  
  // Update time format preferences - requires authentication
  app.put("/api/config/time-format", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Import necessary modules
      const { db } = await import('./db');
      const { eq } = await import('drizzle-orm');
      const { timeFormatPreferences, insertTimeFormatPreferencesSchema } = await import('../shared/schema');
      
      // Validate request body against schema
      const data = insertTimeFormatPreferencesSchema.parse(req.body);
      
      // Check if we have existing preferences
      const existingPrefs = await db.select().from(timeFormatPreferences).limit(1);
      
      let updatedPrefs;
      
      if (existingPrefs.length > 0) {
        // Update existing preferences
        [updatedPrefs] = await db.update(timeFormatPreferences)
          .set(data)
          .where(eq(timeFormatPreferences.id, existingPrefs[0].id))
          .returning();
      } else {
        // Create new preferences
        [updatedPrefs] = await db.insert(timeFormatPreferences)
          .values(data)
          .returning();
      }
      
      res.json(updatedPrefs);
    } catch (error) {
      console.error("Error updating time format preferences:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update time format preferences" });
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
        case 'year':
          // Start from beginning of current year
          startDate.setMonth(0, 1); // January 1st
          // End at end of year
          endDate.setFullYear(endDate.getFullYear(), 11, 31); // December 31st
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

  // Diagnostic endpoint for checking time slot timezone implementation (admin only)
  app.get("/api/diagnostics/timeslots", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Import the analyzer function
      const { analyzeTimeSlotTimezone } = await import('./utils/timezone');
      
      // Get some time slots to analyze (limit to 10 for performance)
      const timeSlotsToAnalyze = await db.select()
        .from(timeSlots)
        .limit(10);
      
      // Analyze each time slot
      const analysis = timeSlotsToAnalyze.map(slot => analyzeTimeSlotTimezone(slot));
      
      // Return the results
      res.json({
        success: true,
        timeSlots: analysis,
        message: `Analyzed ${analysis.length} time slots for timezone consistency.`
      });
    } catch (error) {
      console.error("Error analyzing time slots:", error);
      res.status(500).json({ error: "Failed to analyze time slots" });
    }
  });

  // Get lead time settings (public endpoint)
  app.get("/api/admin/lead-time-settings", async (req: Request, res: Response) => {
    try {
      // No authentication check - public endpoint
      const settings = await storage.getLeadTimeSettings();
      
      res.json(settings || {
        restrictionMode: "off",
        leadTimeDays: 0,
        operatorOnSite: false
      });
    } catch (error) {
      console.error("Error fetching lead time settings:", error);
      res.status(500).json({ error: "Failed to fetch lead time settings" });
    }
  });

  // Update lead time settings (admin only)
  app.post("/api/admin/lead-time-settings", async (req: Request, res: Response) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated()) {
        console.log("User is not authenticated for lead time settings update", req.user);
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      console.log("User authenticated, processing lead time settings update", req.user);
      
      try {
        const validatedData = leadTimeSettingsFormSchema.parse(req.body);
        console.log("Validated lead time settings data:", validatedData);
        
        let settings = await storage.getLeadTimeSettings();
        
        if (!settings) {
          // Create new settings if they don't exist
          console.log("No existing lead time settings, creating new");
          settings = await storage.createLeadTimeSettings(validatedData);
        } else {
          // Update existing settings
          console.log("Updating existing lead time settings", settings.id);
          settings = await storage.updateLeadTimeSettings(validatedData);
        }
        
        console.log("Lead time settings updated successfully", settings);
        res.json({
          success: true,
          settings
        });
      } catch (validationError) {
        console.error("Validation error in lead time settings:", validationError);
        return res.status(400).json({ error: "Invalid lead time settings data" });
      }
    } catch (error) {
      console.error("Error updating lead time settings:", error);
      res.status(500).json({ error: "Failed to update lead time settings" });
    }
  });

  // Check if booking is allowed for a specific date (considering lead time)
  app.get("/api/lead-time/check", async (req: Request, res: Response) => {
    try {
      const dateStr = req.query.date as string;
      
      if (!dateStr || !validateDate(dateStr)) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const date = new Date(dateStr);
      const result = await storage.checkBookingAllowedByLeadTime(date);
      
      res.json(result);
    } catch (error) {
      console.error("Error checking lead time restrictions:", error);
      res.status(500).json({ error: "Failed to check lead time restrictions" });
    }
  });

  // User Management Endpoints
  
  // Get all users (requires authentication)
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      console.log("GET /api/users endpoint called");
      console.log("Authentication status:", req.isAuthenticated());
      console.log("req.user:", req.user);
      
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Check if the user has appropriate role (admin or manager)
      const user = req.user as any;
      console.log("User accessing /api/users:", { id: user.id, email: user.email, role: user.role });
      
      if (user.role !== 'admin' && user.role !== 'manager') {
        console.log("User has insufficient permissions:", user.role);
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      console.log("User has appropriate permissions:", user.role);
      
      const users = await storage.getAllUsers();
      
      // Filter sensitive information before sending response
      const filteredUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }));
      
      res.json(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Create a new user (requires admin or manager authentication)
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Check if the user has appropriate role (admin or manager)
      const currentUser = req.user as any;
      if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const schema = z.object({
        username: z.string().min(3, "Username must be at least 3 characters"),
        email: z.string().email("Must be a valid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        firstName: z.string().min(2, "First name must be at least 2 characters"),
        lastName: z.string().min(2, "Last name must be at least 2 characters"),
        role: z.enum(['admin', 'manager', 'operator', 'athlete'], {
          errorMap: () => ({ message: "Invalid role. Must be admin, manager, operator, or athlete" })
        }),
        phoneNumber: z.string().optional()
      });
      
      const userData = schema.parse(req.body);
      
      // If the user is a manager trying to create an admin user, return an error
      if (currentUser.role === 'manager' && userData.role === 'admin') {
        return res.status(403).json({ error: "Managers cannot create admin users" });
      }
      
      // Check if user with this email already exists
      const existingEmailUser = await storage.getUserByEmail(userData.email);
      if (existingEmailUser) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }
      
      // Check if user with this username already exists
      const existingUsernameUser = await storage.getUserByUsername(userData.username);
      if (existingUsernameUser) {
        return res.status(400).json({ error: "A user with this username already exists" });
      }
      
      // Hash the password before storing it
      const hashedPassword = await hashPassword(userData.password);
      
      // Create the user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date()
      });
      
      // Filter out sensitive data before responding
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create user" });
    }
  });
  
  // Reset a user's password (requires admin authentication)
  app.post("/api/users/:id/reset-password", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Check if the user has appropriate role (admin only)
      const currentUser = req.user as any;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      const schema = z.object({
        password: z.string().min(8, "Password must be at least 8 characters")
      });
      
      const { password } = schema.parse(req.body);
      
      // Get the user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, {
        password: hashedPassword
      });
      
      // Filter out sensitive data before responding
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error resetting password:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
