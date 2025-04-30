import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import AdminCalendarView from "@/components/admin/calendar-view";
import AdminSystemConfig from "@/components/admin/system-config";
import AdminStatistics from "@/components/admin/statistics";

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("bookings");
  
  // Check localStorage for any tab selection from header menu
  useEffect(() => {
    const storedTab = localStorage.getItem("adminActiveTab");
    if (storedTab) {
      setActiveTab(storedTab);
      // Clear it once used
      localStorage.removeItem("adminActiveTab");
    }
  }, []);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  return (
    <main className="container mx-auto px-0.5 py-1">
      <div className="mb-2">
        <h2 className="text-lg font-heading font-medium text-black">Admin Dashboard</h2>
      </div>
      
      <Tabs defaultValue="bookings" value={activeTab} onValueChange={handleTabChange}>
        {/* Remove the tab navigation UI as requested */}
        
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
