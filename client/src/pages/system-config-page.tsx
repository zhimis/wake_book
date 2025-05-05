import React, { useState } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import AdminSystemConfig from "@/components/admin/system-config";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const SystemConfigPage = () => {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Regenerate time slots mutation
  const regenerateSlotsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/timeslots/regenerate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeslots"] });
      toast({
        title: "Time slots regenerated",
        description: "Time slots have been successfully regenerated based on current operating hours.",
        variant: "default",
      });
      setIsRegenerating(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to regenerate time slots",
        description: error.message,
        variant: "destructive",
      });
      setIsRegenerating(false);
    }
  });

  const handleRegenerateSlots = () => {
    setIsRegenerating(true);
    regenerateSlotsMutation.mutate();
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">System Configuration</h1>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              className="bg-blue-50 border-blue-200 hover:bg-blue-100"
              disabled={isRegenerating}
              onClick={handleRegenerateSlots}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Regenerating...' : 'Regenerate Time Slots'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate("/admin/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
        
        <AdminSystemConfig />
      </div>
    </AdminLayout>
  );
};

export default SystemConfigPage;