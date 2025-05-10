import React from "react";
import AdminLayout from "@/components/admin/admin-layout";
import AdminSystemConfig from "@/components/admin/system-config";

const SystemConfigPage = () => {
  return (
    <AdminLayout>
      <div className="px-1 py-2 sm:p-4">
        <AdminSystemConfig />
      </div>
    </AdminLayout>
  );
};

export default SystemConfigPage;