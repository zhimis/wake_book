import React from "react";
import AdminLayout from "@/components/admin/admin-layout";
import AdminSystemConfig from "@/components/admin/system-config";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const SystemConfigPage = () => {
  const [_, navigate] = useLocation();

  return (
    <AdminLayout>
      <div className="px-1 py-2 sm:p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <h1 className="text-2xl font-bold">System Configuration</h1>
          <Button 
            variant="outline"
            className="text-xs sm:text-sm"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="truncate">Back to Dashboard</span>
          </Button>
        </div>
        
        <AdminSystemConfig />
      </div>
    </AdminLayout>
  );
};

export default SystemConfigPage;