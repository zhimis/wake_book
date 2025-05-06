import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Settings } from "lucide-react";
import { 
  getLatvianDayIndex, 
  getLatvianDayName, 
  toLatviaTime, 
  formatInLatviaTime, 
  formatWithTimezone,
  formatTime 
} from "@/lib/utils";
import { LeadTimeSettingsForm } from "./lead-time-settings-form";

const AdminSystemConfig = () => {
  const { toast } = useToast();
  
  // Fetch config data
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/config'],
    queryFn: async () => {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      return res.json();
    }
  });
  
  // State for edited values
  const [operatingHoursState, setOperatingHoursState] = useState<any[]>([]);
  const [pricingState, setPricingState] = useState<any[]>([]);
  
  // Set initial state values when data is loaded
  // This should be useEffect, not useState!
  useEffect(() => {
    if (data) {
      // Transform operating hours data:
      // 1. Include isOpen (inverse of isClosed)
      // 2. Convert UTC times from database to Latvia timezone for display
      const transformedHours = (data.operatingHours || []).map(hour => {
        // Log original times (stored in UTC)
        console.log(`Original stored times in UTC - openTime: ${hour.openTime}, closeTime: ${hour.closeTime}`);
        
        // Convert from UTC to Latvia time for display
        // Extract hours and minutes from the UTC time strings
        const openTimeStr = typeof hour.openTime === 'string' ? hour.openTime : '08:00';
        const closeTimeStr = typeof hour.closeTime === 'string' ? hour.closeTime : '22:00';
        
        // Parse hours and minutes from the UTC time strings
        const [openUTCHours, openUTCMinutes] = openTimeStr.split(':').map(Number);
        const [closeUTCHours, closeUTCMinutes] = closeTimeStr.split(':').map(Number);
        
        // Convert UTC to Latvia time (add 3 hours for Latvia summer time)
        const offset = 3; // Latvia summer time (EEST) is UTC+3
        const openLatviaHours = (openUTCHours + offset) % 24;
        const closeLatviaHours = (closeUTCHours + offset) % 24;
        
        // Format Latvia time as strings (HH:MM)
        const openLatviaTimeStr = `${openLatviaHours.toString().padStart(2, '0')}:${openUTCMinutes.toString().padStart(2, '0')}`;
        const closeLatviaTimeStr = `${closeLatviaHours.toString().padStart(2, '0')}:${closeUTCMinutes.toString().padStart(2, '0')}`;
        
        console.log(`Converted to Latvia time - openTime: ${openLatviaTimeStr}, closeTime: ${closeLatviaTimeStr}`);
        
        // Return the transformed hour object
        return {
          ...hour,
          isOpen: !hour.isClosed,
          // Keep the original UTC times for submission to the server
          openTime: openTimeStr,
          closeTime: closeTimeStr,
          // Store Latvia-formatted times for display in the dropdowns
          openTimeFormatted: openLatviaTimeStr,
          closeTimeFormatted: closeLatviaTimeStr
        };
      });
      
      // Sort days to follow Monday-first order (1, 2, 3, 4, 5, 6, 0)
      const sortedHours = [...transformedHours].sort((a, b) => {
        // Convert 0 (Sunday) to 7 for sorting purposes
        const aDayNum = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
        const bDayNum = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
        return aDayNum - bDayNum;
      });
      
      setOperatingHoursState(sortedHours);
      setPricingState(data.pricing || []);
    }
  }, [data]);
  
  // Mutations
  const updateOperatingHoursMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PUT", `/api/config/operating-hours/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Configuration Updated",
        description: "Operating hours have been updated successfully.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const updatePricingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PUT", `/api/config/pricing/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Configuration Updated",
        description: "Pricing has been updated successfully.",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Calendar visibility mutation removed
  
  // Handlers
  const handleOperatingHoursUpdate = (id: number, field: string, value: any) => {
    setOperatingHoursState(prev => 
      prev.map(hour => {
        if (hour.id !== id) return hour;
        
        // For non-time fields, just update directly
        if (field !== 'openTime' && field !== 'closeTime') {
          return { ...hour, [field]: value };
        }
        
        // For time fields (openTime/closeTime), handle Latvia time to UTC conversion
        // The value from UI is Latvia time (e.g., "12:00")
        const latviaTimeStr = typeof value === 'string' ? value : (field === 'openTime' ? '08:00' : '22:00');
        
        // Convert Latvia time to UTC time
        // Split the time string into hours and minutes
        const [latviaHours, latviaMinutes] = latviaTimeStr.split(':').map(Number);
        
        // Calculate UTC time (Latvia is UTC+3 in summer, UTC+2 in winter)
        // For this implementation, we'll use a fixed offset of 3 hours (summer time)
        const offset = 3; // Latvia summer time (EEST) is UTC+3
        let utcHours = latviaHours - offset;
        
        // Handle day wrapping for negative hours
        if (utcHours < 0) {
          utcHours += 24;
        }
        
        // Format the UTC time as a string (HH:MM)
        const utcTimeStr = `${utcHours.toString().padStart(2, '0')}:${latviaMinutes.toString().padStart(2, '0')}`;
        
        // Store the Latvia time as formatted display value and UTC time as the actual value
        const formattedField = `${field}Formatted`;
        const updatedHour = { 
          ...hour, 
          [field]: utcTimeStr, // Store UTC time in the database field
          [formattedField]: latviaTimeStr // Store Latvia time for display
        };
        
        console.log(`Updated ${field} - Latvia time (display): ${latviaTimeStr}, UTC time (stored): ${utcTimeStr}`);
        
        return updatedHour;
      })
    );
  };
  
  const handlePricingUpdate = (id: number, field: string, value: any) => {
    setPricingState(prev => 
      prev.map(price => 
        price.id === id ? { ...price, [field]: value } : price
      )
    );
  };
  
  const saveOperatingHours = async (id: number) => {
    try {
      const hourToUpdate = operatingHoursState.find(hour => hour.id === id);
      if (hourToUpdate) {
        // First update the operating hour
        await updateOperatingHoursMutation.mutateAsync({ 
          id, 
          data: {
            openTime: hourToUpdate.openTime,
            closeTime: hourToUpdate.closeTime,
            isClosed: !hourToUpdate.isOpen // Convert isOpen to isClosed (inverse)
          } 
        });
        
        // Then regenerate time slots with a separate call
        await apiRequest("POST", `/api/timeslots/regenerate`, {});
        
        // Refresh the data
        queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      }
    } catch (error) {
      console.error("Error updating operating hour:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update operating hour. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const saveAllOperatingHours = async () => {
    try {
      // First update all operating hours without regenerating time slots
      const promises = [];
      
      for (const hour of operatingHoursState) {
        const promise = apiRequest("PUT", `/api/config/operating-hours/${hour.id}`, {
          openTime: hour.openTime,
          closeTime: hour.closeTime,
          isClosed: !hour.isOpen
        });
        promises.push(promise);
      }
      
      // Wait for all operating hours to be updated
      await Promise.all(promises);
      
      // Then trigger a single regeneration of time slots
      await apiRequest("POST", `/api/timeslots/regenerate`, {});
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      
      toast({
        title: "Operating Hours Updated",
        description: "All operating hours have been updated successfully.",
        variant: "success", 
      });
    } catch (error) {
      console.error("Error updating operating hours:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update operating hours. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const savePricing = (id: number) => {
    const priceToUpdate = pricingState.find(price => price.id === id);
    if (priceToUpdate) {
      updatePricingMutation.mutate({ 
        id, 
        data: {
          price: parseFloat(priceToUpdate.price),
          // We no longer need weekend multiplier - simplify the pricing structure
          weekendMultiplier: null,
          applyToWeekends: false
        } 
      });
    }
  };
  
  const saveAllPricing = () => {
    // Save all pricing settings in sequence
    let promises = [];
    
    for (const price of pricingState) {
      // We now only need the price field - the system will apply peak pricing
      // based on hard-coded time rules (Mon-Fri 17-22, Sat-Sun all day)
      const promise = apiRequest("PUT", `/api/config/pricing/${price.id}`, {
        price: parseFloat(price.price),
        weekendMultiplier: null,
        applyToWeekends: false,
        startTime: null,
        endTime: null
      });
      promises.push(promise);
    }
    
    // Handle all promises
    Promise.all(promises)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/config'] });
        toast({
          title: "Pricing Updated",
          description: "All pricing settings have been updated successfully.",
          variant: "success",
        });
      })
      .catch((error) => {
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      });
  };
  
  // Add a dedicated function to regenerate time slots
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  const regenerateTimeSlots = async () => {
    try {
      setIsRegenerating(true);
      const response = await apiRequest("POST", "/api/timeslots/regenerate");
      const result = await response.json();
      
      toast({
        title: "Time Slots Regenerated",
        description: `Future time slots have been regenerated successfully, preserving ${result.preservedBookings} existing bookings.`,
        variant: "success",
      });
      
      // Refresh all data
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
    } catch (error) {
      toast({
        title: "Regeneration Failed",
        description: "Failed to regenerate time slots. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };
  
  // saveVisibility function removed
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 text-destructive text-center">
        Error loading configuration data. Please try again.
      </div>
    );
  }
  
  const getDayName = (dayOfWeek: number): string => {
    // dayOfWeek is in standard JS format (0=Sunday, 1=Monday, etc.)
    // Convert to Latvian day index first (0=Monday)
    const latvianDayIndex = getLatvianDayIndex(dayOfWeek);
    const dayName = getLatvianDayName(latvianDayIndex);
    
    // Log for debugging
    console.log(`Day conversion - JS day: ${dayOfWeek} (${dayOfWeek === 0 ? 'Sunday' : dayOfWeek === 1 ? 'Monday' : dayOfWeek === 2 ? 'Tuesday' : dayOfWeek === 3 ? 'Wednesday' : dayOfWeek === 4 ? 'Thursday' : dayOfWeek === 5 ? 'Friday' : 'Saturday'}) → Latvian: ${latvianDayIndex} (${dayName})`);
    
    return dayName;
  };
  
  return (
    <div id="configurationTab" className="admin-tab-content p-1 space-y-2">
      {/* Standard Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Standard Operating Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {operatingHoursState.map((hour) => (
            <div key={hour.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <span className="font-medium text-gray-700 w-24">{getDayName(hour.dayOfWeek)}</span>
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Select 
                    value={hour.openTimeFormatted || '08:00'} 
                    onValueChange={(value) => handleOperatingHoursUpdate(
                      hour.id, 
                      'openTime', 
                      value
                    )}
                    disabled={!hour.isOpen}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Open" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => i + 8).map(h => {
                        // Use direct Latvia time values (8:00-22:00)
                        // Display the hours directly without timezone conversion
                        const formattedHour = `${h.toString().padStart(2, '0')}:00`;
                        
                        return (
                          <SelectItem key={h} value={formattedHour}>
                            {formattedHour}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <span className="text-gray-500">to</span>
                
                <div className="relative">
                  <Select 
                    value={hour.closeTimeFormatted || '22:00'} 
                    onValueChange={(value) => handleOperatingHoursUpdate(
                      hour.id, 
                      'closeTime', 
                      value
                    )}
                    disabled={!hour.isOpen}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Close" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 15 }, (_, i) => i + 8).map(h => {
                        // Use direct Latvia time values (8:00-22:00)
                        // Display the hours directly without timezone conversion
                        const formattedHour = `${h.toString().padStart(2, '0')}:00`;
                        
                        return (
                          <SelectItem key={h} value={formattedHour}>
                            {formattedHour}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center ml-2">
                  <Switch
                    id={`open-${hour.id}`}
                    checked={hour.isOpen}
                    onCheckedChange={(checked) => handleOperatingHoursUpdate(hour.id, 'isOpen', checked)}
                  />
                  <Label htmlFor={`open-${hour.id}`} className="ml-2">
                    Open
                  </Label>
                </div>
              </div>
            </div>
          ))}
          
          <div className="pt-4 mt-4 border-t border-gray-200 flex justify-end">
            <Button 
              variant="default" 
              size="default"
              onClick={saveAllOperatingHours}
              disabled={updateOperatingHoursMutation.isPending}
              className="w-full sm:w-auto"
            >
              {updateOperatingHoursMutation.isPending ? 
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 
                "Save All Operating Hours"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Pricing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Configuration</CardTitle>
          <CardDescription>
            Set standard and peak prices for wakeboarding sessions. Peak hours are fixed to weekday evenings and weekends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pricingState.map((price) => (
            <div key={price.id} className="space-y-3">
              <h4 className="font-heading font-medium text-gray-700">
                {price.name === 'standard' ? 'Standard Pricing' : 
                 price.name === 'peak' ? 'Peak Hours Pricing' : 
                 'Weekend Pricing (Disabled)'}
              </h4>
              
              {price.name === 'standard' || price.name === 'peak' ? (
                <>
                  <div className="flex items-center">
                    <span className="mr-2">Price per 30 minutes:</span>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">€</span>
                      <Input
                        type="number"
                        value={price.price}
                        min="0"
                        step="5"
                        className="w-24"
                        onChange={(e) => handlePricingUpdate(price.id, 'price', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {price.name === 'peak' && (
                    <div className="mt-2 text-sm text-gray-500">
                      <p>Peak hours pricing applies during:</p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>Monday to Friday: 17:00-22:00 (Latvia time)</li>
                        <li>Saturday and Sunday: All day</li>
                      </ul>
                    </div>
                  )}
                </>
              ) : price.name === 'weekend' ? (
                <div className="p-3 border rounded border-gray-200 bg-gray-50">
                  <p className="text-gray-500 text-sm italic">
                    Weekend pricing has been replaced with the new simplified pricing model.
                    Weekend days are now automatically treated as peak hours.
                  </p>
                </div>
              ) : null}
            </div>
          ))}
          
          <div className="pt-4 mt-4 border-t border-gray-200 flex justify-end">
            <Button 
              variant="default" 
              size="default"
              onClick={saveAllPricing}
              disabled={updatePricingMutation.isPending}
              className="w-full sm:w-auto"
            >
              {updatePricingMutation.isPending ? 
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 
                "Save All Pricing"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Time Slot Management */}
      <Card>
        <CardHeader>
          <CardTitle>Time Slot Management</CardTitle>
          <CardDescription>
            Regenerate time slots to apply updated pricing rules and operating hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col space-y-2">
              <p className="text-sm text-gray-700">
                After making changes to operating hours or pricing, you can regenerate time slots to apply the new settings
                to all future time slots. This will preserve existing bookings while creating new available time slots.
              </p>
              
              <div className="p-3 border border-yellow-200 bg-yellow-50 rounded text-sm mb-4">
                <p className="font-medium text-amber-800">Peak hours are now applied based on the following fixed rules:</p>
                <ul className="list-disc pl-5 mt-1 text-amber-700">
                  <li>Monday to Friday: 17:00-22:00 (Latvia time)</li>
                  <li>Saturday and Sunday: All day</li>
                </ul>
              </div>
              
              <div className="flex justify-center mt-4">
                <Button 
                  variant="default"
                  onClick={regenerateTimeSlots}
                  disabled={isRegenerating}
                  className="w-full sm:w-auto py-6 text-lg bg-blue-600 hover:bg-blue-700"
                >
                  {isRegenerating ? 
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Regenerating Time Slots...</> : 
                    <><Settings className="h-5 w-5 mr-2" /> Regenerate All Time Slots</>}
                </Button>
              </div>
            </div>
            
            {/* Calendar visibility section removed */}
          </div>
        </CardContent>
      </Card>
      
      {/* Lead Time Settings */}
      <LeadTimeSettingsForm />
    </div>
  );
};

export default AdminSystemConfig;
