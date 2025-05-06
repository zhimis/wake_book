import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, Clock, X, Info, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { format, setHours, setMinutes, addMinutes, isSameDay } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TimeSlot, AdminCustomBookingData, adminCustomBookingSchema } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInLatviaTime, LATVIA_TIMEZONE } from "@/lib/utils";
// We'll implement the dialog inline since there's an issue importing it

interface AdminCreateBookingProps {
  triggerButton?: React.ReactNode;
  isStandalone?: boolean;
  externalOpenState?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialSelectedSlots?: TimeSlot[];
  buttonVariant?: "link" | "outline" | "default" | "destructive" | "secondary" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  onBookingComplete?: () => void;
}

const AdminCreateBooking = ({ 
  triggerButton, 
  isStandalone = true, 
  externalOpenState, 
  onOpenChange,
  initialSelectedSlots = [],
  buttonVariant = "outline",
  buttonSize = "default",
  onBookingComplete
}: AdminCreateBookingProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedStartTime, setSelectedStartTime] = useState("12:00");
  const [duration, setDuration] = useState("30");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [existingBookings, setExistingBookings] = useState<TimeSlot[]>([]);
  const [isCheckingBookings, setIsCheckingBookings] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use external or internal state based on props
  const open = externalOpenState !== undefined ? externalOpenState : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  
  // Check for existing bookings when date is selected
  const checkExistingBookings = async (date: Date | undefined) => {
    if (!date) return;
    
    setIsCheckingBookings(true);
    try {
      // Create start and end date for the selected date (full day)
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Fetch time slots for this date
      const response = await fetch(`/api/timeslots?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`);
      const data = await response.json();
      
      // Filter booked slots
      const bookedSlots = data.timeSlots.filter((slot: TimeSlot) => 
        slot.status === 'booked'
      );
      
      setExistingBookings(bookedSlots);
    } catch (error) {
      console.error("Error checking existing bookings:", error);
      toast({
        title: "Error",
        description: "Could not check existing bookings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingBookings(false);
    }
  };
  
  // Check bookings when date changes
  useEffect(() => {
    if (selectedDate) {
      checkExistingBookings(selectedDate);
    }
  }, [selectedDate]);
  
  // Admin custom booking form
  const form = useForm<AdminCustomBookingData>({
    resolver: zodResolver(adminCustomBookingSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      email: "",
      notes: "",
      timeSlots: []
    }
  });
  
  // Handle initialSelectedSlots
  useEffect(() => {
    if (initialSelectedSlots.length > 0) {
      // Use the first slot's date to set the calendar
      const firstSlot = initialSelectedSlots[0];
      const firstDate = new Date(firstSlot.startTime);
      setSelectedDate(firstDate);
      
      // Set the slots directly
      setTimeSlots(initialSelectedSlots);
      form.setValue("timeSlots", initialSelectedSlots);
      
      // Show toast about using pre-selected slots
      toast({
        title: "Time Slots Loaded",
        description: `Using ${initialSelectedSlots.length} pre-selected time slot(s)`,
        variant: "default"
      });
    }
  }, [initialSelectedSlots, form, toast]);
  
  // Convert selected date and time to time slots
  const generateTimeSlots = async () => {
    if (!selectedDate || !selectedStartTime) return;
    
    // Parse start time
    const [hour, minute] = selectedStartTime.split(":").map(Number);
    const durationMinutes = parseInt(duration);
    const slots: TimeSlot[] = [];
    
    // Create a date object for the start time
    // When we set hours/minutes on the client, we're setting them in local time (Latvia time)
    // The date will be serialized to ISO format when sent to the server, preserving the time correctly
    let startTime = setMinutes(setHours(selectedDate, hour), minute);
    let endTime = addMinutes(startTime, 30); // Each slot is 30 minutes
    
    // Calculate how many 30-minute slots we need
    const numSlots = Math.ceil(durationMinutes / 30);
    
    // Calculate overall start and end times for the booking
    const overallStartTime = new Date(startTime);
    const overallEndTime = addMinutes(startTime, durationMinutes);
    
    // Check for existing bookings within this time range
    try {
      // Format dates for API request
      const queryStartDate = overallStartTime.toISOString();
      const queryEndDate = overallEndTime.toISOString();
      
      // Fetch time slots in the range
      const response = await fetch(`/api/timeslots?startDate=${queryStartDate}&endDate=${queryEndDate}`);
      const data = await response.json();
      
      // Find any booked slots that would overlap
      const conflicts = data.timeSlots.filter((slot: TimeSlot) => 
        slot.status === 'booked' && 
        new Date(slot.startTime) < overallEndTime && 
        new Date(slot.endTime) > overallStartTime
      );
      
      if (conflicts.length > 0) {
        // Format the conflicts for display
        const conflictTimes = conflicts.map((slot: TimeSlot) => 
          formatInLatviaTime(new Date(slot.startTime), "MMM d, HH:mm")
        ).join(', ');
        
        toast({
          title: "Booking Conflict Detected",
          description: `The selected time overlaps with existing bookings: ${conflictTimes}`,
          variant: "destructive"
        });
        
        return; // Don't create the slots
      }
    } catch (error) {
      console.error("Error checking for booking conflicts:", error);
      toast({
        title: "Error",
        description: "Could not check for booking conflicts. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    // If no conflicts, create the time slots
    let currentStartTime = startTime;
    let currentEndTime = addMinutes(currentStartTime, 30);
    
    for (let i = 0; i < numSlots; i++) {
      // Create a time slot object matching our schema
      slots.push({
        id: -1, // Temporary ID, will be replaced by the server
        startTime: new Date(currentStartTime),
        endTime: new Date(currentEndTime),
        price: 25, // Default price
        status: "available",
        storageTimezone: "UTC" // Required field
      });
      
      // Move to next slot
      currentStartTime = new Date(currentEndTime);
      currentEndTime = addMinutes(currentStartTime, 30);
    }
    
    setTimeSlots(slots);
    
    // Update the form with the new time slots
    form.setValue("timeSlots", slots);
    
    toast({
      title: "Time Slots Generated",
      description: `Created ${numSlots} time slots for booking.`,
      variant: "default"
    });
  };
  
  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: AdminCustomBookingData) => {
      const res = await apiRequest("POST", "/api/bookings/admin", data);
      if (!res.ok) {
        const errorData = await res.json();
        
        // Handle specific case of already booked slots
        if (res.status === 409 && errorData.alreadyBookedSlots) {
          throw new Error(
            "One or more selected time slots are already booked. Please adjust the booking time."
          );
        }
        
        // Otherwise throw the general error message
        throw new Error(errorData.error || "Booking failed. Please try again.");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking Created",
        description: "The booking has been created successfully.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeslots"] });
      form.reset();
      setTimeSlots([]);
      setOpen(false);
      
      // Call the onBookingComplete callback if provided
      if (onBookingComplete) {
        onBookingComplete();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Generate time options (24-hour format)
  const timeOptions = Array.from({ length: 48 }, (_, index) => {
    const hour = Math.floor(index / 2);
    const minute = (index % 2) * 30;
    return {
      value: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      label: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
    };
  });
  
  // Duration options in minutes
  const durationOptions = [
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour" },
    { value: "90", label: "1.5 hours" },
    { value: "120", label: "2 hours" },
    { value: "180", label: "3 hours" }
  ];
  
  const onSubmit = (data: AdminCustomBookingData) => {
    if (data.timeSlots.length === 0) {
      toast({
        title: "No Time Selected",
        description: "Please select a date, time, and duration first.",
        variant: "destructive"
      });
      return;
    }
    
    createBookingMutation.mutate(data);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isStandalone ? (
        <DialogTrigger asChild>
          {triggerButton || (
            <Button 
              variant={buttonVariant} 
              size={buttonSize}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <PlusCircle size={16} />
              <span className="truncate">
                {initialSelectedSlots.length > 0 ? 
                  `Book ${initialSelectedSlots.length} Slot${initialSelectedSlots.length !== 1 ? 's' : ''}` : 
                  'Create Booking'
                }
              </span>
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Create New Booking</DialogTitle>
              <DialogDescription>
                Manually create a booking for any date and time.
              </DialogDescription>
            </div>
            {isStandalone && (
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            )}
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-10rem)] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side - Calendar and time selection */}
            <div className="space-y-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                disabled={{ before: new Date() }}
              />
              
              {isCheckingBookings && (
                <div className="flex items-center justify-center py-2 text-sm text-muted-foreground">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Checking for existing bookings...
                </div>
              )}
              
              {!isCheckingBookings && existingBookings.length > 0 && selectedDate && (
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors">
                      <div className="flex items-start">
                        <AlertCircle className="h-4 w-4 mt-0.5 mr-2" />
                        <div>
                          <div className="font-medium">Existing Bookings</div>
                          <div className="text-sm flex items-center gap-1">
                            <span>There are {existingBookings.length} existing bookings on this date</span>
                            <span className="text-xs text-amber-600">(click to view)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        Bookings for {formatInLatviaTime(selectedDate, 'EEEE, MMMM d, yyyy')}
                      </DialogTitle>
                      <DialogDescription>
                        <div className="flex gap-2 mt-2">
                          <div className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                            Booked: {existingBookings.length}
                          </div>
                        </div>
                      </DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[60vh] mt-4">
                      <div className="space-y-2 py-2">
                        {[...existingBookings]
                          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                          .map((slot) => {
                            const statusColor = 'bg-amber-100 text-amber-800 border-amber-300';
                            
                            return (
                              <div 
                                key={slot.id} 
                                className={`px-3 py-2 rounded-md border ${statusColor} flex justify-between`}
                              >
                                <div>
                                  {formatInLatviaTime(new Date(slot.startTime), 'HH:mm')} - {formatInLatviaTime(new Date(slot.endTime), 'HH:mm')}
                                </div>
                                <div className="font-medium capitalize">
                                  {slot.status}
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Select value={selectedStartTime} onValueChange={setSelectedStartTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button 
                type="button" 
                variant="secondary" 
                onClick={async () => {
                  try {
                    await generateTimeSlots();
                  } catch (error) {
                    console.error("Error generating time slots:", error);
                    toast({
                      title: "Error",
                      description: "Failed to generate time slots. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
                className="w-full"
              >
                <Clock size={16} className="mr-2" />
                Generate Time Slots
              </Button>
              
              {timeSlots.length > 0 && (
                <div className="border rounded-md p-3 mt-4 bg-muted/50">
                  <h4 className="font-medium text-sm mb-2">Selected Time Slots:</h4>
                  <div className="space-y-1 text-xs">
                    {timeSlots.map((slot, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{formatInLatviaTime(slot.startTime, "MMM d, yyyy HH:mm")}</span>
                        <span>-</span>
                        <span>{formatInLatviaTime(slot.endTime, "HH:mm")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Right side - Customer info form */}
            <div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter customer name" {...field} />
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
                          <Input placeholder="+371 12345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="customer@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Input placeholder="Any special requests or notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full mt-4"
                    disabled={createBookingMutation.isPending}
                  >
                    {createBookingMutation.isPending ? "Creating..." : "Create Booking"}
                  </Button>
                </form>
              </Form>
            </div>
          </div>
        </ScrollArea>
        
        {isStandalone && (
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateBooking;