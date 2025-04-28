import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminCalendarView from "@/components/admin/calendar-view";
import AdminSystemConfig from "@/components/admin/system-config";
import AdminStatistics from "@/components/admin/statistics";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
    <main className="container mx-auto px-0.5 py-2">
      <div className="mb-6">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-2xl font-heading font-bold text-gray-800">Admin Dashboard</h2>
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-2">Welcome, <span className="font-medium">{user?.username || 'Admin'}</span></span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
