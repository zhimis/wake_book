import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminCalendarView from "@/components/admin/calendar-view";
import AdminSystemConfig from "@/components/admin/system-config";
import AdminStatistics from "@/components/admin/statistics";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("bookings");
  const { user, logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  return (
    <main className="container mx-auto px-4 py-6 md:py-8">
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-heading font-bold text-gray-800 mb-4 md:mb-0">Admin Dashboard</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, <span className="font-medium">{user?.username || 'Admin'}</span></span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center gap-1"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
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
