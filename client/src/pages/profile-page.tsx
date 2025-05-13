import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { format, isFuture, parseISO } from "date-fns";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { formatInLatviaTime } from "@/lib/utils";
import { Loader2, CalendarDays, User, Phone, Mail, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useToast } from "@/hooks/use-toast";

// Type for cancellable check response
interface CancellationStatus {
  cancellable: boolean;
  reason: string | null;
  hours: number;
}

// Type for user bookings
interface UserBooking {
  id: number;
  reference: string;
  createdAt: string;
  customerName: string;
  phoneNumber: string;
  email: string | null;
  totalPrice?: number;
  timeSlots: {
    id: number;
    startTime: string;
    endTime: string;
    price: number;
    status: string;
  }[];
}

const ProfilePage = () => {
  const { user, isLoading, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Redirect to auth page if not logged in
  if (!isLoading && !user) {
    return <Redirect to="/auth" />;
  }

  // Fetch user bookings
  const {
    data: userBookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchUserBookings,  // Rename to match what we use in the cancellation handler
  } = useQuery<UserBooking[]>({
    queryKey: ["/api/user/bookings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  // Check if the booking can be cancelled
  const {
    data: cancellationStatus,
    isLoading: isCancellationCheckLoading,
    error: cancellationCheckError,
    refetch: refetchCancellationStatus,
  } = useQuery<CancellationStatus>({
    queryKey: [`/api/bookings/${selectedBookingId}/cancellable`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!selectedBookingId,
  });

  // Mutation for cancellation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      return apiRequest("DELETE", `/api/bookings/${bookingId}`);
    },
    onSuccess: (data) => {
      setIsCancellationDialogOpen(false);
      setSelectedBookingId(null);
      setCancellationError(null);
      setSuccessDialogOpen(true);
      
      console.log("ProfilePage: Booking successfully cancelled");
      
      // Get the booking reference if we have it in the data response
      const bookingReference = data?.booking?.reference || '';
      
      // Set localStorage flags to tell the homepage to refresh the calendar when loaded next
      localStorage.setItem('calendar_needs_refresh', 'true');
      localStorage.setItem('last_booking_action', 'cancellation');
      localStorage.setItem('last_booking_timestamp', Date.now().toString());
      localStorage.setItem('booking_reference', bookingReference);
      
      // Also refresh the current page's booking list
      // We'll do a direct refetch of the bookings query
      console.log("ProfilePage: Refreshing user bookings list");
      refetchUserBookings();
    },
    onError: (error: any) => {
      console.error("Error cancelling booking:", error);
      setCancellationError(error?.response?.data?.message || "Failed to cancel booking. Please try again later.");
    },
  });

  useEffect(() => {
    document.title = "My Profile | Hi Wake 2.0";
  }, []);

  // Reset cancellation error when dialog is closed
  useEffect(() => {
    if (!isCancellationDialogOpen) {
      setCancellationError(null);
    }
  }, [isCancellationDialogOpen]);

  // When a booking is selected, open the cancellation dialog
  const handleCancelBooking = (bookingId: number) => {
    setSelectedBookingId(bookingId);
    setIsCancellationDialogOpen(true);
    refetchCancellationStatus();
  };

  // Execute cancellation
  const confirmCancellation = () => {
    if (selectedBookingId && cancellationStatus?.cancellable) {
      cancelBookingMutation.mutate(selectedBookingId);
    } else {
      setCancellationError("This booking cannot be cancelled.");
      setTimeout(() => setIsCancellationDialogOpen(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      // Force page refresh to update UI state correctly
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm");
  };

  // Check if a booking is in the future
  const isBookingFuture = (booking: UserBooking): boolean => {
    if (!booking.timeSlots || booking.timeSlots.length === 0) return false;
    
    // Sort time slots by start time
    const sortedSlots = [...booking.timeSlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    // Check if the earliest slot is in the future
    return isFuture(new Date(sortedSlots[0].startTime));
  };

  // Get the selected booking object
  const getSelectedBooking = (): UserBooking | undefined => {
    return userBookings?.find(booking => booking.id === selectedBookingId);
  };

  return (
    <div className="container py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.firstName || user?.username}
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="mt-4 md:mt-0"
          >
            {logoutMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging out...
              </>
            ) : (
              "Sign Out"
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="bookings">My Bookings</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Your account and contact details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Name:</span>
                    <span>
                      {user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Email:</span>
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Phone:</span>
                    <span>{user?.phoneNumber || "Not provided"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Account Details</CardTitle>
                  <CardDescription>Information about your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Account Type:</span>
                    <Badge>{user && user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}</Badge>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Username:</span>
                    <span>{user?.username}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Member Since:</span>
                    <span>{user?.createdAt ? formatDate(user.createdAt.toString()) : '-'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bookings">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>My Bookings</CardTitle>
                <CardDescription>
                  View and manage your wake park bookings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : bookingsError ? (
                  <div className="text-center p-8 text-destructive">
                    Error loading bookings. Please try again later.
                  </div>
                ) : userBookings && userBookings.length > 0 ? (
                  <div className="space-y-6">
                    {userBookings.map((booking) => (
                      <div key={booking.id} className="border rounded-lg p-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
                          <div>
                            <h3 className="font-medium">
                              Booking #{booking.reference}
                            </h3>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <CalendarDays className="h-3.5 w-3.5 mr-1" />
                              Booked on {formatDate(booking.createdAt)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end mt-2 md:mt-0">
                            <Badge className="mb-2">
                              Total: €{typeof booking.totalPrice === 'number' 
                                ? booking.totalPrice.toFixed(2) 
                                : 'N/A'}
                            </Badge>
                            {isBookingFuture(booking) && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleCancelBooking(booking.id)}
                                className="text-sm"
                              >
                                Cancel Booking
                              </Button>
                            )}
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead className="text-right">Price</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {booking.timeSlots && Array.isArray(booking.timeSlots) && booking.timeSlots.map((slot) => (
                              <TableRow key={slot.id}>
                                <TableCell>
                                  {slot.startTime ? formatDate(slot.startTime) : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {slot.startTime && slot.endTime 
                                    ? `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`
                                    : 'N/A'}
                                </TableCell>
                                <TableCell>30 min</TableCell>
                                <TableCell className="text-right">
                                  €{typeof slot.price === 'number' 
                                    ? slot.price.toFixed(2) 
                                    : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Status indicators for past/future bookings */}
                        <div className="mt-4 text-sm flex items-center">
                          {isBookingFuture(booking) ? (
                            <Badge variant="outline" className="flex items-center gap-1 text-blue-500 border-blue-200 bg-blue-50">
                              <Clock size={14} />
                              Upcoming
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1 text-gray-500 border-gray-200">
                              <CheckCircle size={14} />
                              Completed
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">
                    You haven't made any bookings yet.
                    <div className="mt-4">
                      <Button asChild>
                        <a href="/">Book Wake Session</a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Cancellation Dialog */}
      <AlertDialog 
        open={isCancellationDialogOpen} 
        onOpenChange={setIsCancellationDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCancellationCheckLoading ? (
                "Checking cancellation policy..."
              ) : cancellationStatus?.cancellable ? (
                "Confirm Booking Cancellation"
              ) : (
                "Cannot Cancel Booking"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCancellationCheckLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Checking booking status...
                </div>
              ) : cancellationStatus?.cancellable ? (
                <>
                  <p>
                    Are you sure you want to cancel booking <strong>#{getSelectedBooking()?.reference}</strong>?
                  </p>
                  <p className="mt-2">
                    This action cannot be undone. All reserved time slots will be made available for other users.
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-2">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                  <p className="text-center">
                    {cancellationStatus?.reason || "Bookings can only be cancelled at least 24 hours before the scheduled time."}
                  </p>
                  {cancellationStatus?.hours !== undefined && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Your booking is only {cancellationStatus.hours} hours away.
                    </p>
                  )}
                </div>
              )}
              
              {cancellationError && (
                <div className="bg-destructive/10 p-3 rounded-md mt-3 text-destructive flex items-center">
                  <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p>{cancellationError}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {cancellationStatus?.cancellable && !isCancellationCheckLoading && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmCancellation();
                }}
                disabled={cancelBookingMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelBookingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Booking"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Booking Cancelled Successfully
            </DialogTitle>
            <DialogDescription>
              Your booking has been cancelled and time slots have been released.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;