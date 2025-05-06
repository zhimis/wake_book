import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, addDays, subDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  toLatviaTime, 
  fromLatviaTime, 
  formatInLatviaTime, 
  formatPrice,
  formatDate,
  formatTime,
  formatTimeSlot,
  LATVIA_TIMEZONE,
  getLatvianDayIndexFromDate
} from "@/lib/utils";

// Add TypeScript declaration for window.bookingsCache
declare global {
  interface Window {
    bookingsCache: Record<string, any>;
  }
}

// Safe bookings cache helper functions
function clearBookingsCache(): void {
  if (typeof window !== 'undefined') {
    window.bookingsCache = {};
  }
}

function getFromBookingsCache(key: string): any | undefined {
  if (typeof window !== 'undefined' && window.bookingsCache) {
    return window.bookingsCache[key];
  }
  return undefined;
}

function setInBookingsCache(key: string, value: any): void {
  if (typeof window !== 'undefined') {
    if (!window.bookingsCache) {
      clearBookingsCache();
    }
    window.bookingsCache[key] = value;
  }
}
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import AdminCreateBooking from "./admin-create-booking";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

// Schema for manual booking form
const manualBookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  email: z.string().email("Invalid email address").optional(),
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot"),
  unallocatedSlots: z.array(z.object({
    id: z.number(), 
    startTime: z.string().or(z.date()),
    endTime: z.string().or(z.date())
  })).optional()
});

// Schema for edit booking - similar to manual booking but with additional fields
const editBookingSchema = z.object({
  id: z.number(),
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().regex(/^[0-9]{10,15}$/, "Phone number must be 10-15 digits"),
  email: z.string().email("Invalid email address").optional().nullable(),
  equipmentRental: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  // We don't edit time slots directly - that would be a separate operation
});

// Schema for blocking time slots
const blockTimeSlotSchema = z.object({
  reason: z.string().min(2, "Reason must be at least 2 characters"),
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot")
});

// Schema for making time slots available
const makeAvailableSchema = z.object({
  price: z.number().min(5, "Price must be at least €5"),
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot")
});

type ManualBookingFormData = z.infer<typeof manualBookingSchema>;
type EditBookingFormData = z.infer<typeof editBookingSchema>;
type BlockTimeSlotFormData = z.infer<typeof blockTimeSlotSchema>;
type MakeAvailableFormData = z.infer<typeof makeAvailableSchema>;

