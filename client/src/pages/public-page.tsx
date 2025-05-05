import React, { useState } from "react";
import PublicCalendarView from "@/components/calendar/public-calendar-view";
import CalendarControls from "@/components/calendar/calendar-controls";
import { TimeSlot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import BookingForm from "@/components/booking-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PublicPage = () => {
  const { toast } = useToast();
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);

  const handleSlotsSelected = (slots: TimeSlot[]) => {
    setSelectedSlots(slots);
    setShowBookingForm(true);
  };

  const handleClearSelection = () => {
    setSelectedSlots([]);
    setShowBookingForm(false);
  };

  const handleProceedToBooking = () => {
    if (selectedSlots.length === 0) {
      toast({
        title: "No slots selected",
        description: "Please select at least one time slot to book.",
        variant: "destructive",
      });
      return;
    }
    setShowBookingForm(true);
  };

  const handleBackToCalendar = () => {
    setShowBookingForm(false);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Booking Calendar (New Component Version)</h1>
      
      {!showBookingForm ? (
        <>
          <PublicCalendarView 
            onSlotsSelected={handleSlotsSelected}
            enableMultiSelect={true}
            showBookButton={false}
          />
          
          <CalendarControls 
            viewMode="public"
            selectedSlots={selectedSlots}
            onClearSelection={handleClearSelection}
            onProceedToBooking={handleProceedToBooking}
          />
        </>
      ) : (
        <div>
          <Button 
            variant="outline" 
            className="mb-4"
            onClick={handleBackToCalendar}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Calendar
          </Button>
          
          <BookingForm 
            selectedSlots={selectedSlots}
            onCancel={handleBackToCalendar}
          />
        </div>
      )}
    </div>
  );
};

export default PublicPage;