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
  BarChart2
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
    await logoutMutation.mutateAsync();
    navigate("/admin/login");
  };

  // Public navigation items (available to all users)
  const publicNavigationItems: NavigationItem[] = [
    {
      name: "Booking",
      path: "/",
      icon: <CalendarDays className="h-5 w-5 mr-2" />
    },
    {
      name: "Pricing",
      path: "/pricing",
      icon: <Wallet className="h-5 w-5 mr-2" />
    },
    {
      name: "Contacts",
      path: "/contacts",
      icon: <PhoneCall className="h-5 w-5 mr-2" />
    }
  ];

  // Admin navigation items (only available to admin users)
  const adminNavigationItems: NavigationItem[] = [
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

  // Check if an item is active (currently selected)
  const isActive = (item: NavigationItem) => {
    if (item.path === "/admin" && item.pathParams) {
      // For admin pages that use the tab parameter
      return location === item.path;
    }
    return location === item.path;
  };

  return (
    <Sheet>
      <SheetTrigger asChild className="ml-auto">
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
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
                Admin
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

          {/* Logout button (only for admin users) */}
          {isAdmin && (
            <>
              <Separator className="my-2" />
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
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NavigationMenu;