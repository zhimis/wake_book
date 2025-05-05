import BookingCalendar from "@/components/booking-calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AdminLayout from "@/components/admin/admin-layout";
import { Button } from "@/components/ui/button";
import { Plus, Users, BarChart3, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import AdminCreateBooking from "@/components/admin/admin-create-booking";

const AdminDashboardPage = () => {
  const [location, navigate] = useLocation();
  
  // Check if coming from URL with activeTab parameter
  useEffect(() => {
    // Check if we have the activeTab in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const activeTab = urlParams.get("activeTab");
    
    // If a tab is requested, redirect to the appropriate admin page
    if (activeTab === "configuration") {
      navigate("/admin/new?section=configuration");
    }
  }, [location, navigate]);

  // Fetch basic stats for the dashboard
  const { data: bookingsStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch statistics');
      return res.json();
    }
  });

  // Fetch most recent bookings
  const { data: recentBookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const res = await fetch('/api/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      return res.json();
    }
  });

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="mr-2"
              onClick={() => window.open("/admin/system-config", "_self")}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure System
            </Button>
            <AdminCreateBooking isStandalone={true} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? 
                  <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" /> : 
                  bookingsStats?.totalBookings || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? 
                  <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" /> : 
                  `€${bookingsStats?.totalRevenue?.toFixed(2) || '0.00'}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Booked Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? 
                  <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" /> : 
                  `${bookingsStats?.totalHours?.toFixed(1) || '0'} h`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Button 
            variant="outline" 
            className="flex items-center justify-center py-3 h-auto"
            onClick={() => navigate("/admin/bookings")}
          >
            <div className="flex flex-col items-center">
              <BarChart3 className="h-6 w-6 mb-1" />
              <span>View Bookings</span>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex items-center justify-center py-3 h-auto bg-blue-50 border-blue-200 hover:bg-blue-100"
            onClick={() => window.open("/admin/system-config", "_self")}
          >
            <div className="flex flex-col items-center">
              <Settings className="h-6 w-6 mb-1" />
              <span>Operating Hours</span>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex items-center justify-center py-3 h-auto"
            onClick={() => { 
              localStorage.setItem("adminActiveTab", "statistics"); 
              navigate("/admin"); 
            }}
          >
            <div className="flex flex-col items-center">
              <BarChart3 className="h-6 w-6 mb-1" />
              <span>Statistics</span>
            </div>
          </Button>
          
          <AdminCreateBooking
            triggerButton={
              <Button 
                variant="outline" 
                className="flex items-center justify-center py-3 h-auto w-full"
              >
                <div className="flex flex-col items-center">
                  <Plus className="h-6 w-6 mb-1" />
                  <span>Create Booking</span>
                </div>
              </Button>
            }
            isStandalone={true}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar View (using the public calendar component) */}
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Availability Calendar</CardTitle>
                <CardDescription>View booking availability for the current week</CardDescription>
              </CardHeader>
              <CardContent>
                <BookingCalendar />
              </CardContent>
            </Card>
          </div>

          {/* Recent Bookings */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Recent Bookings</CardTitle>
                <CardDescription>Latest booking activity</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingBookings ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentBookings?.slice(0, 5).map((booking: any) => (
                      <div 
                        key={booking.id} 
                        className="p-2 border rounded flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/admin/bookings?reference=${booking.reference}`)}
                      >
                        <div>
                          <div className="font-medium">{booking.customerName}</div>
                          <div className="text-xs text-muted-foreground">{new Date(booking.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {booking.reference.slice(0, 8)}
                        </div>
                      </div>
                    ))}
                    {(!recentBookings || recentBookings.length === 0) && (
                      <div className="text-muted-foreground text-center py-4">No recent bookings</div>
                    )}
                  </div>
                )}
                {!isLoadingBookings && recentBookings?.length > 0 && (
                  <Button
                    variant="link"
                    className="mt-2 w-full"
                    onClick={() => navigate("/admin/bookings")}
                  >
                    View All Bookings
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;