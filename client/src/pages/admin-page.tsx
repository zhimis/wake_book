import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import AdminCalendarView from "@/components/admin/calendar-view";
import AdminSystemConfig from "@/components/admin/system-config";
import AdminStatistics from "@/components/admin/statistics";

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("bookings");
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  return (
    <main className="container mx-auto px-0.5 py-1">
      <div className="mb-2">
        <h2 className="text-lg font-heading font-medium text-gray-800">Admin Dashboard</h2>
      </div>
      
      <Tabs defaultValue="bookings" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="border-b border-gray-200 w-full justify-start rounded-none bg-transparent">
          <TabsTrigger 
            value="bookings"
            className="data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 rounded-none border-b-2 border-transparent"
          >
            Bookings
          </TabsTrigger>
          <TabsTrigger 
            value="configuration"
            className="data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 rounded-none border-b-2 border-transparent"
          >
            System Configuration
          </TabsTrigger>
          <TabsTrigger 
            value="statistics"
            className="data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:border-b-2 rounded-none border-b-2 border-transparent"
          >
            Statistics
          </TabsTrigger>
        </TabsList>
        
        <div className="mt-4">
          <TabsContent value="bookings">
            <AdminCalendarView />
          </TabsContent>
          
          <TabsContent value="configuration">
            <AdminSystemConfig />
          </TabsContent>
          
          <TabsContent value="statistics">
            <AdminStatistics />
          </TabsContent>
        </div>
      </Tabs>
    </main>
  );
};

export default AdminPage;
