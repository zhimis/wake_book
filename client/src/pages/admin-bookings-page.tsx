import AdminCalendarView from "@/components/admin/calendar-view";
import AdminLayout from "@/components/admin/admin-layout";
import { useLocation } from "wouter";
import { useEffect } from "react";

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
      <div className="px-0.5 py-2 sm:p-4">
        <AdminCalendarView />
      </div>
    </AdminLayout>
  );
};

export default AdminBookingsPage;