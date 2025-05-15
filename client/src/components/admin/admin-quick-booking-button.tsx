import React, { useState, Suspense } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

// Import the component as default import
const AdminCreateBooking = React.lazy(() => import("./admin-create-booking"));

export function AdminQuickBookingButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  
  // Only show this button for admin/manager/operator roles
  if (!user || (user.role !== "admin" && user.role !== "manager" && user.role !== "operator")) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="fixed bottom-6 right-6 rounded-full h-14 w-14 p-0 shadow-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all hover:scale-105 z-50"
          aria-label="Create Booking"
          size="icon"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Create New Booking</DialogTitle>
        </DialogHeader>
        
        <Suspense fallback={<div className="p-8 text-center">Loading booking form...</div>}>
          <AdminCreateBooking 
            isStandalone={false}
            externalOpenState={open}
            onOpenChange={setOpen}
            triggerButton={null}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}