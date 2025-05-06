import AdminCalendarView from "@/components/calendar/admin-calendar-view";
import AdminLayout from "@/components/admin/admin-layout";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GridIcon, ListChecksIcon } from "lucide-react";

const AdminBookingsPage = () => {
  const [location, navigate] = useLocation();
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  
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
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Calendar Management</h1>
          <Button 
            variant={multiSelectMode ? "default" : "outline"}
            size="sm"
            onClick={() => setMultiSelectMode(!multiSelectMode)}
            className="flex items-center gap-1"
          >
            {multiSelectMode ? <ListChecksIcon className="h-4 w-4" /> : <GridIcon className="h-4 w-4" />}
            {multiSelectMode ? "Multi-Select Mode" : "Single-Select Mode"}
          </Button>
        </div>
        
        <AdminCalendarView 
          enableMultiSelect={multiSelectMode} 
        />
      </div>
    </AdminLayout>
  );
};

export default AdminBookingsPage;