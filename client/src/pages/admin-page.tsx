import { useState, useEffect } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminCalendarView from "@/components/admin/calendar-view";
import AdminSystemConfig from "@/components/admin/system-config";
import AdminStatistics from "@/components/admin/statistics";
import AdminCreateBooking from "@/components/admin/admin-create-booking";

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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-4">
                {/* Main calendar component */}
                <AdminCalendarView />
              </div>
              
              <div className="w-full">
                {/* Side panel with quick actions */}
                <Card>
                  <CardContent className="pt-6 px-4">
                    <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                    <div className="space-y-4">
                      {/* Admin action buttons for calendar */}
                      <AdminCreateBooking />
                      
                      <div className="pt-4">
                        <h4 className="text-sm font-medium mb-2">Selected Slots Actions:</h4>
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // Redirect to the /admin/bookings page to make sure we're on the right page
                              window.location.href = "/admin/bookings";
                            }}
                            disabled={true}
                            className="w-full justify-start bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg>
                            Block Selected Slots
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // Redirect to the /admin/bookings page to make sure we're on the right page
                              window.location.href = "/admin/bookings";
                            }}
                            disabled={true}
                            className="w-full justify-start bg-green-50 text-green-600 hover:bg-green-100 border-green-200"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>
                            Make Slots Available
                          </Button>
                        </div>
                      </div>
                      
                      {/* Buttons for common admin tasks */}
                      <div className="space-y-2 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => window.location.href = "/admin/configuration"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          System Configuration
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => window.location.href = "/admin/statistics"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M3 3v18h18"></path><path d="M18 3v18"></path><path d="M10 18V8"></path><path d="M14 18v-6"></path><path d="M6 18v-2"></path></svg>
                          View Statistics
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
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
