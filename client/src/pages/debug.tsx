import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// Use a div as the layout since we don't have a layout component
// This keeps things simple for our debugging purposes
import BookingDebug from '../components/debug/booking-debug';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define the component without default export
function DebugPage() {
  // State for the booking reference input
  const [bookingRef, setBookingRef] = useState<string>('');
  // State for the active booking reference
  const [activeRef, setActiveRef] = useState<string>('');

  // Handle form submission
  const handleAnalyzeBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingRef.trim()) {
      setActiveRef(bookingRef.trim());
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Debug Tools</h1>
      
      <Tabs defaultValue="booking">
        <TabsList>
          <TabsTrigger value="booking">Booking Analysis</TabsTrigger>
          <TabsTrigger value="june1">June 1st Issue</TabsTrigger>
        </TabsList>
        
        <TabsContent value="booking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyze Booking</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAnalyzeBooking} className="flex gap-2">
                <Input 
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value)}
                  placeholder="Enter booking reference (e.g., WB-L_7LG1SG)"
                  className="flex-1"
                />
                <Button type="submit">Analyze</Button>
              </form>
            </CardContent>
          </Card>
          
          {activeRef && <BookingDebug reference={activeRef} />}
        </TabsContent>
        
        <TabsContent value="june1">
          <div className="grid grid-cols-1 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>June 1st Booking Issue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Troubleshooting the June 1st booking that's not showing properly in the calendar.
                </p>
                <Button 
                  onClick={() => setActiveRef('WB-L_7LG1SG')}
                  variant="outline"
                >
                  Analyze WB-L_7LG1SG (June 1st Booking)
                </Button>
              </CardContent>
            </Card>
            
            {activeRef === 'WB-L_7LG1SG' && <BookingDebug reference={activeRef} />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Export the component at the end of the file
export default DebugPage;