import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import NavigationMenu from "@/components/navigation/navigation-menu";

interface AdminLayoutProps {
  children: ReactNode;
}

function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { logoutMutation } = useAuth();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navigation bar */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Logo */}
          <div className="text-xl font-bold">Hi Wake</div>
          
          {/* Mobile navigation menu with the new component */}
          <NavigationMenu isAdmin={true} />
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