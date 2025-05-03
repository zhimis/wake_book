import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { BookingFormData, bookingFormSchema } from "@shared/schema";
import { useBooking } from "@/context/booking-context";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface BookingFormProps {
  onCancel: () => void;
}

const BookingForm = ({ onCancel }: BookingFormProps) => {
  const { selectedTimeSlots, clearSelectedTimeSlots } = useBooking();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Create form
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      email: "",
      timeSlotIds: selectedTimeSlots.map((slot) => slot.id),
    },
  });

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
    onSuccess: (data) => {
      // Navigate to confirmation page
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
    // Make sure to include the time slot IDs
    const formData = {
      ...data,
      timeSlotIds: selectedTimeSlots.map((slot) => slot.id),
    };

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
        </div>

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
                    <Input placeholder="Enter your full name" {...field} />
                  </FormControl>
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
                      placeholder="Enter your phone number"
                      {...field}
                    />
                  </FormControl>
                  <p className="mt-1 text-xs text-gray-500">
                    We'll send your booking confirmation to this number
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      {...field}
                    />
                  </FormControl>
                  <p className="mt-1 text-xs text-gray-500">
                    For booking updates and future account registration
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

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
