import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { bookingFormSchema } from "@shared/schema";
import { format, addMinutes } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  setupAuth(app);

  // Get time slots for a week
  app.get("/api/timeslots", async (req: Request, res: Response) => {
    try {
      // Get start and end dates from query params or default to current week
      const startDateStr = req.query.startDate as string;
      const endDateStr = req.query.endDate as string;

      const startDate = startDateStr ? new Date(startDateStr) : new Date();
      // Set to beginning of day
      startDate.setHours(0, 0, 0, 0);

      let endDate;
      if (endDateStr) {
        endDate = new Date(endDateStr);
      } else {
        // Default to 7 days from start date
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
      }
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);

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
      
      // Check if all requested time slots are available
      const timeSlots = await Promise.all(
        timeSlotIds.map(id => storage.getTimeSlot(id))
      );
      
      const unavailableSlots = timeSlots.filter(
        slot => !slot || slot.status !== 'available'
      );
      
      if (unavailableSlots.length > 0) {
        return res.status(400).json({ 
          error: "One or more selected time slots are not available" 
        });
      }
      
      // Reserve the time slots for 10 minutes
      const expiryTime = new Date();
      expiryTime.setMinutes(expiryTime.getMinutes() + 10);
      
      const reservedSlots = await Promise.all(
        timeSlotIds.map(id => storage.reserveTimeSlot(id, expiryTime))
      );
      
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

  // Create a booking
  app.post("/api/bookings", async (req: Request, res: Response) => {
    try {
      const schema = bookingFormSchema;
      
      // Validate form data
      const validatedData = schema.parse(req.body);
      const { timeSlotIds, ...bookingData } = validatedData;
      
      // Verify all time slots are reserved and not expired
      const timeSlots = await Promise.all(
        timeSlotIds.map(id => storage.getTimeSlot(id))
      );
      
      const now = new Date();
      
      // Check if any time slots are unavailable or reservations expired
      const invalidSlots = timeSlots.filter(
        slot => !slot || slot.status !== 'reserved' || 
        (slot.reservationExpiry && slot.reservationExpiry < now)
      );
      
      if (invalidSlots.length > 0) {
        return res.status(400).json({ 
          error: "One or more selected time slots are no longer available" 
        });
      }
      
      // Create the booking
      const booking = await storage.createBooking({
        customerName: bookingData.fullName,
        phoneNumber: bookingData.phoneNumber,
        experienceLevel: bookingData.experienceLevel,
        equipmentRental: bookingData.equipmentRental
      });
      
      // Associate time slots with the booking
      await Promise.all(
        timeSlotIds.map(timeSlotId => storage.addTimeSlotToBooking({
          bookingId: booking.id,
          timeSlotId
        }))
      );
      
      // Get all time slots for the booking to calculate total price
      const bookedTimeSlots = await storage.getBookingTimeSlots(booking.id);
      
      // Calculate total price (including equipment rental if selected)
      let totalPrice = bookedTimeSlots.reduce((sum, slot) => sum + slot.price, 0);
      if (bookingData.equipmentRental) {
        totalPrice += 30; // $30 for equipment rental
      }
      
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

  // Get a booking by reference
  app.get("/api/bookings/:reference", async (req: Request, res: Response) => {
    try {
      const { reference } = req.params;
      
      const booking = await storage.getBookingByReference(reference);
      
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      const timeSlots = await storage.getBookingTimeSlots(booking.id);
      
      // Calculate total price
      let totalPrice = timeSlots.reduce((sum, slot) => sum + slot.price, 0);
      if (booking.equipmentRental) {
        totalPrice += 30; // $30 for equipment rental
      }
      
      res.json({
        booking,
        timeSlots,
        totalPrice
      });
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
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
        openTime: z.date().optional(),
        closeTime: z.date().optional(),
        isClosed: z.boolean().optional()
      });
      
      const data = schema.parse(req.body);
      
      const updatedHours = await storage.updateOperatingHours(id, data);
      
      if (!updatedHours) {
        return res.status(404).json({ error: "Operating hours not found" });
      }
      
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
        startTime: z.date().optional().nullable(),
        endTime: z.date().optional().nullable(),
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
          // Start from beginning of current week (Sunday)
          startDate.setDate(startDate.getDate() - startDate.getDay());
          // End at end of week (Saturday)
          endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
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

  // Mock weather API - in a real application, this would call an external weather API
  app.get("/api/weather", async (req, res) => {
    try {
      // Create a mock 7-day forecast starting from today
      const today = new Date();
      
      // Generate random weather conditions
      const conditions = [
        { text: "Sunny", icon: "113" },
        { text: "Partly cloudy", icon: "116" },
        { text: "Cloudy", icon: "119" },
        { text: "Light rain", icon: "176" },
        { text: "Moderate rain", icon: "302" }
      ];
      
      const forecast = [];
      
      for (let i = 0; i < 7; i++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(forecastDate.getDate() + i);
        
        const randomConditionIndex = Math.floor(Math.random() * conditions.length);
        const randomTemp = Math.floor(Math.random() * 11) + 20; // Random temp between 20-30°C
        
        forecast.push({
          date: format(forecastDate, "yyyy-MM-dd"),
          day_name: format(forecastDate, "EEE"),
          temperature: randomTemp,
          condition: conditions[randomConditionIndex].text,
          icon: `https://cdn.weatherapi.com/weather/64x64/day/${conditions[randomConditionIndex].icon}.png`
        });
      }
      
      res.json({ forecast });
    } catch (error) {
      console.error("Error fetching weather:", error);
      res.status(500).json({ error: "Failed to fetch weather forecast" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
