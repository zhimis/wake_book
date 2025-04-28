import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2 } from "lucide-react";

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
  const [visibilityWeeks, setVisibilityWeeks] = useState<number>(4);
  
  // Set initial state values when data is loaded
  useState(() => {
    if (data) {
      // Transform operating hours data to include isOpen (inverse of isClosed)
      const transformedHours = (data.operatingHours || []).map(hour => ({
        ...hour,
        isOpen: !hour.isClosed
      }));
      setOperatingHoursState(transformedHours);
      setPricingState(data.pricing || []);
      setVisibilityWeeks(data.visibilityWeeks || 4);
    }
  });
  
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
  
  const updateVisibilityMutation = useMutation({
    mutationFn: async (weeks: number) => {
      const res = await apiRequest("PUT", "/api/config/visibility", { weeks });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/config'] });
      toast({
        title: "Configuration Updated",
        description: "Calendar visibility settings have been updated successfully.",
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
  
  // Handlers
  const handleOperatingHoursUpdate = (id: number, field: string, value: any) => {
    setOperatingHoursState(prev => 
      prev.map(hour => 
        hour.id === id ? { ...hour, [field]: value } : hour
      )
    );
  };
  
  const handlePricingUpdate = (id: number, field: string, value: any) => {
    setPricingState(prev => 
      prev.map(price => 
        price.id === id ? { ...price, [field]: value } : price
      )
    );
  };
  
  const saveOperatingHours = (id: number) => {
    const hourToUpdate = operatingHoursState.find(hour => hour.id === id);
    if (hourToUpdate) {
      updateOperatingHoursMutation.mutate({ 
        id, 
        data: {
          openTime: hourToUpdate.openTime,
          closeTime: hourToUpdate.closeTime,
          isClosed: !hourToUpdate.isOpen // Convert isOpen to isClosed (inverse)
        } 
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
          weekendMultiplier: priceToUpdate.weekendMultiplier ? parseFloat(priceToUpdate.weekendMultiplier) : null
        } 
      });
    }
  };
  
  const saveVisibility = () => {
    updateVisibilityMutation.mutate(visibilityWeeks);
  };
  
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
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  };
  
  return (
    <div id="configurationTab" className="admin-tab-content p-4 space-y-6">
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
                <Select 
                  value={typeof hour.openTime === 'string' ? hour.openTime.slice(0, 5) : '08:00'} 
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
                    {Array.from({ length: 13 }, (_, i) => i + 6).map(h => (
                      <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                        {h % 12 === 0 ? '12' : h % 12}:00 {h < 12 ? 'AM' : 'PM'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <span className="text-gray-500">to</span>
                
                <Select 
                  value={typeof hour.closeTime === 'string' ? hour.closeTime.slice(0, 5) : '22:00'} 
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
                    {Array.from({ length: 13 }, (_, i) => i + 12).map(h => (
                      <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                        {h % 12 === 0 ? '12' : h % 12}:00 {h < 12 ? 'AM' : 'PM'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
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
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => saveOperatingHours(hour.id)}
                disabled={updateOperatingHoursMutation.isPending}
              >
                {updateOperatingHoursMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Pricing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pricingState.map((price) => (
            <div key={price.id} className="space-y-3">
              <h4 className="font-heading font-medium text-gray-700">
                {price.name === 'standard' ? 'Standard Pricing' : 
                 price.name === 'peak' ? 'Peak Hours Pricing' : 
                 'Weekend Pricing'}
              </h4>
              
              {price.name === 'standard' || price.name === 'peak' ? (
                <div className="flex items-center">
                  <span className="mr-2">Price per 30 minutes:</span>
                  <div className="flex items-center">
                    <span className="text-gray-500 mr-1">$</span>
                    <Input
                      type="number"
                      value={price.price}
                      min="0"
                      step="5"
                      className="w-24"
                      onChange={(e) => handlePricingUpdate(price.id, 'price', e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-4"
                    onClick={() => savePricing(price.id)}
                    disabled={updatePricingMutation.isPending}
                  >
                    {updatePricingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              ) : price.name === 'weekend' ? (
                <div className="flex items-center">
                  <span className="mr-2">Weekend multiplier:</span>
                  <div className="flex items-center">
                    <Input
                      type="number"
                      value={price.weekendMultiplier}
                      min="1"
                      step="0.1"
                      className="w-24"
                      onChange={(e) => handlePricingUpdate(price.id, 'weekendMultiplier', e.target.value)}
                    />
                    <span className="text-gray-500 ml-1">x</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-4"
                    onClick={() => savePricing(price.id)}
                    disabled={updatePricingMutation.isPending}
                  >
                    {updatePricingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
      
      {/* Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Calendar Visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <span className="mr-2">Show bookings up to:</span>
            <Select 
              value={visibilityWeeks.toString()} 
              onValueChange={(value) => setVisibilityWeeks(parseInt(value))}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Select weeks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 week ahead</SelectItem>
                <SelectItem value="2">2 weeks ahead</SelectItem>
                <SelectItem value="3">3 weeks ahead</SelectItem>
                <SelectItem value="4">4 weeks ahead</SelectItem>
                <SelectItem value="6">6 weeks ahead</SelectItem>
                <SelectItem value="8">8 weeks ahead</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline"
              className="ml-4"
              onClick={saveVisibility}
              disabled={updateVisibilityMutation.isPending}
            >
              {updateVisibilityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Visibility"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemConfig;
