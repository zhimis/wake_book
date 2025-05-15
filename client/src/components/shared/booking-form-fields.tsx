import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { AdminCustomBookingData, BookingFormData } from "@shared/schema";

// Create a union type for the booking form fields
type CommonBookingFields = {
  phoneNumber: string;
  email?: string;
  notes?: string;
};

// This type allows the component to work with either booking form type
type BookingFormFieldsProps = {
  form: UseFormReturn<any>; // Use any to avoid type conflicts
  readOnly?: {
    name?: boolean;
    phone?: boolean;
    email?: boolean;
  };
  nameLabel?: string;
};

/**
 * Shared booking form fields component that can be used in both regular and admin booking forms
 */
export function BookingFormFields({ 
  form, 
  readOnly = {}, 
  nameLabel = "Full Name" 
}: BookingFormFieldsProps) {
  // Determine the field names based on the form type (admin vs regular)
  // AdminCustomBookingData uses "customerName", while BookingFormData uses "fullName"
  const nameField = "customerName" in form.getValues() ? "customerName" : "fullName";
  
  return (
    <>
      <FormField
        control={form.control}
        // @ts-ignore - We're handling the field name dynamically
        name={nameField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{nameLabel}</FormLabel>
            <FormControl>
              <Input 
                placeholder="Enter name" 
                {...field} 
                readOnly={readOnly.name}
                className={readOnly.name ? "bg-muted cursor-not-allowed" : ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="phoneNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone Number</FormLabel>
            <FormControl>
              <Input 
                placeholder="+371 12345678" 
                {...field} 
                readOnly={readOnly.phone}
                className={readOnly.phone ? "bg-muted cursor-not-allowed" : ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input 
                placeholder="email@example.com" 
                {...field} 
                readOnly={readOnly.email}
                className={readOnly.email ? "bg-muted cursor-not-allowed" : ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Input placeholder="Any special requests or notes" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}