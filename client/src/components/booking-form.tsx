import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { BookingFormData, bookingFormSchema } from "@shared/schema";
import { useBooking } from "@/context/booking-context";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  formatDate,
  formatTimeSlot,
  formatPrice,
  calculateTotalPrice,
  formatInLatviaTime,
  toLatviaTime,
  isUserInLatviaTimezone,
  getUserTimezone
} from "@/lib/utils";
import { Button } from "./ui/button";
import { ArrowLeft, Clock, HelpCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { FaGoogle } from "react-icons/fa";

interface BookingFormProps {
  onCancel: () => void;
}

const BookingForm = ({ onCancel }: BookingFormProps) => {
  const { selectedTimeSlots, clearSelectedTimeSlots, saveCurrentBookingState } = useBooking();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Create form with pre-filled data from user account if logged in
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      fullName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : "",
      phoneNumber: user?.phoneNumber || "",
      email: user?.email || "",
      notes: "",
      timeSlotIds: selectedTimeSlots.map((slot) => slot.id),
    },
  });
  
  // Update form values when user logs in during the booking process
  useEffect(() => {
    if (user) {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      form.setValue('email', user.email);
      
      if (fullName) {
        form.setValue('fullName', fullName);
      }
      
      if (user.phoneNumber) {
        form.setValue('phoneNumber', user.phoneNumber);
      }
    }
  }, [user, form]);

  // Handle booking creation
  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      if (!res.ok) {
        const errorData = await res.json();
        
        // Handle specific case of already booked slots
        if (res.status === 409 && errorData.alreadyBookedSlots) {
          throw new Error(
            "One or more selected time slots have been booked by someone else. Please go back and select different times."
          );
        }
        
        // Otherwise throw the general error message
        throw new Error(errorData.error || "Booking failed. Please try again.");
      }
      
      return await res.json();
    },
    onSuccess: async (data) => {
      console.log("BookingForm: Booking successful! Reference:", data.booking.reference);
      
      // NUCLEAR OPTION: Clear entire cache
      console.log("BookingForm: NUCLEAR OPTION - complete cache wipeout");
      queryClient.clear();
      
      // Directly fetch and update data
      console.log("BookingForm: Fetching completely fresh data with direct API call");
      const cacheBuster = new Date().getTime();
      
      try {
        // Get date ranges for API call
        const freshStartDate = new Date();
        const freshEndDate = new Date();
        freshEndDate.setDate(freshEndDate.getDate() + 7);
        
        // Format dates properly for the API
        const formattedStartDate = formatInLatviaTime(freshStartDate, "yyyy-MM-dd");
        const formattedEndDate = formatInLatviaTime(freshEndDate, "yyyy-MM-dd");
        
        console.log(`BookingForm: Direct API call for ${formattedStartDate} to ${formattedEndDate}`);
        
        // Direct fetch with cache busting parameter
        const response = await fetch(
          `/api/timeslots?startDate=${formattedStartDate}&endDate=${formattedEndDate}&_=${cacheBuster}`
        );
        
        if (response.ok) {
          const timeSlotData = await response.json();
          console.log(`BookingForm: Pre-loaded ${timeSlotData.timeSlots?.length || 0} time slots directly`);
          
          // Store the data for multiple query keys
          queryClient.setQueryData(['/api/timeslots'], timeSlotData);
          queryClient.setQueryData(['/api/timeslots', formattedStartDate, formattedEndDate], timeSlotData);
          queryClient.setQueryData(['/api/timeslots', formattedStartDate, formattedEndDate, 0], timeSlotData);
        }
      } catch (error) {
        console.error("BookingForm: Error during direct data fetch:", error);
      }
      
      // Dispatch BOTH event types for maximum compatibility
      console.log("BookingForm: Dispatching BOTH refresh event types");
      
      // First the original booking-updated event
      const bookingUpdatedEvent = new CustomEvent('booking-updated', {
        detail: {
          bookingId: data.booking.id,
          reference: data.booking.reference,
          action: 'new-booking-nuclear',
          timestamp: new Date().getTime(),
          forceRefresh: true
        }
      });
      window.dispatchEvent(bookingUpdatedEvent);
      
      // Then the new force-calendar-refresh event
      const forceRefreshEvent = new Event('force-calendar-refresh');
      window.dispatchEvent(forceRefreshEvent);
      
      // Navigate to confirmation page
      console.log("BookingForm: Navigating to confirmation page");
      navigate(`/confirmation/${data.booking.reference}`);

      // Clear selected time slots
      clearSelectedTimeSlots();

      toast({
        title: "Booking Confirmed!",
        description: "Your wakeboarding session has been successfully booked.",
        variant: "success" as any, // Type cast since we added this variant
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingFormData) => {
    // CRITICAL FIX: Identify any date-corrected slots that need special handling
    const hasDateCorrectedSlots = selectedTimeSlots.some(slot => slot.isDateCorrected);
    
    // For each slot, use either the ID or find the correct ID based on display date
    const timeSlotInfoArray = selectedTimeSlots.map(slot => {
      // Send enhanced slot information for date correction detection
      return {
        id: slot.id,
        displayDate: new Date(slot.startTime).toISOString(),
        originalDate: slot.originalStartTime ? new Date(slot.originalStartTime).toISOString() : null,
        isDateCorrected: slot.isDateCorrected || false,
        hour: slot.hour,
        minute: slot.minute
      };
    });
    
    // Simple time slot IDs (for backward compatibility)
    const timeSlotIds = selectedTimeSlots.map((slot) => slot.id);
    
    // COMPREHENSIVE DEBUGGING: Log detailed information about the time slots being booked
    console.log(`[BOOKING FORM DEBUG] ===== BOOKING SUBMISSION =====`);
    console.log(`[BOOKING FORM DEBUG] Selected time slots (${selectedTimeSlots.length}), hasDateCorrected: ${hasDateCorrectedSlots}`);
    
    // Enhanced logging with date correction information
    console.log(`[BOOKING FORM DEBUG] Full slot details:`, timeSlotInfoArray);
    
    // Group time slots by date for better debugging
    const slotsByDate = selectedTimeSlots.reduce((acc, slot) => {
      const date = new Date(slot.startTime).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push({
        id: slot.id,
        startTime: new Date(slot.startTime).toLocaleString(),
        endTime: new Date(slot.endTime).toLocaleString(),
        isDateCorrected: slot.isDateCorrected || false,
      });
      return acc;
    }, {} as Record<string, any[]>);
    
    // Log slots grouped by date
    Object.entries(slotsByDate).forEach(([date, slots]) => {
      console.log(`[BOOKING FORM DEBUG] Date: ${date}, Slots: ${slots.length}`);
      slots.forEach(slot => {
        console.log(`[BOOKING FORM DEBUG]   - ID: ${slot.id}, Time: ${slot.startTime} - ${slot.endTime}`);
      });
    });
    
    // Check if slots span multiple days
    if (Object.keys(slotsByDate).length > 1) {
      console.log(`[BOOKING FORM DEBUG] WARNING: Booking spans multiple days (${Object.keys(slotsByDate).length} days)`);
    }
    
    // ENHANCED BOOKING CREATION: Send both simple IDs and enhanced slot information
    // to ensure server can handle date-corrected slots correctly
    const formData = {
      ...data,
      timeSlotIds,
      // Add enhanced time slot information with date correction flags
      timeSlotInfoArray,
      hasDateCorrectedSlots
    };
    
    // Show detailed debugging information for troubleshooting
    console.log(`[BOOKING FORM DEBUG] Form data to be submitted:`, {
      ...formData,
      timeSlots: formData.timeSlotInfoArray.map(slot => ({
        id: slot.id, 
        displayDate: new Date(slot.displayDate).toLocaleString(),
        isDateCorrected: slot.isDateCorrected
      }))
    });
    
    // Handle form submission with enhanced data
    bookingMutation.mutate(formData);
  };

  // No need for reservation expiry handler

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          className="flex items-center text-primary font-medium"
          onClick={onCancel}
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Calendar
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-2">
        <h2 className="text-2xl font-heading font-bold text-gray-800 mb-2">
          Complete Your Booking
        </h2>

        {/* Reserved Slots Summary */}
        <div className="mb-2 bg-primary-light bg-opacity-20 rounded-lg p-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-medium text-lg">
              Your Reserved Times
            </h3>
            
            {/* Timezone tooltip - only show if user is not in Latvia timezone */}
            {!isUserInLatviaTimezone() && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-primary cursor-help text-sm">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Latvia Time</span>
                      <HelpCircle className="h-3 w-3 ml-1" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>All times are shown in Latvia time (Europe/Riga timezone). Your local timezone is {getUserTimezone()}.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <div className="space-y-2 mb-3">
            {selectedTimeSlots.map((slot, index) => {
              // Get actual time in Latvia timezone
              const startTime = new Date(slot.startTime);
              const endTime = new Date(slot.endTime);
              
              // Convert to Latvia time
              const latviaStartTime = toLatviaTime(startTime);
              const latviaEndTime = toLatviaTime(endTime);
              
              return (
                <div key={slot.id} className="flex justify-between items-center">
                  <span>
                    {formatDate(latviaStartTime, true)} -{" "}
                    {formatTimeSlot(latviaStartTime, latviaEndTime, true)}
                  </span>
                  <span>{formatPrice(slot.price)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center font-bold text-lg pt-2 border-t border-primary border-opacity-20">
            <span>Total:</span>
            <span>
              {formatPrice(calculateTotalPrice(selectedTimeSlots, false))}
            </span>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            <p>Pricing depends on season: Off-peak (Spring): 20€/30min, Peak (Summer): 25€/30min</p>
          </div>
        </div>

        {/* Sign in option */}
        {!user && (
          <div className="mb-6 p-4 rounded-lg bg-muted border border-border">
            <div className="text-center mb-4">
              <h3 className="font-medium text-lg">Sign in to complete your booking faster</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create an account or sign in to save your information for future bookings
              </p>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {
                // Use the context function to save booking state
                saveCurrentBookingState();
                // Redirect to Google auth with return URL parameter
                window.location.href = '/api/auth/google?returnTo=/booking';
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <FaGoogle className="h-4 w-4" />
                <span>Sign in with Google</span>
              </div>
            </Button>
            
            <div className="relative mt-6 mb-6">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or continue as guest
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* User info display when signed in */}
        {user && (
          <div className="mb-6 p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Signed in as {user.email}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your booking will be saved to your account
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <a href="/api/logout" className="text-primary">Sign out</a>
              </Button>
            </div>
          </div>
        )}
        
        {/* Booking Form */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mb-6"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={user && user.firstName && user.lastName ? "" : "Enter your full name"} 
                      {...field} 
                      readOnly={!!(user && user.firstName && user.lastName)}
                      className={user && user.firstName && user.lastName ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </FormControl>
                  {user && user.firstName && user.lastName && (
                    <p className="mt-1 text-xs text-gray-500">
                      Name from your account will be used for this booking
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={user?.phoneNumber ? "" : "Enter your phone number"}
                      {...field}
                      readOnly={!!user?.phoneNumber}
                      className={user?.phoneNumber ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </FormControl>
                  <p className="mt-1 text-xs text-gray-500">
                    {user?.phoneNumber 
                      ? "Phone number from your account will be used for this booking"
                      : "We'll send your booking confirmation to this number"}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show email field as read-only when logged in or as editable when not logged in */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{user ? "Email" : "Email (Optional)"}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={user ? "" : "Enter your email address"}
                      {...field}
                      readOnly={!!user}
                      className={user ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </FormControl>
                  <p className="mt-1 text-xs text-gray-500">
                    {user 
                      ? "Email from your account will be used for this booking" 
                      : "For booking updates and future account registration"}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Any special requests or information"
                      {...field}
                    />
                  </FormControl>
                  <p className="mt-1 text-xs text-gray-500">
                    Please include any relevant information for your booking
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="p-4 rounded-md bg-muted mt-4">
              <h4 className="text-sm font-medium mb-2">Equipment Rental</h4>
              <p className="text-sm text-muted-foreground">
                Wetsuit rental: 5€/h or 7€/session, Board rental: 7€/h or 10€/session.
                <br/>
                For all rates and rental options, see the pricing page in the main menu.
              </p>
            </div>
            
            <div className="p-4 rounded-md bg-muted mt-4 border-l-4 border-amber-500">
              <h4 className="text-sm font-medium mb-2">Cancellation Policy</h4>
              <p className="text-sm text-muted-foreground">
                • Cancellations less than 2 hours before session: Full payment required
                <br/>
                • Cancellations less than 24 hours before session: 50% payment required
                <br/>
                • Earlier cancellations: No charge
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition duration-200"
                disabled={bookingMutation.isPending}
              >
                {bookingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full mt-3"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default BookingForm;
