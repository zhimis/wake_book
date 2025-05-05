import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TimeSlot } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { format, addWeeks } from "date-fns";
import { Loader2, RefreshCw, Calendar } from "lucide-react";

interface CalendarControlsProps {
  viewMode: 'public' | 'admin';
  selectedSlots?: TimeSlot[];
  selectedWeekStart?: Date;
  onRegenerateSlots?: () => void;
  onClearSelection?: () => void;
  onProceedToBooking?: () => void;
}

const CalendarControls: React.FC<CalendarControlsProps> = ({
  viewMode,
  selectedSlots = [],
  selectedWeekStart,
  onRegenerateSlots,
  onClearSelection,
  onProceedToBooking
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Regenerate slots mutation (admin only)
  const regenerateSlotsMutation = useMutation({
    mutationFn: async (weekStart: Date) => {
      const startDate = new Date(weekStart);
      const endDate = addWeeks(startDate, 1);
      
      const response = await apiRequest("POST", "/api/timeslots/regenerate", {
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        fullWeek: true
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Time slots regenerated",
        description: "The time slots have been successfully regenerated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error regenerating time slots",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Handle regenerate slots
  const handleRegenerateSlots = () => {
    if (selectedWeekStart) {
      regenerateSlotsMutation.mutate(selectedWeekStart);
    } else if (onRegenerateSlots) {
      onRegenerateSlots();
    }
  };

  if (viewMode === 'public') {
    return (
      <Card className="mt-4">
        <CardContent className="pt-4">
          <div className="flex justify-between items-center">
            <div>
              {selectedSlots.length > 0 && (
                <Button variant="outline" onClick={onClearSelection}>
                  Clear Selection
                </Button>
              )}
            </div>
            <div>
              {selectedSlots.length > 0 && (
                <Button onClick={onProceedToBooking}>
                  Proceed to Booking ({selectedSlots.length} {selectedSlots.length === 1 ? 'slot' : 'slots'})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  } else {
    // Admin controls
    return (
      <Card className="mt-4">
        <CardContent className="pt-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleRegenerateSlots}
                disabled={regenerateSlotsMutation.isPending}
              >
                {regenerateSlotsMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate Time Slots
                  </>
                )}
              </Button>
            </div>
            
            <div className="flex space-x-2">
              {selectedSlots.length > 0 && (
                <Button variant="outline" onClick={onClearSelection}>
                  Clear Selection ({selectedSlots.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
};

export default CalendarControls;