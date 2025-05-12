import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/**
 * A debug component to analyze specific bookings and time slots
 * This is used to troubleshoot display issues with specific bookings
 */
const BookingDebug: React.FC<{
  reference: string;
}> = ({ reference }) => {
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<any>(null);
  const [slotsData, setSlotsData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDebugData() {
      try {
        setLoading(true);
        
        // Fetch booking data
        const bookingResponse = await fetch(`/api/bookings/${reference}`);
        if (!bookingResponse.ok) {
          throw new Error(`Failed to fetch booking: ${bookingResponse.statusText}`);
        }
        
        const bookingData = await bookingResponse.json();
        setBookingData(bookingData);
        
        // If booking has time slots, get details for each one
        if (bookingData?.booking?.timeSlots && bookingData.booking.timeSlots.length > 0) {
          // First, get the date of the first slot to know which week to fetch
          const firstSlotDate = new Date(bookingData.booking.timeSlots[0].startTime);
          const startOfWeek = new Date(firstSlotDate);
          startOfWeek.setDate(firstSlotDate.getDate() - firstSlotDate.getDay() + 1); // Monday
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
          
          // Fetch all time slots for the week
          const timeSlotResponse = await fetch(
            `/api/timeslots?startDate=${startOfWeek.toISOString()}&endDate=${endOfWeek.toISOString()}`
          );
          
          if (!timeSlotResponse.ok) {
            throw new Error(`Failed to fetch time slots: ${timeSlotResponse.statusText}`);
          }
          
          const timeSlotData = await timeSlotResponse.json();
          
          // Find the slots that match this booking reference
          const matchingSlots = timeSlotData.timeSlots.filter(
            (slot: any) => slot.bookingReference === reference
          );
          
          setSlotsData(matchingSlots);
        }
      } catch (err: any) {
        console.error('Error in BookingDebug:', err);
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    if (reference) {
      fetchDebugData();
    }
  }, [reference]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyzing Booking</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Debug Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Debug: {reference}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Booking details */}
          <div>
            <h3 className="text-lg font-medium">Booking Details</h3>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(bookingData, null, 2)}
            </pre>
          </div>
          
          {/* Time slots */}
          <div>
            <h3 className="text-lg font-medium">Time Slots ({slotsData.length})</h3>
            {slotsData.length > 0 ? (
              <div className="space-y-2">
                {slotsData.map((slot) => (
                  <div key={slot.id} className="bg-gray-100 p-2 rounded">
                    <p className="text-xs font-mono">ID: {slot.id}</p>
                    <p className="text-xs">
                      Time: {new Date(slot.startTime).toLocaleTimeString()} - {new Date(slot.endTime).toLocaleTimeString()}
                    </p>
                    <p className="text-xs">Status: {slot.status}</p>
                    <p className="text-xs">Booking Ref: {slot.bookingReference || 'None'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No time slots found</p>
            )}
          </div>
          
          {/* Date context info */}
          <div>
            <h3 className="text-lg font-medium">Date Context</h3>
            <p className="text-sm">Today: {new Date().toLocaleDateString()}</p>
            {bookingData?.booking?.timeSlots && bookingData.booking.timeSlots[0] && (
              <p className="text-sm">
                Booking date: {new Date(bookingData.booking.timeSlots[0].startTime).toLocaleDateString()}
              </p>
            )}
            <p className="text-sm">
              Days until booking: {bookingData?.booking?.timeSlots && bookingData.booking.timeSlots[0] ? 
                Math.floor((new Date(bookingData.booking.timeSlots[0].startTime).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 
                'N/A'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookingDebug;