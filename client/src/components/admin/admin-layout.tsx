import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  BarChart2, 
  LogOut, 
  Menu, 
  X 
} from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetClose 
} from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { logoutMutation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate("/admin/login");
  };

  const navigationItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: <LayoutDashboard className="h-5 w-5 mr-2" />
    },
    {
      name: "Bookings",
      path: "/admin/bookings",
      icon: <Calendar className="h-5 w-5 mr-2" />
    },
    {
      name: "Configuration",
      path: "/admin",
      pathParams: "?tab=configuration",
      icon: <Settings className="h-5 w-5 mr-2" />,
      onClick: () => {
        localStorage.setItem("adminActiveTab", "configuration");
        navigate("/admin");
      }
    },
    {
      name: "Statistics",
      path: "/admin",
      pathParams: "?tab=statistics",
      icon: <BarChart2 className="h-5 w-5 mr-2" />,
      onClick: () => {
        localStorage.setItem("adminActiveTab", "statistics");
        navigate("/admin");
      }
    }
  ];

  const isActive = (item: typeof navigationItems[0]) => {
    if (item.path === "/admin" && item.pathParams) {
      // For old admin pages that use the tab parameter
      return location === item.path;
    }
    return location === item.path;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navigation bar */}
      <div className="bg-white border-b p-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-lg font-bold mr-4">Hi Wake Admin</h1>
          
          {/* Desktop navigation */}
          <div className="hidden md:flex space-x-4">
            {navigationItems.map((item) => (
              <Button
                key={item.name}
                variant={isActive(item) ? "default" : "ghost"}
                size="sm"
                onClick={item.onClick || (() => navigate(item.path))}
                className={cn(
                  "flex items-center",
                  isActive(item) ? "bg-blue-600 text-white hover:bg-blue-700" : ""
                )}
              >
                {item.icon}
                {item.name}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Mobile menu button */}
        <div className="md:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <div className="flex flex-col space-y-4 mt-6">
                {navigationItems.map((item) => (
                  <SheetClose key={item.name} asChild>
                    <Button
                      variant={isActive(item) ? "default" : "ghost"}
                      onClick={item.onClick || (() => navigate(item.path))}
                      className="justify-start"
                    >
                      {item.icon}
                      {item.name}
                    </Button>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Button 
                    variant="ghost" 
                    onClick={handleLogout}
                    className="justify-start text-red-500 hover:text-red-600"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Logout
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Desktop logout button */}
        <div className="hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-red-500 hover:text-red-600"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
}

export default AdminLayout;