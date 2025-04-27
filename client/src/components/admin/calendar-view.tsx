import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import BookingCalendar from "@/components/booking-calendar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";

// Schema for manual booking form
const manualBookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  equipmentRental: z.boolean().default(false),
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot")
});

type ManualBookingFormData = z.infer<typeof manualBookingSchema>;

const AdminCalendarView = () => {
  const [currentDateRange, setCurrentDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date(new Date().setDate(new Date().getDate() + 6)),
  });
  
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<any[]>([]);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Form setup for manual booking
  const form = useForm<ManualBookingFormData>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      experienceLevel: "beginner",
      equipmentRental: false,
      timeSlotIds: []
    }
  });
  
  // Fetch bookings for current date range
  const { data, isLoading, error } = useQuery({
    queryKey: [
      '/api/timeslots',
      currentDateRange.start.toISOString(),
      currentDateRange.end.toISOString()
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch time slots');
      return res.json();
    }
  });
  
  // Create manual booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: ManualBookingFormData) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      return await res.json();
    },
    onSuccess: () => {
      // Reset form and close dialog
      form.reset();
      setSelectedTimeSlots([]);
      setIsBookingDialogOpen(false);
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      
      toast({
        title: "Booking Created",
        description: "The booking has been successfully created.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setCurrentDateRange({
      start: startDate,
      end: endDate
    });
  };
  
  const handleTimeSlotSelect = (timeSlot: any) => {
    // Check if the slot is already selected
    const isSelected = selectedTimeSlots.some(slot => slot.id === timeSlot.id);
    
    if (isSelected) {
      // Remove from selection
      setSelectedTimeSlots(selectedTimeSlots.filter(slot => slot.id !== timeSlot.id));
    } else {
      // Add to selection if available
      if (timeSlot.status === 'available') {
        setSelectedTimeSlots([...selectedTimeSlots, timeSlot]);
      }
    }
  };
  
  const handleCreateBooking = () => {
    // Update form with selected time slot IDs
    form.setValue("timeSlotIds", selectedTimeSlots.map(slot => slot.id));
    
    // Open booking dialog
    setIsBookingDialogOpen(true);
  };
  
  const onSubmit = (data: ManualBookingFormData) => {
    createBookingMutation.mutate(data);
  };
  
  return (
    <div id="bookingsTab" className="admin-tab-content p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-gray-600">
            {format(currentDateRange.start, "MMMM d")} - {format(currentDateRange.end, "MMMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={() => {}}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-primary hover:bg-primary-dark text-white"
              onClick={handleCreateBooking}
              disabled={selectedTimeSlots.length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Booking
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Manual Booking</DialogTitle>
              <DialogDescription>
                Create a booking for the selected time slots.
              </DialogDescription>
            </DialogHeader>
            
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
                        <Input placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="experienceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <FormControl>
                        <select 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          {...field}
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="equipmentRental"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <input 
                          type="checkbox" 
                          checked={field.value} 
                          onChange={field.onChange}
                          className="h-4 w-4 text-primary"
                        />
                      </FormControl>
                      <FormLabel className="mb-0">Equipment Rental (+$30)</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={createBookingMutation.isPending}>
                    Create Booking
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load bookings. Please try again.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Select available time slots to create a manual booking.
              {selectedTimeSlots.length > 0 && (
                <span className="ml-2 font-medium">
                  {selectedTimeSlots.length} time slot(s) selected
                </span>
              )}
            </p>
          </div>
          
          <BookingCalendar 
            onDateRangeChange={handleDateRangeChange}
            isAdmin={true}
          />
        </>
      )}
    </div>
  );
};

export default AdminCalendarView;
