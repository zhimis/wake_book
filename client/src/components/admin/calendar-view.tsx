import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, addDays, subDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Clock, 
  Calendar, 
  AlertTriangle,
  Loader2
} from "lucide-react";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Booking, TimeSlot } from "@shared/schema";
import { formatPrice } from "@/lib/utils";

// Schema for manual booking form
const manualBookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  email: z.string().email("Invalid email address").optional(),
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot")
});

// Schema for blocking time slots
const blockTimeSlotSchema = z.object({
  reason: z.string().min(2, "Reason must be at least 2 characters"),
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot")
});

type ManualBookingFormData = z.infer<typeof manualBookingSchema>;
type BlockTimeSlotFormData = z.infer<typeof blockTimeSlotSchema>;

// Component to format time slot display
const TimeSlotDisplay = ({ timeSlot }: { timeSlot: TimeSlot }) => {
  const startTime = new Date(timeSlot.startTime);
  const endTime = new Date(timeSlot.endTime);
  
  return (
    <div className="flex flex-col">
      <span className="font-medium">
        {format(startTime, "EEEE, MMMM d, yyyy")}
      </span>
      <span>
        {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
      </span>
      <span className="text-sm text-muted-foreground">
        ${timeSlot.price}
      </span>
    </div>
  );
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = "bg-gray-100 text-gray-800";
  
  if (status === "booked") bgColor = "bg-green-100 text-green-800";
  if (status === "reserved") bgColor = "bg-yellow-100 text-yellow-800";
  if (status === "blocked") bgColor = "bg-red-100 text-red-800";
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${bgColor}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const AdminCalendarView = () => {
  const [currentDateRange, setCurrentDateRange] = useState<{ start: Date, end: Date }>({
    start: new Date(),
    end: new Date(new Date().setDate(new Date().getDate() + 6)),
  });
  
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [isBookingDetailsDialogOpen, setIsBookingDetailsDialogOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Form setup for manual booking
  const bookingForm = useForm<ManualBookingFormData>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      email: "",
      timeSlotIds: []
    }
  });
  
  // Form setup for blocking time slots
  const blockForm = useForm<BlockTimeSlotFormData>({
    resolver: zodResolver(blockTimeSlotSchema),
    defaultValues: {
      reason: "",
      timeSlotIds: []
    }
  });
  
  // Fetch time slots for current date range
  const { data: timeSlotsData, isLoading: timeSlotsLoading, error: timeSlotsError } = useQuery({
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
  
  // Fetch bookings
  const { data: bookingsData, isLoading: bookingsLoading, error: bookingsError } = useQuery({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const res = await fetch('/api/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
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
      bookingForm.reset();
      setSelectedTimeSlots([]);
      setIsBookingDialogOpen(false);
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      
      toast({
        title: "Booking Created",
        description: "The booking has been successfully created.",
        variant: "default",
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
  
  // Block time slots mutation
  const blockTimeSlotsMutation = useMutation({
    mutationFn: async (data: BlockTimeSlotFormData) => {
      const res = await apiRequest("POST", "/api/timeslots/block", data);
      return await res.json();
    },
    onSuccess: () => {
      // Reset form and close dialog
      blockForm.reset();
      setSelectedTimeSlots([]);
      setIsBlockDialogOpen(false);
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      
      toast({
        title: "Time Slots Blocked",
        description: "The selected time slots have been blocked successfully.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Blocking Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/bookings/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      setSelectedBooking(null);
      setIsBookingDetailsDialogOpen(false);
      
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      
      toast({
        title: "Booking Deleted",
        description: "The booking has been successfully deleted.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleNavigateDates = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDateRange({
        start: subDays(currentDateRange.start, 7),
        end: subDays(currentDateRange.end, 7)
      });
    } else {
      setCurrentDateRange({
        start: addDays(currentDateRange.start, 7),
        end: addDays(currentDateRange.end, 7)
      });
    }
  };
  
  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setCurrentDateRange({
      start: startDate,
      end: endDate
    });
  };
  
  const handleTimeSlotSelect = (timeSlot: TimeSlot) => {
    // When a booked time slot is clicked, show booking details
    if (timeSlot.status === 'booked') {
      // Find the booking associated with this time slot
      if (bookingsData) {
        // We need to fetch the booking details for this time slot
        const getBookingDetailsForSlot = async () => {
          try {
            // First get all bookings with their time slots
            const bookingsWithSlots = await Promise.all(
              bookingsData.map(async (booking: Booking) => {
                const res = await fetch(`/api/bookings/${booking.reference}`);
                if (!res.ok) throw new Error('Failed to fetch booking details');
                return await res.json();
              })
            );
            
            // Find the booking that contains this time slot
            const matchingBooking = bookingsWithSlots.find(bookingData => {
              return bookingData.timeSlots.some((slot: TimeSlot) => slot.id === timeSlot.id);
            });
            
            if (matchingBooking) {
              setSelectedBooking(matchingBooking.booking);
              setIsBookingDetailsDialogOpen(true);
            } else {
              toast({
                title: "Booking Not Found",
                description: "Could not find booking details for this time slot.",
                variant: "destructive",
              });
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to fetch booking details.",
              variant: "destructive",
            });
          }
        };
        
        getBookingDetailsForSlot();
      }
      return;
    }
    
    // For non-booked slots, handle selection
    const isSelected = selectedTimeSlots.some(slot => slot.id === timeSlot.id);
    
    if (isSelected) {
      // Remove from selection
      setSelectedTimeSlots(selectedTimeSlots.filter(slot => slot.id !== timeSlot.id));
    } else {
      // Add to selection if available
      if (timeSlot.status === 'available') {
        setSelectedTimeSlots([...selectedTimeSlots, timeSlot]);
        
        // If this is the first slot selected, show the action buttons
        if (selectedTimeSlots.length === 0) {
          toast({
            title: "Time Slot Selected",
            description: "You can now create a booking or block this time slot.",
            variant: "default",
          });
        }
      }
    }
  };
  
  const handleCreateBooking = () => {
    // Update form with selected time slot IDs
    bookingForm.setValue("timeSlotIds", selectedTimeSlots.map(slot => slot.id));
    
    // Open booking dialog
    setIsBookingDialogOpen(true);
  };
  
  const handleBlockTimeSlots = () => {
    // Update form with selected time slot IDs
    blockForm.setValue("timeSlotIds", selectedTimeSlots.map(slot => slot.id));
    
    // Open block dialog
    setIsBlockDialogOpen(true);
  };
  
  const handleBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsBookingDetailsDialogOpen(true);
  };
  
  const handleDeleteBooking = () => {
    if (selectedBooking && confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(selectedBooking.id);
    }
  };
  
  const onBookingSubmit = (data: ManualBookingFormData) => {
    createBookingMutation.mutate(data);
  };
  
  const onBlockSubmit = (data: BlockTimeSlotFormData) => {
    blockTimeSlotsMutation.mutate(data);
  };
  
  const isLoading = timeSlotsLoading || bookingsLoading;
  const hasError = timeSlotsError || bookingsError;
  
  return (
    <div id="bookingsTab" className="admin-tab-content p-4">
      <div className="flex flex-col space-y-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-2 mb-4 sm:mb-0">
            <Button variant="outline" size="icon" onClick={() => handleNavigateDates('prev')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-gray-600">
              {format(currentDateRange.start, "MMMM d")} - {format(currentDateRange.end, "MMMM d, yyyy")}
            </span>
            <Button variant="outline" size="icon" onClick={() => handleNavigateDates('next')}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Tabs defaultValue="calendar" value={viewMode} onValueChange={(v) => setViewMode(v as 'calendar' | 'list')}>
              <TabsList>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
          <Button 
            className="bg-primary hover:bg-primary/90"
            onClick={handleCreateBooking}
            disabled={selectedTimeSlots.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Booking
          </Button>
          
          <Button 
            variant="outline" 
            className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
            onClick={handleBlockTimeSlots}
            disabled={selectedTimeSlots.length === 0}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Block Time Slots
          </Button>
        </div>
      </div>
      
      {hasError ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load data. Please try again.
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      ) : (
        <>
          {selectedTimeSlots.length > 0 && (
            <Alert className="mb-4">
              <AlertTitle>Selection Active</AlertTitle>
              <AlertDescription>
                {selectedTimeSlots.length} time slot(s) selected. You can create a booking or block these slots.
              </AlertDescription>
            </Alert>
          )}
          
          {viewMode === 'calendar' ? (
            <BookingCalendar 
              onDateRangeChange={handleDateRangeChange}
              isAdmin={true}
              onAdminSlotSelect={handleTimeSlotSelect}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Bookings</CardTitle>
                <CardDescription>View and manage all bookings</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingsData?.length > 0 ? (
                      bookingsData.map((booking: Booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{booking.reference}</TableCell>
                          <TableCell>{booking.customerName}</TableCell>
                          <TableCell>{booking.phoneNumber}</TableCell>
                          <TableCell>{format(new Date(booking.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <StatusBadge status="booked" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleBookingDetails(booking)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4">
                          No bookings found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
      
      {/* Manual Booking Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Manual Booking</DialogTitle>
            <DialogDescription>
              Create a booking for the selected time slots.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 mb-4">
            <div className="rounded-md bg-muted p-3">
              <h4 className="mb-2 font-semibold text-sm">Selected Time Slots:</h4>
              <div className="space-y-2">
                {selectedTimeSlots.map((slot) => (
                  <div key={slot.id} className="text-sm flex justify-between items-center">
                    <span>
                      {format(new Date(slot.startTime), "EEE, MMM d")} • {format(new Date(slot.startTime), "h:mm a")}-
                      {format(new Date(slot.endTime), "h:mm a")}
                    </span>
                    <span>{formatPrice(slot.price)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t text-sm font-semibold flex justify-between">
                  <span>Total:</span>
                  <span>{formatPrice(selectedTimeSlots.reduce((sum, slot) => sum + slot.price, 0))}</span>
                </div>
              </div>
            </div>
          </div>
          
          <Form {...bookingForm}>
            <form onSubmit={bookingForm.handleSubmit(onBookingSubmit)} className="space-y-4">
              <FormField
                control={bookingForm.control}
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
                control={bookingForm.control}
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
                control={bookingForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="Enter customer email address" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBookingDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createBookingMutation.isPending}>
                  {createBookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Booking"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Block Time Slots Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Block Time Slots</DialogTitle>
            <DialogDescription>
              Block selected time slots for maintenance or other purposes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 mb-4">
            <div className="rounded-md bg-muted p-3">
              <h4 className="mb-2 font-semibold text-sm">Selected Time Slots:</h4>
              <div className="space-y-2">
                {selectedTimeSlots.map((slot) => (
                  <div key={slot.id} className="text-sm">
                    {format(new Date(slot.startTime), "EEEE, MMM d")} • {format(new Date(slot.startTime), "h:mm a")}-
                    {format(new Date(slot.endTime), "h:mm a")}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <Form {...blockForm}>
            <form onSubmit={blockForm.handleSubmit(onBlockSubmit)} className="space-y-4">
              <FormField
                control={blockForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Blocking</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter reason (e.g., maintenance, private event)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsBlockDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="destructive" 
                  disabled={blockTimeSlotsMutation.isPending}
                >
                  {blockTimeSlotsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Blocking...
                    </>
                  ) : (
                    "Block Time Slots"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Booking Details Dialog */}
      {selectedBooking && (
        <Dialog open={isBookingDetailsDialogOpen} onOpenChange={setIsBookingDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
              <DialogDescription>
                Reference: {selectedBooking.reference}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Customer Name</h4>
                  <p>{selectedBooking.customerName}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Phone Number</h4>
                  <p>{selectedBooking.phoneNumber}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Email</h4>
                  <p>{selectedBooking.email || "-"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Booking Date</h4>
                  <p>{format(new Date(selectedBooking.createdAt), "PPP")}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Booked Time Slots</h4>
                <div className="space-y-2">
                  {bookingsData ? (
                    <div className="rounded-md bg-muted p-3">
                      {/* Use query to get booking time slots */}
                      {(() => {
                        // Find the booking details with time slots
                        const booking = bookingsData.find(b => b.id === selectedBooking.id);
                        if (!booking) {
                          return (
                            <p className="text-sm text-muted-foreground">
                              No time slots found for this booking.
                            </p>
                          );
                        }
                        
                        // Calculate total price
                        const totalPrice = booking.totalPrice || 0;
                        
                        return (
                          <>
                            <div className="space-y-2">
                              {booking.slotCount > 0 ? (
                                <div className="text-sm">
                                  <p><strong>{booking.slotCount}</strong> time slots booked, starting at{" "}
                                  <strong>{format(new Date(booking.firstSlotTime), "EEEE, MMMM d, h:mm a")}</strong></p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No time slots found for this booking.</p>
                              )}
                            </div>
                            <div className="pt-2 mt-2 border-t text-sm font-semibold flex justify-between">
                              <span>Total:</span>
                              <span>{formatPrice(totalPrice)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Loading time slots...
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="flex justify-between sm:justify-between">
              <Button 
                variant="destructive" 
                onClick={handleDeleteBooking}
                disabled={deleteBookingMutation.isPending}
              >
                {deleteBookingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Booking
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => setIsBookingDetailsDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminCalendarView;
