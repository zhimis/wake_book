import React from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminCreateBooking from "./admin-create-booking";
import { useAuth } from "@/hooks/use-auth";

export function AdminQuickBookingButton() {
  const { user } = useAuth();
  
  // Only show this button for admin/manager/operator roles
  if (!user || (user.role !== "admin" && user.role !== "manager" && user.role !== "operator")) {
    return null;
  }
  
  return (
    <AdminCreateBooking
      isStandalone={true}
      triggerButton={
        <Button 
          className="fixed bottom-6 right-6 rounded-full h-12 w-12 p-0 shadow-lg bg-primary hover:bg-primary/90 text-white flex items-center justify-center transition-all hover:scale-105"
          aria-label="Create Booking"
          size="icon"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      }
      buttonVariant="default"
      buttonSize="icon"
    />
  );
}