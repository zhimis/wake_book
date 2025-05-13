import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadTimeSettingsFormData, leadTimeSettingsFormSchema } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Clock, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function LeadTimeSettingsForm() {
  const queryClient = useQueryClient();

  // Fetch current lead time settings
  const { data: leadTimeSettings, isLoading } = useQuery({
    queryKey: ['/api/admin/lead-time-settings'],
    retry: false,
    staleTime: 0, // Always refetch to get the latest data
  });

  console.log("Fetched lead time settings:", leadTimeSettings);

  // Form setup with defaults 
  const form = useForm<LeadTimeSettingsFormData>({
    resolver: zodResolver(leadTimeSettingsFormSchema),
    defaultValues: {
      restrictionMode: "off",
      leadTimeHours: 0,
      operatorOnSite: false,
    },
  });

  // Update form when data is loaded
  React.useEffect(() => {
    if (leadTimeSettings) {
      console.log("Setting form values from fetched data:", leadTimeSettings);
      form.reset({
        restrictionMode: leadTimeSettings.restrictionMode, 
        leadTimeHours: leadTimeSettings.leadTimeHours,
        operatorOnSite: leadTimeSettings.operatorOnSite,
      });
    }
  }, [leadTimeSettings, form]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: LeadTimeSettingsFormData) => {
      console.log("Submitting lead time settings data:", data);
      const response = await apiRequest('POST', '/api/admin/lead-time-settings', data);
      const result = await response.json();
      console.log("Lead time settings update response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Lead time settings updated successfully:", data);
      
      // Explicitly update the cache with the new data
      queryClient.setQueryData(['/api/admin/lead-time-settings'], data.settings);
      
      // Invalidate the query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/admin/lead-time-settings'] });
      
      toast({
        title: "Settings updated",
        description: "Lead time settings have been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating lead time settings:", error);
      toast({
        title: "Error updating settings",
        description: "There was a problem updating the lead time settings.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: LeadTimeSettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading settings...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Lead Time Settings
        </CardTitle>
        <CardDescription>
          Configure how far in advance customers need to book
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6">
              <FormField
                control={form.control}
                name="restrictionMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restriction Mode</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select restriction mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="enforced">Enforced (Always apply lead time)</SelectItem>
                        <SelectItem value="booking_based">Booking-based (Only when no bookings exist)</SelectItem>
                        <SelectItem value="off">Off (No lead time restrictions)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="leadTimeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operatorOnSite"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Operator On-Site</FormLabel>
                      <FormDescription>
                        Override all lead time restrictions when operator is present
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                Lead time restrictions affect when customers can make online bookings.
                {form.watch("restrictionMode") === "enforced" && (
                  <>
                    <br />
                    <strong>Enforced mode</strong> will block all online bookings that don't meet the lead time requirement.
                  </>
                )}
                {form.watch("restrictionMode") === "booking_based" && (
                  <>
                    <br />
                    <strong>Booking-based mode</strong> will allow bookings outside the lead time if there are existing bookings for that day.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <Button 
              type="submit" 
              className="w-full"
              disabled={updateMutation.isPending || !form.formState.isDirty}
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Small helper component to add when necessary
const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className="text-sm text-muted-foreground"
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";