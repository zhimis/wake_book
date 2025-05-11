import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger, 
  SheetClose 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  Menu,
  CalendarDays,
  Wallet,
  PhoneCall,
  LayoutDashboard,
  Calendar,
  Settings,
  BarChart2,
  Users,
  LogIn
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Define the structure of a navigation item
export interface NavigationItem {
  name: string;
  path: string;
  icon: ReactNode;
  onClick?: () => void;
  pathParams?: string;
}

// Props interface for the NavigationMenu component
interface NavigationMenuProps {
  isAdmin?: boolean;
}

export const NavigationMenu = ({ isAdmin = false }: NavigationMenuProps) => {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      // Force page refresh to update UI state correctly
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Public navigation items (available to all users)
  const publicNavigationItems: NavigationItem[] = [
    {
      name: "Booking",
      path: "/",
      icon: <CalendarDays className="h-5 w-5 mr-2" />
    },
    {
      name: "Prices",
      path: "/prices",
      icon: <Wallet className="h-5 w-5 mr-2" />
    },
    {
      name: "Contacts",
      path: "/contacts",
      icon: <PhoneCall className="h-5 w-5 mr-2" />
    }
  ];

  // Common admin navigation items (for all admin roles)
  const dashboardItem = {
    name: "Dashboard",
    path: "/admin/dashboard",
    icon: <LayoutDashboard className="h-5 w-5 mr-2" />
  };
  
  const bookingsItem = {
    name: "Bookings",
    path: "/admin/bookings",
    icon: <Calendar className="h-5 w-5 mr-2" />
  };
  
  const configItem = {
    name: "Configuration",
    path: "/admin/system-config",
    icon: <Settings className="h-5 w-5 mr-2" />
  };
  
  const usersItem = {
    name: "Users",
    path: "/admin/users",
    icon: <Users className="h-5 w-5 mr-2" />
  };
  
  const statsItem = {
    name: "Statistics",
    path: "/admin/statistics",
    icon: <BarChart2 className="h-5 w-5 mr-2" />
  };
  
  // Role-based navigation items
  const getRoleNavigationItems = (role: string): NavigationItem[] => {
    switch (role) {
      case 'admin':
        return [dashboardItem, bookingsItem, configItem, usersItem, statsItem];
      case 'manager':
        return [dashboardItem, bookingsItem, configItem, usersItem, statsItem];
      case 'operator':
        return [dashboardItem, bookingsItem, configItem, statsItem];
      case 'athlete':
        return [dashboardItem];
      default:
        return [dashboardItem];
    }
  };
  
  // Get navigation items based on user role (defaulting to empty array if no user)
  const adminNavigationItems = user && user.role ? getRoleNavigationItems(user.role) : [];

  // Check if an item is active (currently selected)
  const isActive = (item: NavigationItem) => {
    // For statistics tab
    if (item.name === "Statistics" && (location === "/admin/statistics" || (location === "/admin" && localStorage.getItem("adminActiveTab") === "statistics"))) {
      return true;
    }
    
    // For all other routes
    return location === item.path;
  };

  return (
    <Sheet>
      <SheetTrigger asChild className="ml-auto">
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-64">
        <div className="flex flex-col space-y-4 mt-6">
          {/* Public section (always visible) */}
          {publicNavigationItems.map((item) => (
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

          {/* Admin section (only visible for admin users) */}
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <div className="text-xs uppercase text-muted-foreground px-4 pb-2">
                {user && user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin'}
              </div>
              {adminNavigationItems.map((item) => (
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
            </>
          )}

          {/* Login/Logout button */}
          <Separator className="my-2" />
          
          {isAdmin ? (
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
          ) : (
            <SheetClose asChild>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/admin/login")}
                className="justify-start"
              >
                <LogIn className="h-5 w-5 mr-2" />
                Log In
              </Button>
            </SheetClose>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NavigationMenu;