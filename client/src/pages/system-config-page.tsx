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

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">System Configuration</h1>
          <Button 
            variant="outline"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        
        <AdminSystemConfig />
      </div>
    </AdminLayout>
  );
};

export default SystemConfigPage;