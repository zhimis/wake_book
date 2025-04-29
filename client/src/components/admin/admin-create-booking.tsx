import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PlusCircle, Clock, X } from "lucide-react";
import { format, setHours, setMinutes, addMinutes } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TimeSlot, AdminCustomBookingData, adminCustomBookingSchema } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AdminCreateBookingProps {
  triggerButton?: React.ReactNode;
  isStandalone?: boolean;
  externalOpenState?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const AdminCreateBooking = ({ 
  triggerButton, 
  isStandalone = true, 
  externalOpenState, 
  onOpenChange 
}: AdminCreateBookingProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedStartTime, setSelectedStartTime] = useState("12:00");
  const [duration, setDuration] = useState("30");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
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
  
  // Convert selected date and time to time slots
  const generateTimeSlots = () => {
    if (!selectedDate || !selectedStartTime) return;
    
    // Parse start time
    const [hour, minute] = selectedStartTime.split(":").map(Number);
    const durationMinutes = parseInt(duration);
    const slots: TimeSlot[] = [];
    
    // Create a date object for the start time
    let startTime = setMinutes(setHours(selectedDate, hour), minute);
    let endTime = addMinutes(startTime, 30); // Each slot is 30 minutes
    
    // Calculate how many 30-minute slots we need
    const numSlots = Math.ceil(durationMinutes / 30);
    
    for (let i = 0; i < numSlots; i++) {
      // Create a time slot object matching our schema
      slots.push({
        id: -1, // Temporary ID, will be replaced by the server
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        price: 25, // Default price
        status: "available",
        reservationExpiry: null
      });
      
      // Move to next slot
      startTime = new Date(endTime);
      endTime = addMinutes(startTime, 30);
    }
    
    setTimeSlots(slots);
    
    // Update the form with the new time slots
    form.setValue("timeSlots", slots);
  };
  
  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: AdminCustomBookingData) => {
      const res = await apiRequest("POST", "/api/bookings/admin", data);
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
            <Button variant="outline" className="flex items-center gap-2">
              <PlusCircle size={16} />
              Create Booking
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
                onClick={generateTimeSlots}
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
                        <span>{format(slot.startTime, "MMM d, yyyy HH:mm")}</span>
                        <span>-</span>
                        <span>{format(slot.endTime, "HH:mm")}</span>
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