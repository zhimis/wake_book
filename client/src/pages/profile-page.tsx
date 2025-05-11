import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { format } from "date-fns";
import { getQueryFn } from "@/lib/queryClient";
import { Loader2, Clock, CalendarDays, User, Phone, Mail } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

// Type for user bookings
interface UserBooking {
  id: number;
  reference: string;
  createdAt: string;
  customerName: string;
  phoneNumber: string;
  email: string | null;
  totalPrice: number;
  slots: {
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

  // Redirect to auth page if not logged in
  if (!isLoading && !user) {
    return <Redirect to="/auth" />;
  }

  // Fetch user bookings
  const {
    data: userBookings,
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useQuery<UserBooking[]>({
    queryKey: ["/api/user/bookings"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  useEffect(() => {
    document.title = "My Profile | Hi Wake 2.0";
  }, []);

  if (isLoading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm");
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
                  View all your wake park bookings
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
                              {formatDate(booking.createdAt)}
                            </div>
                          </div>
                          <Badge className="mt-2 md:mt-0">
                            Total: €{booking.totalPrice.toFixed(2)}
                          </Badge>
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
                            {booking.slots.map((slot) => (
                              <TableRow key={slot.id}>
                                <TableCell>
                                  {formatDate(slot.startTime)}
                                </TableCell>
                                <TableCell>
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </TableCell>
                                <TableCell>30 min</TableCell>
                                <TableCell className="text-right">
                                  €{slot.price.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
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
    </div>
  );
};

export default ProfilePage;