import React from 'react';
import AdminStatistics from '@/components/admin/statistics';
import { AdminLayout } from '@/components/layouts/admin-layout';

const AdminStatisticsPage = () => {
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