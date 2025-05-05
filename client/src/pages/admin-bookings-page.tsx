import AdminCalendarView from "@/components/admin/calendar-view";
import AdminLayout from "@/components/admin/admin-layout";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AdminBookingsPage = () => {
  const [location, navigate] = useLocation();
  
  // Get any URL parameters (for potentially highlighting specific bookings)
  const params = new URLSearchParams(location.split("?")[1]);
  const reference = params.get("reference");
  
  // If a reference is provided, we could highlight that booking in the calendar
  useEffect(() => {
    if (reference) {
      // The calendar component would need to be updated to support highlighting a specific booking
      console.log("Should highlight booking with reference:", reference);
    }
  }, [reference]);

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mr-2"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Booking Management</h1>
        </div>
        
        {/* This is the original AdminCalendarView component */}
        <AdminCalendarView />
      </div>
    </AdminLayout>
  );
};

export default AdminBookingsPage;