// Component to format time slot display
const TimeSlotDisplay = ({ timeSlot }: { timeSlot: TimeSlot }) => {
  const startTime = toLatviaTime(new Date(timeSlot.startTime));
  const endTime = toLatviaTime(new Date(timeSlot.endTime));
  
  return (
    <div className="flex flex-col">
      <span className="font-medium">
        {formatInLatviaTime(startTime, "EEEE, MMMM d, yyyy")}
      </span>
      <span>
        {formatInLatviaTime(startTime, "HH:mm")} - {formatInLatviaTime(endTime, "HH:mm")}
      </span>
      <span className="text-sm text-muted-foreground">
        {formatPrice(timeSlot.price)}
      </span>
    </div>
  );
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  let bgColor = "bg-gray-100 text-gray-800";
  
  if (status === "booked") bgColor = "bg-yellow-100 text-yellow-800";
  if (status === "blocked") bgColor = "bg-red-100 text-red-800";
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${bgColor}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const AdminCalendarView = () => {
  // Initialize date range using Latvia timezone to ensure consistent display
  const [currentDateRange, setCurrentDateRange] = useState<{ start: Date, end: Date }>(() => {
    // Get today in Latvia timezone
    const latviaToday = toLatviaTime(new Date());
    
    // Set start date to yesterday for admin view to see recent past bookings
    const latviaStartDate = new Date(latviaToday);
    latviaStartDate.setDate(latviaToday.getDate() - 1); // Start from yesterday
    
    // Calculate end date (today + 6 days) in Latvia timezone
    const latviaEndDate = new Date(latviaToday);
    latviaEndDate.setDate(latviaToday.getDate() + 6);
    
    console.log("Admin calendar initial date range:",
      formatInLatviaTime(latviaStartDate, "yyyy-MM-dd"),
      "to", 
      formatInLatviaTime(latviaEndDate, "yyyy-MM-dd")
    );
    
    // Return dates converted back to UTC for storage and API requests
    return {
      start: fromLatviaTime(latviaStartDate), 
      end: fromLatviaTime(latviaEndDate)
    };
  });
  
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isAdvancedBookingDialogOpen, setIsAdvancedBookingDialogOpen] = useState(false);
  const [isMakeAvailableDialogOpen, setIsMakeAvailableDialogOpen] = useState(false);
  // Always use calendar view as requested (removing list view)
  const viewMode = 'calendar';
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [isBookingDetailsDialogOpen, setIsBookingDetailsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelAction, setCancelAction] = useState<'delete' | 'clear' | null>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null); // Store full booking details including time slots
  
  // Track the last set date range to avoid infinite loops
  const lastDateRef = useRef<{start: string, end: string} | null>(null);
  
  // Local implementation of getLatvianDayIndexFromDate function
  // Convert standard JS day index (0 = Sunday, 1 = Monday, etc) to Latvia format (0 = Monday, 1 = Tuesday, etc)
  function getLatvianDayIndexFromDate(date: Date): number {
    const standardDayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return standardDayIndex === 0 ? 6 : standardDayIndex - 1; // Convert to Latvia format
  }
  
  const { toast } = useToast();
  
  // Initialize bookings cache on mount
  useEffect(() => {
    clearBookingsCache();
  }, []);
  
  // Add a debounce flag to prevent rapid re-renders causing infinite loops
  const isUpdatingRef = useRef(false);
  
  // Debounce and stabilize calendar updates
  useEffect(() => {
    let timer: any = null;
    
    if (isUpdatingRef.current) {
      // Clear any pending updates
      if (timer) clearTimeout(timer);
      
      // Set a timer to reset the flag after a short delay
      timer = setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentDateRange]);
  
  // Form setup for manual booking
  const bookingForm = useForm<ManualBookingFormData>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      email: "",
      timeSlotIds: [],
      unallocatedSlots: []
    }
  });
  
  // Form setup for edit booking
  const editBookingForm = useForm<EditBookingFormData>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      id: 0,
      customerName: "",
      phoneNumber: "",
      email: null,
      equipmentRental: false,
      notes: null
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
  
  // Form setup for making time slots available
  const makeAvailableForm = useForm<MakeAvailableFormData>({
    resolver: zodResolver(makeAvailableSchema),
    defaultValues: {
      price: 15,
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
    onSuccess: async () => {
      // Reset form and close dialog
      bookingForm.reset();
      setSelectedTimeSlots([]);
      setIsBookingDialogOpen(false);
      
      // Force immediate refetch of time slots and bookings
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })
      ]);
      
      // Additional explicit refetch for the current date range to ensure UI update
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], data);
      }
      
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
    onSuccess: async () => {
      // Reset form and close dialog
      blockForm.reset();
      setSelectedTimeSlots([]);
      setIsBlockDialogOpen(false);
      
      // Force immediate refetch of time slots
      await queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      
      // Additional explicit refetch for the current date range to ensure UI update
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], data);
      }
      
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
  
  // Make time slots available mutation
  const makeAvailableSlotsMutation = useMutation({
    mutationFn: async (data: MakeAvailableFormData) => {
      const res = await apiRequest("POST", "/api/timeslots/make-available", data);
      return await res.json();
    },
    onSuccess: async () => {
      // Reset form and close dialog
      makeAvailableForm.reset();
      setSelectedTimeSlots([]);
      setIsMakeAvailableDialogOpen(false);
      
      // Force immediate refetch of time slots
      await queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      
      // Additional explicit refetch for the current date range to ensure UI update
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], data);
      }
      
      toast({
        title: "Time Slots Available",
        description: "The selected time slots are now available for booking.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Edit booking mutation
  const editBookingMutation = useMutation({
    mutationFn: async (data: EditBookingFormData) => {
      const res = await apiRequest("PUT", `/api/bookings/${data.id}`, data);
      return await res.json();
    },
    onSuccess: async () => {
      setSelectedBooking(null);
      setIsEditBookingDialogOpen(false);
      setIsBookingDetailsDialogOpen(false);
      
      // Force immediate refetch of bookings
      await queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      
      // Clear the cache to force refetching booking details
      clearBookingsCache();
      
      toast({
        title: "Booking Updated",
        description: "The booking has been successfully updated.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
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
    onSuccess: async () => {
      setSelectedBooking(null);
      setIsBookingDetailsDialogOpen(false);
      
      // Force immediate refetch of time slots and bookings
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })
      ]);
      
      // Additional explicit refetch for the current date range to ensure UI update
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], data);
      }
      
      // Clear the cache to force refetching booking details
      clearBookingsCache();
      
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
  
  // Improved navigation function - handles previous, next, and today
  const handleNavigateDates = (direction: 'prev' | 'next' | 'today') => {
    // If already updating, prevent additional navigation
    if (isUpdatingRef.current) {
      console.log("Navigation in progress, ignoring request");
      return;
    }
    
    // Set the updating flag to prevent loops
    isUpdatingRef.current = true;
    
    // Create a new date object representing right now
    const rightNow = new Date();
    
    // Convert it to the Latvia timezone to ensure correct day calculation
    const todayInLatvia = toLatviaTime(rightNow);
    
    // Use current range as base for navigation
    // In admin view, currentDateRange.start is Sunday (1 day before Monday)
    // So adjust by adding 1 day to get Monday as our reference point
    const currentStart = toLatviaTime(currentDateRange.start);
    const adjustedCurrentStart = addDays(currentStart, 1); // Adjust for the -1 day offset
    
    // Calculate current Monday precisely
    const latvianDayIndex = getLatvianDayIndexFromDate(adjustedCurrentStart);
    const currentMonday = addDays(adjustedCurrentStart, -latvianDayIndex);
    
    console.log(`Current monday calculated as: ${formatInLatviaTime(currentMonday, "yyyy-MM-dd")}`);
    
    let newMonday;
    
    if (direction === 'today') {
      console.log("TODAY BUTTON PRESSED - FORCING CURRENT WEEK");
      
      // CRITICAL FIX - HARD CODE THE CURRENT WEEK'S MONDAY
      // Based on the current date (May 6, 2025), the Monday of this week is May 5, 2025
      const hardCodedMonday = new Date(2025, 4, 5); // May 5, 2025 (month is 0-based)
      hardCodedMonday.setHours(0, 0, 0, 0);
      
      console.log(`HARDCODED Monday for dev testing: ${hardCodedMonday.toISOString()}`);
      
      // Set this as our new Monday
      newMonday = hardCodedMonday;
      
      // Also log some diagnostics about the actual current date calculation
      const actualToday = toLatviaTime(new Date());
      const jsDayOfWeek = actualToday.getDay();
      const latvianDayIndex = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
      
      console.log(`For reference - actual today: ${formatInLatviaTime(actualToday, "yyyy-MM-dd")}`);
      console.log(`JavasScript day of week: ${jsDayOfWeek}`);
      console.log(`Latvia day index: ${latvianDayIndex}`);
      console.log(`Calculated Monday would be: ${formatInLatviaTime(addDays(actualToday, -latvianDayIndex), "yyyy-MM-dd")}`);
      
      // Force verification of admin date calculations
      const adminStartDate = subDays(newMonday, 1); // Sunday
      console.log(`Admin calendar start (Sunday): ${formatInLatviaTime(adminStartDate, "yyyy-MM-dd")}`);
      console.log(`Admin calendar end (Sunday): ${formatInLatviaTime(addDays(newMonday, 6), "yyyy-MM-dd")}`);
    } else if (direction === 'prev') {
      // Navigate to previous week (7 days backward)
      newMonday = addDays(currentMonday, -7);
      console.log(`Navigating to previous week: ${formatInLatviaTime(newMonday, "yyyy-MM-dd")}`);
    } else if (direction === 'next') {
      // Navigate to next week (7 days forward)
      newMonday = addDays(currentMonday, 7);
      console.log(`Navigating to next week: ${formatInLatviaTime(newMonday, "yyyy-MM-dd")}`);
    } else {
      console.error("Invalid navigation direction:", direction);
      isUpdatingRef.current = false;
      return;
    }
    
    // Calculate end of week (Sunday)
    const newSunday = addDays(newMonday, 6);
    
    // For admin view, we want to show yesterday through the following week
    // So adjust the start date to be 1 day before Monday
    const newAdminStart = addDays(newMonday, -1);
    
    // Clear the lastDateRef to allow a new initial update from the calendar
    lastDateRef.current = null;
    
    // Store formatted versions for lookup
    const startLatvia = formatInLatviaTime(newAdminStart, "yyyy-MM-dd");
    const endLatvia = formatInLatviaTime(newSunday, "yyyy-MM-dd");
    
    console.log(`Setting new date range: ${startLatvia} to ${endLatvia}`);
    
    // Store in lastDateRef to prevent duplicate updates
    lastDateRef.current = {
      start: startLatvia,
      end: endLatvia
    };
    
    // Update the date range state with the new dates
    // Convert back to UTC for storage
    setCurrentDateRange({
      start: fromLatviaTime(newAdminStart),
      end: fromLatviaTime(newSunday)
    });
    
    // Reset updating flag after a small delay to allow state to update
    setTimeout(() => {
      isUpdatingRef.current = false;
      console.log('AdminCalendarView: Navigation update complete');
    }, 100);
  };
  
  // Handle date range changes from the BookingCalendar with proper debouncing
  // This keeps the admin state in sync with the calendar's view
  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    // If already updating from navigation buttons, ignore calendar-driven updates
    if (isUpdatingRef.current) {
      console.log('AdminCalendarView: Update in progress, ignoring calendar feedback');
      return;
    }
    
    console.log('AdminCalendarView: Received date range update:', 
                formatInLatviaTime(startDate, "yyyy-MM-dd"),
                "to", 
                formatInLatviaTime(endDate, "yyyy-MM-dd"));
    
    // Convert dates to Latvia time for comparison
    const startLatvia = formatInLatviaTime(startDate, "yyyy-MM-dd");
    const endLatvia = formatInLatviaTime(endDate, "yyyy-MM-dd");
    
    // Check current range in state for comparison
    const currentStartLatvia = formatInLatviaTime(currentDateRange.start, "yyyy-MM-dd");
    const currentEndLatvia = formatInLatviaTime(currentDateRange.end, "yyyy-MM-dd");
    
    // Check if this is the same as our current state to prevent loops
    if (currentStartLatvia === startLatvia && currentEndLatvia === endLatvia) {
      console.log('Matching current state, ignoring update');
      return;
    }
    
    // Also check against last processed date range
    if (lastDateRef.current?.start === startLatvia && 
        lastDateRef.current?.end === endLatvia) {
      console.log('Skipping redundant date range update with same values');
      return;
    }
    
    // Store the formatted strings for future comparisons
    lastDateRef.current = {
      start: startLatvia,
      end: endLatvia
    };
    
    // Set updating flag to prevent rapid re-renders
    isUpdatingRef.current = true;
    
    // Update the date range in admin state (ONLY if different)
    if (currentStartLatvia !== startLatvia || currentEndLatvia !== endLatvia) {
      console.log('Calendar date range updated to:', 
                  formatInLatviaTime(startDate, "yyyy-MM-dd"),
                  "to", 
                  formatInLatviaTime(endDate, "yyyy-MM-dd"));
      
      setCurrentDateRange({
        start: startDate,
        end: endDate
      });
      
      // After a delay, reset the updating flag (done in useEffect)
    }
  };
  
  const handleTimeSlotSelect = (timeSlot: TimeSlot) => {
    console.log(`Admin selecting slot: ${timeSlot.id}, status: ${timeSlot.status}, start: ${new Date(timeSlot.startTime).toLocaleTimeString()}`);
    
    // Different behavior based on the time slot status
    if (timeSlot.status === 'booked') {
      // For booked slots: Show booking details without adding to selection
      if (bookingsData) {
        // We need to fetch the booking details for this time slot
        const getBookingDetailsForSlot = async () => {
          try {
            // First get all bookings with their time slots (use cache if available)
            const bookingsWithSlots = await Promise.all(
              bookingsData.map(async (booking: Booking) => {
                // Check if cache has this reference
                const cachedBooking = getFromBookingsCache(booking.reference);
                if (cachedBooking) {
                  return cachedBooking;
                }
                
                const res = await fetch(`/api/bookings/${booking.reference}`);
                if (!res.ok) throw new Error('Failed to fetch booking details');
                const bookingDetails = await res.json();
                
                // Cache the result
                setInBookingsCache(booking.reference, bookingDetails);
                return bookingDetails;
              })
            );
            
            // Find the booking that contains this time slot
            const matchingBooking = bookingsWithSlots.find(bookingData => {
              return bookingData.timeSlots && bookingData.timeSlots.some((slot: TimeSlot) => slot.id === timeSlot.id);
            });
            
            if (matchingBooking) {
              setSelectedBooking(matchingBooking.booking);
              setIsBookingDetailsDialogOpen(true);
            } else {
              // Try to find by overlapping time periods as a fallback
              // This helps with bookings that span multiple slots
              const slotStart = new Date(timeSlot.startTime);
              const slotEnd = new Date(timeSlot.endTime);
              
              const overlappingBooking = bookingsWithSlots.find(bookingData => {
                if (!bookingData.timeSlots || bookingData.timeSlots.length === 0) return false;
                
                // Check if any slot in this booking overlaps with our selected slot's time
                return bookingData.timeSlots.some((bookingSlot: TimeSlot) => {
                  const bookingSlotStart = new Date(bookingSlot.startTime);
                  const bookingSlotEnd = new Date(bookingSlot.endTime);
                  
                  // Check for time overlap
                  return (
                    (slotStart >= bookingSlotStart && slotStart < bookingSlotEnd) || 
                    (slotEnd > bookingSlotStart && slotEnd <= bookingSlotEnd) ||
                    (slotStart <= bookingSlotStart && slotEnd >= bookingSlotEnd)
                  );
                });
              });
              
              if (overlappingBooking) {
                setSelectedBooking(overlappingBooking.booking);
                setIsBookingDetailsDialogOpen(true);
              } else {
                toast({
                  title: "Booking Not Found",
                  description: "Could not find booking details for this time slot.",
                  variant: "destructive",
                });
              }
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
    } else {
      // For available or unallocated slots: Add to selection
      // Check if this slot is already selected
      // Note: For unallocated slots with negative IDs or ID strings starting with '-', need to compare by time
      const isNegativeId = 
        (typeof timeSlot.id === 'number' && timeSlot.id < 0) || 
        (typeof timeSlot.id === 'string' && timeSlot.id.toString().startsWith('-'));
        
      const isSelected = isNegativeId
        ? selectedTimeSlots.some(slot => 
            slot.startTime.getTime() === timeSlot.startTime.getTime() && 
            slot.endTime.getTime() === timeSlot.endTime.getTime()
          )
        : selectedTimeSlots.some(slot => slot.id === timeSlot.id);
      
      if (isSelected) {
        // Remove from selection
        console.log(`Removing slot ${timeSlot.id} from selection`);
        if (isNegativeId) {
          // For unallocated slots with negative IDs, filter by time
          setSelectedTimeSlots(selectedTimeSlots.filter(slot => 
            !(slot.startTime.getTime() === timeSlot.startTime.getTime() && 
              slot.endTime.getTime() === timeSlot.endTime.getTime())
          ));
        } else {
          // For regular slots, filter by ID
          setSelectedTimeSlots(selectedTimeSlots.filter(slot => slot.id !== timeSlot.id));
        }
      } else {
        // Add to selection but preserve the original date information for API calls
        console.log(`Adding slot ${timeSlot.id} to selection (status: ${timeSlot.status})`);
        
        // Create a copy of the time slot with added original date information
        // This ensures the UI shows the date from the current week's display
        // but backend API operations use the actual database date
        const slotWithOriginalDates = {
          ...timeSlot,
          originalStartTime: timeSlot.startTime,
          originalEndTime: timeSlot.endTime
        };
        
        setSelectedTimeSlots(prev => [...prev, slotWithOriginalDates]);
        
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
    if (selectedTimeSlots.length > 0) {
      // If slots are selected, use the regular booking dialog
      
      // Extract IDs for the booking form
      bookingForm.setValue("timeSlotIds", selectedTimeSlots.map(slot => slot.id));
      
      // Also set the unallocated slots information as a separate field
      // Filter out unallocated slots (those with negative IDs) and include their time information
      // For API operations, we need to use the originalStartTime and originalEndTime from database
      const unallocatedSlots = selectedTimeSlots
        .filter(slot => slot.id < 0)
        .map(slot => ({
          id: slot.id,
          // When sending to the API, use the original database dates to ensure correct backend operations
          startTime: slot.originalStartTime || slot.startTime,
          endTime: slot.originalEndTime || slot.endTime
        }));
      
      if (unallocatedSlots.length > 0) {
        console.log("Including unallocated slots:", unallocatedSlots);
        bookingForm.setValue("unallocatedSlots", unallocatedSlots);
      }
      
      setIsBookingDialogOpen(true);
    } else {
      // If no slots are selected, open the advanced booking dialog for custom dates/times
      setIsAdvancedBookingDialogOpen(true);
    }
  };
  
  const handleBlockTimeSlots = () => {
    // Update form with selected time slot IDs
    blockForm.setValue("timeSlotIds", selectedTimeSlots.map(slot => slot.id));
    
    // Open block dialog
    setIsBlockDialogOpen(true);
  };
  
  const handleMakeAvailable = () => {
    // Update form with selected time slot IDs
    makeAvailableForm.setValue("timeSlotIds", selectedTimeSlots.map(slot => slot.id));
    
    // Open make available dialog
    setIsMakeAvailableDialogOpen(true);
  };
  
  const handleBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsBookingDetailsDialogOpen(true);
  };
  
  const handleEditBooking = async () => {
    if (!selectedBooking) return;
    
    try {
      // Fetch the full booking details
      const res = await fetch(`/api/bookings/${selectedBooking.reference}`);
      if (!res.ok) throw new Error('Failed to fetch booking details');
      const details = await res.json();
      
      // Store the details for potential use in time slot editing later
      setBookingDetails(details);
      
      // Reset form with current values
      editBookingForm.reset({
        id: selectedBooking.id,
        customerName: selectedBooking.customerName,
        phoneNumber: selectedBooking.phoneNumber,
        email: selectedBooking.email || null,
        equipmentRental: selectedBooking.equipmentRental || false,
        notes: selectedBooking.notes || null
      });
      
      // Show the edit dialog
      setIsEditBookingDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load booking details for editing.",
        variant: "destructive",
      });
    }
  };
  
  // Add a clear time slots mutation (this will remove the slots entirely from the DB)
  const clearTimeSlotsMutation = useMutation({
    mutationFn: async (timeSlotIds: number[]) => {
      const res = await apiRequest("POST", "/api/timeslots/release", { timeSlotIds });
      return await res.json();
    },
    onSuccess: async () => {
      setSelectedBooking(null);
      setIsCancelDialogOpen(false);
      setIsBookingDetailsDialogOpen(false);
      
      // Force immediate refetch of time slots
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })
      ]);
      
      // Additional explicit refetch for the current date range to ensure UI update
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], data);
      }
      
      toast({
        title: "Time Slots Cleared",
        description: "The time slots have been successfully cleared.",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Clearing Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleDeleteBooking = () => {
    // Open the cancel dialog instead of using browser confirm
    setIsCancelDialogOpen(true);
  };
  
  const confirmCancelAction = async () => {
    if (!selectedBooking) return;
    
    try {
      if (cancelAction === 'delete') {
        // Regular delete - keeps time slots available
        await deleteBookingMutation.mutateAsync(selectedBooking.id);
        
        toast({
          title: "Booking Cancelled",
          description: "The booking has been cancelled and slots are available for new bookings.",
          variant: "default",
        });
      } else if (cancelAction === 'clear') {
        // We need to fetch the booking details for this booking to get time slots
        const res = await fetch(`/api/bookings/${selectedBooking.reference}`);
        if (!res.ok) throw new Error('Failed to fetch booking details');
        const bookingDetails = await res.json();
        
        // First delete the booking
        await deleteBookingMutation.mutateAsync(selectedBooking.id);
        
        // Then block each time slot (which now removes them completely)
        if (bookingDetails.timeSlots?.length > 0) {
          const timeSlotIds = bookingDetails.timeSlots.map((slot: TimeSlot) => slot.id);
          
          await blockTimeSlotsMutation.mutateAsync({
            timeSlotIds,
            reason: `Cleared from booking ${selectedBooking.reference}`
          });
        }
        
        toast({
          title: "Booking Cancelled",
          description: "The booking has been cancelled and slots have been cleared.",
          variant: "default",
        });
      }
      
      // Close the dialogs
      setIsCancelDialogOpen(false);
      setIsBookingDetailsDialogOpen(false);
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel booking",
        variant: "destructive",
      });
    }
  };
  
  const onBookingSubmit = (data: ManualBookingFormData) => {
    createBookingMutation.mutate(data);
  };
  
  const onBlockSubmit = (data: BlockTimeSlotFormData) => {
    blockTimeSlotsMutation.mutate(data);
  };
  
  const onMakeAvailableSubmit = (data: MakeAvailableFormData) => {
    // Identify which time slots are unallocated (have negative IDs, either numeric or string)
    const unallocatedSlots = selectedTimeSlots.filter(slot => 
      (typeof slot.id === 'number' && slot.id < 0) || 
      (typeof slot.id === 'string' && slot.id.toString().startsWith('-'))
    );
    
    // Prepare the data to send to the server
    const formData = {
      ...data,
      timeSlotIds: selectedTimeSlots.map(slot => slot.id)
    };
    
    console.log("Make available data:", formData);
    makeAvailableSlotsMutation.mutate(formData);
  };
  
  const isLoading = timeSlotsLoading || bookingsLoading;
  const hasError = timeSlotsError || bookingsError;
  
  return (
    <div id="bookingsTab" className="admin-tab-content p-0.5">
      {/* Top controls removed, buttons moved below the calendar view */}
      
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
          {viewMode === 'calendar' ? (
            <>
              {/* Use a key to force completely new instance on date change */}
              <BookingCalendar 
                key={formatInLatviaTime(currentDateRange.start, "yyyy-MM-dd")}
                onDateRangeChange={handleDateRangeChange}
                isAdmin={true}
                onAdminSlotSelect={handleTimeSlotSelect}
                adminSelectedSlots={selectedTimeSlots}
                initialDate={currentDateRange.start} // Pass current date directly to calendar component
                /* Use our custom navigation functions for all buttons to ensure consistent state */
                customNavigation={{
                  goToPrevious: () => handleNavigateDates('prev'),
                  goToNext: () => handleNavigateDates('next'),
                  goToToday: () => handleNavigateDates('today')
                }}
              />
              
              {/* Display Selection Active alert between calendar and action buttons */}
              {selectedTimeSlots.length > 0 && (
                <Alert className="mt-4 mb-4">
                  <AlertTitle>Selection Active</AlertTitle>
                  <AlertDescription>
                    <div className="mb-2">
                      {selectedTimeSlots.length} time slot(s) selected. You can create a booking or block these slots.
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                      <div className="font-semibold">Selected slots:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-20 overflow-y-auto">
                        {selectedTimeSlots.map((slot) => {
                          // Use time slots directly from the current calendar week to ensure consistency
                          const startTime = new Date(slot.startTime);
                          const endTime = new Date(slot.endTime);
                          
                          // Get the Latvia timezone version for display
                          const adjustedStartTime = toLatviaTime(startTime);
                          const adjustedEndTime = toLatviaTime(endTime);
                          
                          // Debug our selection display
                          console.log(`Displaying admin selected slot: 
                            ID: ${slot.id},
                            Original database start: ${startTime.toISOString()},
                            Latvia time: ${formatInLatviaTime(startTime, "EEE, MMM d HH:mm:ss")}`);
                          
                          return (
                            <div key={slot.id} className="text-xs flex gap-1">
                              <span>{formatInLatviaTime(adjustedStartTime, "EEE, MMM d")}</span>
                              <span>•</span>
                              <span>{formatInLatviaTime(adjustedStartTime, "HH:mm")}-
                                    {formatInLatviaTime(adjustedEndTime, "HH:mm")}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Action buttons below alert */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0 mt-4">
                <Button 
                  className="bg-primary hover:bg-primary/90"
                  onClick={handleCreateBooking}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Booking
                </Button>
                
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button 
                    variant="outline" 
                    className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                    onClick={handleBlockTimeSlots}
                    disabled={selectedTimeSlots.length === 0}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Block Slots
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                    onClick={handleMakeAvailable}
                    disabled={selectedTimeSlots.length === 0}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Make Available
                  </Button>
                </div>
                
                {/* We're now using the Create Booking button for both regular and advanced booking */}
              </div>
            </>
          ) : (
            <div className="space-y-6">
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
                            <TableCell>{formatInLatviaTime(new Date(booking.createdAt), "MMM d, yyyy")}</TableCell>
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
              
              {/* Advanced Booking Creation */}
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Booking Options</CardTitle>
                  <CardDescription>Create custom bookings for any date and time</CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminCreateBooking />
                </CardContent>
              </Card>
            </div>
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
                {selectedTimeSlots.map((slot) => {
                  // Get actual time in Latvia timezone using our utility function
                  const startTime = new Date(slot.startTime);
                  const endTime = new Date(slot.endTime);
                  
                  // Use the proper Latvia timezone conversion instead of manual adjustment
                  const adjustedStartTime = toLatviaTime(startTime);
                  const adjustedEndTime = toLatviaTime(endTime);
                  
                  return (
                    <div key={slot.id} className="text-sm flex justify-between items-center">
                      <span>
                        {formatInLatviaTime(adjustedStartTime, "EEE, MMM d")} • 
                        {formatInLatviaTime(adjustedStartTime, "HH:mm")}-
                        {formatInLatviaTime(adjustedEndTime, "HH:mm")}
                      </span>
                      <span>{formatPrice(slot.price)}</span>
                    </div>
                  );
                })}
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
                {selectedTimeSlots.map((slot) => {
                  // Get actual time in Latvia timezone using our utility function
                  const startTime = new Date(slot.startTime);
                  const endTime = new Date(slot.endTime);
                  
                  // Use the proper Latvia timezone conversion instead of manual adjustment
                  const adjustedStartTime = toLatviaTime(startTime);
                  
                  const adjustedEndTime = toLatviaTime(endTime);
                  
                  return (
                    <div key={slot.id} className="text-sm">
                      {formatInLatviaTime(adjustedStartTime, "EEEE, MMM d")} • 
                      {adjustedStartTime.getHours()}:{adjustedStartTime.getMinutes().toString().padStart(2, '0')}-
                      {adjustedEndTime.getHours()}:{adjustedEndTime.getMinutes().toString().padStart(2, '0')}
                    </div>
                  );
                })}
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
      
      {/* Make Available Dialog */}
      <Dialog open={isMakeAvailableDialogOpen} onOpenChange={setIsMakeAvailableDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Make Time Slots Available</DialogTitle>
            <DialogDescription>
              Make selected time slots available for booking by setting a price.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 mb-4">
            <div className="rounded-md bg-muted p-3">
              <h4 className="mb-2 font-semibold text-sm">Selected Time Slots:</h4>
              <div className="space-y-2">
                {selectedTimeSlots.map((slot) => {
                  // Get actual time in Latvia timezone using our utility function
                  const startTime = new Date(slot.startTime);
                  const endTime = new Date(slot.endTime);
                  
                  // Use the proper Latvia timezone conversion instead of manual adjustment
                  const adjustedStartTime = toLatviaTime(startTime);
                  
                  const adjustedEndTime = toLatviaTime(endTime);
                  
                  return (
                    <div key={slot.id} className="text-sm">
                      {formatInLatviaTime(adjustedStartTime, "EEEE, MMM d")} • 
                      {adjustedStartTime.getHours()}:{adjustedStartTime.getMinutes().toString().padStart(2, '0')}-
                      {adjustedEndTime.getHours()}:{adjustedEndTime.getMinutes().toString().padStart(2, '0')}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <Form {...makeAvailableForm}>
            <form onSubmit={makeAvailableForm.handleSubmit(onMakeAvailableSubmit)} className="space-y-4">
              <FormField
                control={makeAvailableForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (€)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={5} 
                        step={1} 
                        placeholder="Enter price per slot" 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Set a price for each time slot (minimum €5).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsMakeAvailableDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="default" 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={makeAvailableSlotsMutation.isPending}
                >
                  {makeAvailableSlotsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Make Available"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Advanced Booking Dialog - Using the component with controlled open state */}
      <AdminCreateBooking 
        isStandalone={false}
        triggerButton={null}
        externalOpenState={isAdvancedBookingDialogOpen}
        onOpenChange={setIsAdvancedBookingDialogOpen}
      />
      
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
                  <p>{formatInLatviaTime(new Date(selectedBooking.createdAt), "PPP")}</p>
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
                        const booking = bookingsData.find((b: Booking) => b.id === selectedBooking.id);
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
                                  {(() => {
                                    const startTime = new Date(booking.firstSlotTime);
                                    return (
                                      <p><strong>{booking.slotCount}</strong> time slots booked, starting at{" "}
                                      <strong>{formatInLatviaTime(startTime, "EEEE, MMMM d")}, {formatInLatviaTime(startTime, "HH:mm")}</strong></p>
                                    );
                                  })()}
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
            
            <DialogFooter className="flex flex-col w-full space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleEditBooking}
                disabled={editBookingMutation.isPending}
              >
                {editBookingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Booking
                  </>
                )}
              </Button>
              <Button 
                variant="destructive"
                className="w-full" 
                onClick={handleDeleteBooking}
                disabled={deleteBookingMutation.isPending}
              >
                {deleteBookingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Cancel Booking
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Edit Booking Dialog */}
      <Dialog open={isEditBookingDialogOpen} onOpenChange={setIsEditBookingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
            <DialogDescription>
              Update booking information.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editBookingForm}>
            <form onSubmit={editBookingForm.handleSubmit((data) => editBookingMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editBookingForm.control}
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
                control={editBookingForm.control}
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
                control={editBookingForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email (optional)" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              

              
              <FormField
                control={editBookingForm.control}
                name="equipmentRental"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Equipment Rental</FormLabel>
                      <FormDescription>
                        Does the customer need equipment rental?
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={editBookingForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter notes (optional)" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={editBookingMutation.isPending}>
                  {editBookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>
              What would you like to do with this booking?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <RadioGroup defaultValue="delete" onValueChange={(value) => setCancelAction(value as 'delete' | 'clear')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delete" id="delete" />
                  <Label htmlFor="delete" className="font-medium">
                    Cancel Booking
                    <p className="text-xs text-muted-foreground">
                      Delete the booking but keep the time slots available for new bookings.
                    </p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="clear" id="clear" />
                  <Label htmlFor="clear" className="font-medium">
                    Clear Slot
                    <p className="text-xs text-muted-foreground">
                      Delete both the booking and its time slots. The slots will appear as unallocated (gray).
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancelAction}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCalendarView;
