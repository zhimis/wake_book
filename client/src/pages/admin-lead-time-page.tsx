import React from "react";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { LeadTimeSettingsForm } from "@/components/admin/lead-time-settings-form";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export function AdminLeadTimePage() {
  const { user, isLoading } = useAuth();

  // Redirect if not logged in
  if (!isLoading && !user) {
    return <Redirect to="/admin/login" />;
  }

  return (
    <AdminLayout>
      <div className="container mx-auto p-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Lead Time Configuration</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <LeadTimeSettingsForm />
        </div>
        
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">About Lead Time Settings</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">What is lead time?</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Lead time is the minimum amount of advance notice required for customers to make a booking. 
                For example, a lead time of 24 hours means customers must book at least 24 hours before their desired slot.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium">Restriction Modes</h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 mt-2">
                <li>
                  <strong>Enforced:</strong> This mode strictly enforces the lead time requirement for all online bookings. 
                  No exceptions are made.
                </li>
                <li>
                  <strong>Booking-based:</strong> Lead time is only enforced if there are no existing bookings for the target date.
                  If someone has already booked for that day, others can book with less notice.
                </li>
                <li>
                  <strong>Off:</strong> No lead time restrictions are applied. Customers can book any available slot regardless of how soon it is.
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium">Operator On-Site Override</h3>
              <p className="text-gray-600 dark:text-gray-300">
                When this option is enabled, all lead time restrictions are bypassed. 
                Use this when you're physically present at the park and want to allow immediate bookings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminLeadTimePage;