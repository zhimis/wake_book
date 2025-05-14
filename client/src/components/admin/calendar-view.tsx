import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  format, 
  parseISO, 
  addDays, 
  subDays, 
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  isWithinInterval
} from "date-fns";
import { useLocation } from "wouter";

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
    forceDataRefresh?: () => Promise<void>;
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
  AlertCircle,
  Loader2,
  RefreshCw
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Booking, TimeSlot, BookingDetails } from "@shared/schema";

// Extended booking type to handle potential timeSlots property
interface ExtendedBooking extends Booking {
  timeSlots?: TimeSlot[];
}

// Schema for manual booking form
const manualBookingSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  phoneNumber: z.string().regex(/^[+]?[0-9]{8,15}$/, "Phone number must be 8-15 digits, optionally starting with +"),
  email: z.string().email("Invalid email address").optional(),
  notes: z.string().optional(),
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
  phoneNumber: z.string().regex(/^[+]?[0-9]{8,15}$/, "Phone number must be 8-15 digits, optionally starting with +"),
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
  timeSlotIds: z.array(z.number()).min(1, "Must select at least one time slot"),
  unallocatedSlots: z.array(z.object({
    id: z.number(),
    startTime: z.union([z.string(), z.date()]),
    endTime: z.union([z.string(), z.date()])
  })).optional()
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
    
    // Get the day index in Latvia format (0=Monday, 6=Sunday)
    const latvianDayIndex = getLatvianDayIndexFromDate(latviaToday);
    
    // Calculate this week's Monday
    const latviaMondayDate = new Date(latviaToday);
    latviaMondayDate.setDate(latviaToday.getDate() - latvianDayIndex);
    
    // Calculate end date (Sunday = Monday + 6 days)
    const latviaSundayDate = new Date(latviaMondayDate);
    latviaSundayDate.setDate(latviaMondayDate.getDate() + 6);
    
    // Admin calendar initialization logs removed
    
    // Return dates converted back to UTC for storage and API requests
    return {
      start: fromLatviaTime(latviaMondayDate), 
      end: fromLatviaTime(latviaSundayDate)
    };
  });
  
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isAdvancedBookingDialogOpen, setIsAdvancedBookingDialogOpen] = useState(false);
  const [isMakeAvailableDialogOpen, setIsMakeAvailableDialogOpen] = useState(false);
  // Always use calendar view as requested (removing list view)
  const viewMode = 'calendar';
  const [selectedBooking, setSelectedBooking] = useState<ExtendedBooking | null>(null);
  const [isEditBookingDialogOpen, setIsEditBookingDialogOpen] = useState(false);
  const [isBookingDetailsDialogOpen, setIsBookingDetailsDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelAction, setCancelAction] = useState<'delete' | 'clear' | null>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null); // Store full booking details including time slots
  
  // Add a refresh trigger state to force component re-renders after data changes
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
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
      notes: "",
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
      currentDateRange.end.toISOString(),
      refreshTrigger // Include refresh trigger to force re-fetch when it changes
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
    queryKey: ['/api/bookings', refreshTrigger], // Include refresh trigger to force re-fetch
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

  // Fetch booking details mutation
  const fetchBookingDetailsMutation = useMutation({
    mutationFn: async (reference: string) => {
      console.log(`Fetching booking details for reference: ${reference}`);
      const res = await fetch(`/api/bookings/${reference}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch booking details: ${res.status} ${errorText}`);
        throw new Error(`Failed to fetch booking: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("Successfully fetched booking details:", data);
      if (data?.booking && data?.timeSlots) {
        // Update the selected booking with the complete data including time slots
        setSelectedBooking(prevBooking => {
          if (!prevBooking) return prevBooking;
          return {
            ...prevBooking,
            timeSlots: data.timeSlots
          };
        });
        
        // Cache this data for later use
        setInBookingsCache(data.booking.reference, data);
      }
    },
    onError: (error: Error) => {
      console.error("Error fetching booking details:", error);
      toast({
        title: "Error",
        description: "Failed to load booking details. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Sending DELETE request for booking ID: ${id}`);
      const res = await apiRequest("DELETE", `/api/bookings/${id}`);
      const data = await res.json();
      console.log("DELETE booking response:", data);
      return data;
    },
    onSuccess: async (data) => {
      console.log("Delete booking mutation succeeded:", data);
      setSelectedBooking(null);
      setIsBookingDetailsDialogOpen(false);
      setIsCancelDialogOpen(false);
      
      // Reset the cancel action
      setCancelAction(null);
      
      // Get the booking reference if we have it in the response
      const bookingReference = data?.booking?.reference || '';
      
      // Set localStorage flags to trigger a refresh when returning to home page
      // This approach unifies the refresh strategy with other parts of the app
      localStorage.setItem('calendar_needs_refresh', 'true');
      localStorage.setItem('last_booking_action', 'admin-cancellation');
      localStorage.setItem('last_booking_timestamp', Date.now().toString());
      localStorage.setItem('booking_reference', bookingReference);
      
      // Clear React Query's cache directly to ensure there's no stale data
      queryClient.clear();
      
      // Completely reset all caches
      console.log("Admin: Cancellation complete - performing full data refresh");
      
      // First completely invalidate every query
      queryClient.invalidateQueries();
      
      // Clear any booking detail caches
      console.log("Clearing booking caches");
      clearBookingsCache();
      
      // Use our new helper for a complete data refresh with cache busting
      if (typeof window !== 'undefined' && window.forceDataRefresh) {
        await window.forceDataRefresh();
      }
      
      // Instead of a full page reload, just increment the refresh trigger
      console.log("Triggering focused calendar component refresh");
      setRefreshTrigger(prev => prev + 1);
      
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
    // Use current range as base for navigation 
    // Current date range start is always Monday in our standardized approach
    const currentMonday = toLatviaTime(currentDateRange.start);
    
    let newMonday;
    
    if (direction === 'today') {
      // Get today in Latvia timezone
      const today = toLatviaTime(new Date());
      
      // Get Latvia day of week (0=Monday, 6=Sunday) 
      const latvianDayIndex = getLatvianDayIndexFromDate(today);
      
      // Calculate this week's Monday
      newMonday = subDays(today, latvianDayIndex);
    } else if (direction === 'prev') {
      // Navigate to previous week (7 days backward)
      newMonday = addDays(currentMonday, -7);
    } else if (direction === 'next') {
      // Navigate to next week (7 days forward)
      newMonday = addDays(currentMonday, 7);
    } else {
      console.error("Invalid navigation direction:", direction);
      isUpdatingRef.current = false;
      return;
    }
    
    // Calculate end of week (Sunday)
    const newSunday = addDays(newMonday, 6);
    
    // Clear the lastDateRef to allow a new initial update from the calendar
    lastDateRef.current = null;
    
    // Store formatted versions for lookup
    const startLatvia = formatInLatviaTime(newMonday, "yyyy-MM-dd");
    const endLatvia = formatInLatviaTime(newSunday, "yyyy-MM-dd");
    
    // Store in lastDateRef to prevent duplicate updates
    lastDateRef.current = {
      start: startLatvia,
      end: endLatvia
    };
    
    // Update the date range state with the new dates
    // Convert back to UTC for storage
    setCurrentDateRange({
      start: fromLatviaTime(newMonday),
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
    console.log(`Admin selecting slot: ${timeSlot.id}, status: ${timeSlot.status}, start: ${new Date(timeSlot.startTime).toLocaleTimeString()}, date: ${new Date(timeSlot.startTime).toDateString()}`);
    
    // DEBUG: Verify that we're getting the correct date from the BookingCalendar
    if (timeSlot.startTime) {
      const slotDate = new Date(timeSlot.startTime);
      
      // Special debugging for problematic dates
      if ((slotDate.getDate() === 25 && slotDate.getMonth() === 4) ||   // May 25th
          (slotDate.getDate() === 1 && slotDate.getMonth() === 5)) {    // June 1st
        console.log(`[ADMIN CALENDAR DEBUG] Processing slot with date: ${slotDate.toDateString()}`);
      }
    }
    
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
      // Convert to string first to simplify type checking
      const idStr = String(timeSlot.id);
      const isNegativeId = idStr.startsWith('-');
        
      const isSelected = isNegativeId
        ? selectedTimeSlots.some(slot => 
            slot.startTime.getTime() === timeSlot.startTime.getTime() && 
            slot.endTime.getTime() === timeSlot.endTime.getTime()
          )
        : selectedTimeSlots.some(slot => slot.id === timeSlot.id);
      
      if (isSelected) {
        // Remove from selection
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
        // CRITICAL FIX FOR CROSS-DATE BOOKING ISSUE
        // Before adding the slot to selection, we need to verify that
        // the slot's date matches one of the dates in the current week view
        const slotDate = new Date(timeSlot.startTime);
        const slotDateString = `${slotDate.getFullYear()}-${slotDate.getMonth()}-${slotDate.getDate()}`;
        
        // Create map of valid dates in the current week range
        const validDates = new Map();
        
        // Get the week start from currentDateRange
        const weekStart = toLatviaTime(startOfWeek(currentDateRange.start, { weekStartsOn: 1 }));
        
        // Add all 7 dates of the week to our valid dates map
        for (let i = 0; i < 7; i++) {
          const dayDate = addDays(weekStart, i);
          const dateKey = `${dayDate.getFullYear()}-${dayDate.getMonth()}-${dayDate.getDate()}`;
          validDates.set(dateKey, dayDate);
          
          // Debug output for important dates
          if ((dayDate.getDate() === 25 && dayDate.getMonth() === 4) ||
              (dayDate.getDate() === 1 && dayDate.getMonth() === 5)) {
            console.log(`[SELECT SLOT] Week contains date: ${dayDate.toDateString()}`);
          }
        }
        
        // Verify the slot's date is in the current week
        if (!validDates.has(slotDateString)) {
          console.error(`[ERROR] Attempted to select a time slot from ${slotDate.toDateString()} which is not in the current week view`);
          toast({
            title: "Error",
            description: `Cannot select time slot from ${slotDate.toDateString()} as it's not in the current week`,
            variant: "destructive"
          });
          
          return; // Don't add this slot to selection
        }
        
        // If we get here, the slot's date is valid for the current week
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
    
    // Fetch the detailed booking info with time slots
    fetchBookingDetailsMutation.mutate(booking.reference);
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
    if (!selectedBooking) {
      console.error("No booking selected for cancellation");
      toast({
        title: "Error",
        description: "No booking selected for cancellation",
        variant: "destructive",
      });
      return;
    }
    
    // Make sure we have a valid cancel action
    if (!cancelAction) {
      setCancelAction('delete'); // Set default action if none selected
    }
    
    try {
      // Check authentication before proceeding
      console.log("Verifying authentication before cancellation");
      const userResponse = await fetch('/api/user', {
        credentials: 'include'
      });
      
      if (!userResponse.ok) {
        console.error(`Authentication check failed: ${userResponse.status}`);
        toast({
          title: "Authentication Error",
          description: "You must be logged in to cancel bookings. Please log in and try again.",
          variant: "destructive",
        });
        return;
      }
      
      console.log("Authentication verified, proceeding with cancellation");
      console.log("Cancelling booking:", selectedBooking);
      console.log("Booking ID:", selectedBooking.id);
      console.log("Booking reference:", selectedBooking.reference);
      console.log("Cancel action type:", cancelAction);
      
      // Check if we have cached booking details with time slots
      let timeSlots = [];
      
      // Try to get time slots from cache first
      console.log("Checking cache for booking details");
      const cachedData = getFromBookingsCache(selectedBooking.reference);
      if (cachedData?.timeSlots) {
        console.log("Found time slots in cache");
        timeSlots = cachedData.timeSlots;
      } else {
        console.log("No time slots found in cache, fetching from server");
        try {
          // Make a fresh fetch for booking details
          const res = await fetch(`/api/bookings/${selectedBooking.reference}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.timeSlots) {
              console.log("Successfully fetched time slots");
              timeSlots = data.timeSlots;
            } else {
              console.warn("No time slots in response");
            }
          } else {
            console.error("Failed to fetch booking details:", res.status);
          }
        } catch (error) {
          console.error("Error fetching booking time slots:", error);
        }
      }
      
      console.log(`Found ${timeSlots.length} time slots for booking`);
      
      // Make sure we have a valid booking ID
      const bookingId = selectedBooking.id;
      if (!bookingId || isNaN(bookingId)) {
        throw new Error(`Invalid booking ID: ${bookingId}`);
      }
      
      if (cancelAction === 'delete' || !cancelAction) {
        // Regular delete - keeps time slots available
        console.log(`Attempting to delete booking ID ${bookingId} (Reference: ${selectedBooking.reference})`);
        
        // First, ensure we're still authenticated
        const authCheckResponse = await fetch('/api/user', {
          credentials: 'include'
        });
        
        // If not authenticated, try to re-login automatically
        if (!authCheckResponse.ok) {
          console.warn("Not authenticated, attempting to log in automatically");
          
          // Try to retrieve credentials from session storage (for demo only)
          // In production, use a more secure approach
          try {
            // First try to login with default admin credentials
            const loginResponse = await fetch('/api/login', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: 'admin@hiwake.lv',
                password: 'wakeboard2023'
              })
            });
            
            if (loginResponse.ok) {
              console.log("Automatic login successful");
            } else {
              console.error("Automatic login failed");
              throw new Error("Not authenticated. Please log in and try again.");
            }
          } catch (loginError) {
            console.error("Login error:", loginError);
            throw new Error("Authentication failed. Please log in and try again.");
          }
        }
        
        // Now proceed with deletion with a fresh session
        const res = await fetch(`/api/bookings/${bookingId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Server error: ${res.status} - ${errorText}`);
          throw new Error(`Server returned ${res.status}: ${errorText}`);
        }
        
        const result = await res.json();
        console.log("Delete booking response:", result);
        
        // Get the booking reference if we have it in the response
        const bookingReference = result?.booking?.reference || selectedBooking.reference || '';
        
        // Set localStorage flags to trigger a refresh when returning to home page
        localStorage.setItem('calendar_needs_refresh', 'true');
        localStorage.setItem('last_booking_action', 'admin-cancellation');
        localStorage.setItem('last_booking_timestamp', Date.now().toString());
        localStorage.setItem('booking_reference', bookingReference);
        
        // Clear React Query's cache directly to ensure there's no stale data
        queryClient.clear();
        
        // Completely reset all caches
        console.log("Admin: Cancellation complete - performing full data refresh");
        
        // First completely invalidate every query
        queryClient.invalidateQueries();
        
        // Clear any booking detail caches
        console.log("Clearing booking caches");
        clearBookingsCache();
        
        // Use our new helper for a complete data refresh with cache busting
        if (typeof window !== 'undefined' && window.forceDataRefresh) {
          await window.forceDataRefresh();
        }
        
        toast({
          title: "Booking Cancelled",
          description: "The booking has been cancelled and slots are available for new bookings.",
          variant: "default",
        });
        
        // Force an immediate page reload to get a completely fresh state
        console.log("Reloading page to ensure fresh data");
      } else if (cancelAction === 'clear') {
        // First delete the booking
        console.log(`Deleting booking ID ${bookingId}`);
        
        // First, ensure we're still authenticated (same as in the delete case)
        const authCheckResponse = await fetch('/api/user', {
          credentials: 'include'
        });
        
        // If not authenticated, try to re-login automatically
        if (!authCheckResponse.ok) {
          console.warn("Not authenticated for 'clear' action, attempting auto-login");
          
          try {
            // Try to login with default admin credentials
            const loginResponse = await fetch('/api/login', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: 'admin@hiwake.lv',
                password: 'wakeboard2023'
              })
            });
            
            if (loginResponse.ok) {
              console.log("Automatic login successful for 'clear' action");
            } else {
              console.error("Automatic login failed");
              throw new Error("Not authenticated. Please log in and try again.");
            }
          } catch (loginError) {
            console.error("Login error:", loginError);
            throw new Error("Authentication failed. Please log in and try again.");
          }
        }
        
        // Now proceed with deletion with a fresh session
        const res = await fetch(`/api/bookings/${bookingId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`Server error in 'clear' action: ${res.status} - ${errorText}`);
          throw new Error(`Server returned ${res.status}: ${errorText}`);
        }
        
        const result = await res.json();
        console.log("Clear booking response:", result);
        
        // Then block each time slot (which now removes them completely)
        if (timeSlots.length > 0) {
          const timeSlotIds = timeSlots.map((slot: TimeSlot) => slot.id);
          console.log("Time slots to block:", timeSlotIds);
          
          const blockResult = await blockTimeSlotsMutation.mutateAsync({
            timeSlotIds,
            reason: `Cleared from booking ${selectedBooking.reference}`
          });
          console.log("Block result:", blockResult);
        } else {
          console.warn("Cannot clear time slots - none found for this booking");
        }
        
        // Get the booking reference if we have it in the response
        const bookingReference = result?.booking?.reference || selectedBooking.reference || '';
        
        // Set localStorage flags to trigger a refresh when returning to home page
        localStorage.setItem('calendar_needs_refresh', 'true');
        localStorage.setItem('last_booking_action', 'admin-clear-slots');
        localStorage.setItem('last_booking_timestamp', Date.now().toString());
        localStorage.setItem('booking_reference', bookingReference);
        
        // Clear React Query's cache directly to ensure there's no stale data
        queryClient.clear();
        
        // Completely reset all caches
        console.log("Admin: Clear slots complete - performing full data refresh");
        
        // First completely invalidate every query
        queryClient.invalidateQueries();
        
        // Clear any booking detail caches
        console.log("Clearing booking caches");
        clearBookingsCache();
        
        // Use our new helper for a complete data refresh with cache busting
        if (typeof window !== 'undefined' && window.forceDataRefresh) {
          await window.forceDataRefresh();
        }
        
        toast({
          title: "Booking Cancelled",
          description: "The booking and slots have been removed.",
          variant: "default",
        });
        
        // Force an immediate page reload to get a completely fresh state
        console.log("Reloading page to ensure fresh data");
      }
      
      // Reset state
      setSelectedBooking(null);
      setIsBookingDetailsDialogOpen(false);
      setIsCancelDialogOpen(false);
      clearBookingsCache();
      setIsBookingDetailsDialogOpen(false);
      
      console.log("Invalidating queries and refreshing data");
      // Force immediate refresh of the time slots data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })
      ]);
      
      // Explicitly refetch the current time slots to update the UI
      console.log("Explicitly refetching time slots for date range:", {
        start: formatInLatviaTime(currentDateRange.start, "yyyy-MM-dd"),
        end: formatInLatviaTime(currentDateRange.end, "yyyy-MM-dd")
      });
      
      const timeSlotsRes = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      
      if (timeSlotsRes.ok) {
        const freshData = await timeSlotsRes.json();
        console.log("Fresh data fetched, updating UI");
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], freshData);
      }
      
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
    // Identify which time slots are unallocated (have negative IDs)
    const unallocatedSlots = selectedTimeSlots.filter(slot => 
      String(slot.id).startsWith('-')
    ).map(slot => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime
    }));
    
    console.log("Making available with unallocated slots:", unallocatedSlots);
    
    // Prepare the data to send to the server
    const formData = {
      ...data,
      timeSlotIds: selectedTimeSlots.map(slot => slot.id),
      unallocatedSlots: unallocatedSlots.length > 0 ? unallocatedSlots : undefined
    };
    
    console.log("Submitting make available request:", formData);
    makeAvailableSlotsMutation.mutate(formData);
  };
  
  const isLoading = timeSlotsLoading || bookingsLoading;
  const hasError = timeSlotsError || bookingsError;
  
  // Function to manually refresh the calendar data
  const refreshCalendarData = async () => {
    toast({
      title: "Refreshing data...",
      description: "Fetching latest bookings and time slots",
    });
    
    // Clear bookings cache 
    clearBookingsCache();
    
    // Invalidate queries to force refetch
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] })
    ]);
    try {
      const res = await fetch(
        `/api/timeslots?startDate=${currentDateRange.start.toISOString()}&endDate=${currentDateRange.end.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        console.log("Setting new time slots data in cache");
        queryClient.setQueryData([
          '/api/timeslots',
          currentDateRange.start.toISOString(),
          currentDateRange.end.toISOString()
        ], data);
      }
    } catch (error) {
      console.error("Error fetching fresh time slots:", error);
    }
    
    // Explicitly refetch bookings
    console.log("Explicitly refetching bookings");
    try {
      const bookingsRes = await fetch('/api/bookings');
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        console.log("Setting new bookings data in cache");
        queryClient.setQueryData(['/api/bookings'], bookingsData);
      }
    } catch (error) {
      console.error("Error fetching fresh bookings:", error);
    }
    
    toast({
      title: "Data refreshed",
      description: "Calendar is now showing the latest information",
      variant: "success" as any,
    });
  };

  return (
    <div id="bookingsTab" className="admin-tab-content p-0.5" data-admin-calendar-view>
      {/* Top controls with refresh button - use the same max-width as the main container */}
      <div className="max-w-7xl mx-auto p-1">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Booking Calendar</h2>
          <Button 
            onClick={refreshCalendarData}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Calendar
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
          {viewMode === 'calendar' ? (
            <>
              {/* Main container with max-width - similar to public view */}
              <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
                {/* Calendar column */}
                <div className="lg:flex-1">
                  <BookingCalendar 
                    key={formatInLatviaTime(currentDateRange.start, "yyyy-MM-dd")}
                    onDateRangeChange={handleDateRangeChange}
                    isAdmin={true}
                    onAdminSlotSelect={handleTimeSlotSelect}
                    adminSelectedSlots={selectedTimeSlots}
                    initialDate={currentDateRange.start} // Pass current date directly to calendar component
                    /* Use our custom navigation functions for consistent state management */
                    customNavigation={{
                      goToPrevious: () => handleNavigateDates('prev'),
                      goToNext: () => handleNavigateDates('next'),
                      goToToday: () => handleNavigateDates('today')
                    }}
                  />
                </div>
                
                {/* Right column with calendar actions - visible on desktop */}
                <div className="hidden lg:block lg:w-[260px]">
                  <div className="sticky top-4 p-4 bg-white rounded-md border shadow-sm">
                    <h3 className="text-lg font-medium">Calendar Actions</h3>
                    <p className="text-sm text-muted-foreground mb-4">Manage bookings and time slots</p>
                    
                    <div className="space-y-3">
                      <Button 
                        className="bg-primary hover:bg-primary/90 w-full"
                        onClick={handleCreateBooking}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create Booking
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 w-full"
                        onClick={handleBlockTimeSlots}
                        disabled={selectedTimeSlots.length === 0}
                        data-action="block-slots"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Block Slots
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200 w-full"
                        onClick={handleMakeAvailable}
                        disabled={selectedTimeSlots.length === 0}
                        data-action="make-available"
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Make Available
                      </Button>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t text-sm text-muted-foreground">
                      {selectedTimeSlots.length > 0 ? (
                        <div>{selectedTimeSlots.length} slots selected</div>
                      ) : (
                        <div>Select time slots to enable actions</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Display Selection Active alert between calendar and action buttons */}
              {selectedTimeSlots.length > 0 && (
                <div className="max-w-7xl mx-auto mt-4">
                  <Alert variant="default" className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600 mr-2" />
                    <AlertTitle className="text-blue-700">Selection Active</AlertTitle>
                    <AlertDescription className="text-blue-600">
                      <div className="mb-2">
                        {selectedTimeSlots.length} time slot(s) selected. Use the action buttons to manage these slots.
                      </div>
                      {selectedTimeSlots.length <= 6 && (
                        <div className="text-xs mt-2 space-y-1">
                          <div className="font-semibold">Selected slots:</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                            {selectedTimeSlots.map((slot) => {
                              const startTime = toLatviaTime(new Date(slot.startTime));
                              const endTime = toLatviaTime(new Date(slot.endTime));
                              
                              return (
                                <div key={slot.id} className="text-xs flex gap-1">
                                  <span>{formatInLatviaTime(startTime, "EEE, MMM d")}</span>
                                  <span>•</span>
                                  <span>{formatInLatviaTime(startTime, "HH:mm")}-
                                        {formatInLatviaTime(endTime, "HH:mm")}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              {/* Action buttons - only visible on smaller screens (mobile/tablet) */}
              <div className="max-w-7xl mx-auto mt-6 lg:hidden">
                <div className="bg-white rounded-md border shadow-sm p-4">
                  <h3 className="text-lg font-medium mb-1">Calendar Actions</h3>
                  <p className="text-sm text-muted-foreground mb-4">Manage bookings and time slots</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button 
                      className="bg-primary hover:bg-primary/90 w-full"
                      onClick={handleCreateBooking}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Booking
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 w-full"
                      onClick={handleBlockTimeSlots}
                      disabled={selectedTimeSlots.length === 0}
                      data-action="block-slots"
                    >
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Block Slots
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200 w-full"
                      onClick={handleMakeAvailable}
                      disabled={selectedTimeSlots.length === 0}
                      data-action="make-available"
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Make Available
                    </Button>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t text-sm text-muted-foreground">
                    {selectedTimeSlots.length > 0 ? (
                      <div>{selectedTimeSlots.length} slots selected</div>
                    ) : (
                      <div>Select time slots to enable actions</div>
                    )}
                  </div>
                </div>
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create Manual Booking</DialogTitle>
            <DialogDescription>
              Create a booking for the selected time slots.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
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

              <FormField
                control={bookingForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional notes about this booking"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="p-4 rounded-md bg-muted">
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
            </form>
          </Form>
          </ScrollArea>
          
          <DialogFooter className="mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsBookingDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createBookingMutation.isPending}
              onClick={() => bookingForm.handleSubmit(onBookingSubmit)()}
            >
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
              

              
              <div className="p-4 rounded-md bg-muted">
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
