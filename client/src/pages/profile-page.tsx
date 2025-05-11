import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTimeSlot, formatPrice } from "@/lib/utils";
import { Loader2, User, CalendarDays, Clock } from "lucide-react";

const ProfilePage = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("bookings");

  useEffect(() => {
    // Set page title
    document.title = "My Profile | Hi Wake 2.0";
  }, []);

  // Get user's bookings
  const {
    data: bookings,
    isLoading: isBookingsLoading,
    error: bookingsError,
  } = useQuery({
    queryKey: ["/api/user/bookings"],
    enabled: !!user, // Only run query if user is logged in
  });

  // If not authenticated, redirect to login
  if (!isLoading && !user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="container py-6 min-h-[80vh]">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>

        {isLoading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* User Info Card */}
            <Card className="mb-8">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">
                      {user?.firstName
                        ? `${user.firstName} ${user.lastName || ""}`
                        : user?.email}
                    </CardTitle>
                    <CardDescription>{user?.email}</CardDescription>
                  </div>
                  <Badge variant="outline" className="uppercase">
                    {user?.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 text-muted-foreground">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    <span>Member since {new Date(user?.createdAt).toLocaleDateString()}</span>
                  </div>
                  {user?.phoneNumber && (
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>{user.phoneNumber}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabs for Profile Sections */}
            <Tabs
              defaultValue="bookings"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-8">
                <TabsTrigger value="bookings">My Bookings</TabsTrigger>
                <TabsTrigger value="account">Account Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="bookings" className="space-y-6">
                <h2 className="text-xl font-bold mb-4">Booking History</h2>

                {isBookingsLoading ? (
                  <div className="flex justify-center items-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : bookingsError ? (
                  <Card className="bg-destructive/10">
                    <CardContent className="pt-6">
                      <p>Failed to load bookings. Please try again later.</p>
                    </CardContent>
                  </Card>
                ) : !bookings || bookings.length === 0 ? (
                  <Card className="bg-muted">
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No bookings yet</h3>
                        <p className="text-muted-foreground mb-4">
                          You haven't made any bookings yet.
                        </p>
                        <Button variant="default" asChild>
                          <a href="/booking">Book a Session</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking: any) => (
                      <Card key={booking.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{booking.reference}</CardTitle>
                              <CardDescription>
                                {new Date(booking.createdAt).toLocaleDateString()}
                              </CardDescription>
                            </div>
                            <Badge
                              className={
                                new Date(booking.timeSlots[0]?.startTime) > new Date()
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }
                            >
                              {new Date(booking.timeSlots[0]?.startTime) > new Date()
                                ? "Upcoming"
                                : "Past"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {booking.timeSlots.map((slot: any) => (
                              <div
                                key={slot.id}
                                className="flex justify-between py-1 border-b border-border last:border-0"
                              >
                                <span>
                                  {formatDate(new Date(slot.startTime))} -{" "}
                                  {formatTimeSlot(
                                    new Date(slot.startTime),
                                    new Date(slot.endTime)
                                  )}
                                </span>
                                <span>{formatPrice(slot.price)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between mt-4 font-medium">
                            <span>Total:</span>
                            <span>
                              {formatPrice(
                                booking.timeSlots.reduce(
                                  (acc: number, slot: any) => acc + slot.price,
                                  0
                                )
                              )}
                            </span>
                          </div>
                        </CardContent>
                        <CardFooter className="bg-muted border-t flex justify-between">
                          <div>
                            {booking.equipmentRental && (
                              <Badge variant="outline" className="mr-2">
                                Equipment Rental
                              </Badge>
                            )}
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/confirmation/${booking.reference}`}>View Details</a>
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="account" className="space-y-6">
                <h2 className="text-xl font-bold mb-4">Account Information</h2>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-4">Personal Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Email</p>
                            <p className="font-medium">{user?.email}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Username</p>
                            <p className="font-medium">{user?.username}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">First Name</p>
                            <p className="font-medium">{user?.firstName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Last Name</p>
                            <p className="font-medium">{user?.lastName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Phone Number</p>
                            <p className="font-medium">{user?.phoneNumber || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-2">Account Actions</h3>
                        <div className="space-y-2">
                          <Button variant="outline" className="w-full sm:w-auto" asChild>
                            <a href="/api/logout">Sign Out</a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;