import React, { useState } from "react";
import AdminCalendarView from "@/components/calendar/admin-calendar-view";
import CalendarControls from "@/components/calendar/calendar-controls";
import AdminLayout from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeSlot } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckSquare, Square, Plus } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AdminCreateBooking from "@/components/admin/admin-create-booking";

const NewAdminPage = () => {
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [showSlotDetails, setShowSlotDetails] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  const handleSlotSelection = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setShowSlotDetails(true);
  };

  const handleSlotsSelected = (slots: TimeSlot[]) => {
    setSelectedSlots(slots);
  };

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setSelectedWeekStart(startDate);
  };

  const handleClearSelection = () => {
    setSelectedSlots([]);
  };

  const toggleMultiSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    if (multiSelectMode) {
      // Clear selections when turning off multi-select mode
      setSelectedSlots([]);
    }
  };

  const handleRegenerateSlots = () => {
    // This would be handled directly by the CalendarControls component
    // through the mutation
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Booking Management (New Component)</h1>
          <div className="flex space-x-2">
            <Button 
              variant={multiSelectMode ? "default" : "outline"}
              onClick={toggleMultiSelectMode}
            >
              {multiSelectMode ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {multiSelectMode ? "Multi-Select On" : "Multi-Select Off"}
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.location.href = "/admin/bookings"}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Original View
            </Button>
            {selectedSlots.length > 0 && multiSelectMode ? (
              <AdminCreateBooking 
                buttonVariant="default"
                initialSelectedSlots={selectedSlots.filter(slot => slot.status === 'available')} 
                onBookingComplete={handleClearSelection}
                isStandalone={true} 
              />
            ) : (
              <AdminCreateBooking isStandalone={true} />
            )}
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Calendar View</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminCalendarView 
              onSlotSelect={handleSlotSelection}
              onDateRangeChange={handleDateRangeChange}
              onSlotsSelected={handleSlotsSelected}
              enableMultiSelect={multiSelectMode}
            />
            
            <CalendarControls 
              viewMode="admin"
              selectedSlots={selectedSlots}
              selectedWeekStart={selectedWeekStart || undefined}
              onClearSelection={handleClearSelection}
              onRegenerateSlots={handleRegenerateSlots}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* Slot Details Dialog */}
      {selectedSlot && (
        <Dialog open={showSlotDetails} onOpenChange={setShowSlotDetails}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Time Slot Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {format(new Date(selectedSlot.startTime), "EEEE, MMMM d, yyyy")}
                </div>
                <div>
                  <span className="font-medium">Time:</span>{" "}
                  {format(new Date(selectedSlot.startTime), "HH:mm")} - {format(new Date(selectedSlot.endTime), "HH:mm")}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span className={`
                    px-2 py-1 rounded text-sm
                    ${selectedSlot.status === 'available' ? 'bg-green-100 text-green-800' : 
                      selectedSlot.status === 'booked' ? 'bg-red-100 text-red-800' :
                      selectedSlot.status === 'blocked' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'}
                  `}>
                    {selectedSlot.status}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Price:</span>{" "}
                  €{parseFloat(String(selectedSlot.price)).toFixed(2)}
                </div>
                {selectedSlot.status === 'booked' && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2">Booking Details</h4>
                    <p className="text-gray-500 text-sm">
                      Booking information would be displayed here...
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowSlotDetails(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
};

export default NewAdminPage;