import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import hiWakeLogo from "@/assets/logo-crop.jpg";
import NavigationMenu from "@/components/navigation/navigation-menu";

const Header = () => {
  const [, navigate] = useLocation();
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
  
  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 pt-4 pb-0 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <img src={hiWakeLogo} alt="Hi Wake 2.0" className="h-16 w-auto" />
            </div>
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user.username}</span>
              </span>
              <Link href="/profile">
                <Button variant="ghost" size="sm" className="text-primary">
                  My Profile
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-red-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
            </div>
          )}
          
          {!user && (
            <div className="flex items-center">
              <Link href="/auth">
                <span className="text-black font-semibold cursor-pointer mr-4">Sign In</span>
              </Link>
            </div>
          )}
          
          {/* Navigation Menu Component - moved to the right */}
          <NavigationMenu isAdmin={!!user} />
        </div>
      </div>
    </header>
  );
};

export default Header;
