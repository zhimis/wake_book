import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import AdminStatistics from '@/components/admin/statistics';
import { AdminLayout } from '@/components/layouts/admin-layout';

const AdminStatisticsPage = () => {
  const [_, navigate] = useLocation();

  useEffect(() => {
    // Set the active tab to statistics and navigate to the admin page
    localStorage.setItem("adminActiveTab", "statistics");
    navigate("/admin");
  }, [navigate]);

  return (
    <AdminLayout pageTitle="Statistics">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-6">Statistics</h1>
        <AdminStatistics />
      </div>
    </AdminLayout>
  );
};

export default AdminStatisticsPage;