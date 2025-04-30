import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, LogOut } from "lucide-react";
import hiWakeLogo from "@/assets/logo-crop.jpg";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  const handleLogout = () => {
    setMobileMenuOpen(false); // Close mobile menu
    logoutMutation.mutate();
    // No need to handle redirect, auth hook will do that 
  };
  
  // Helper function to handle navigation with mobile menu closing
  const handleNavigation = (path: string) => {
    setMobileMenuOpen(false); // Close mobile menu
    navigate(path);
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
          {user ? (
            <div className="hidden md:flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Welcome, <span className="font-medium">{user.username}</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    localStorage.removeItem("adminActiveTab");
                    window.location.href = "/admin";
                  }}>
                    Admin Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    localStorage.setItem("adminActiveTab", "bookings");
                    window.location.href = "/admin";
                  }}>
                    Bookings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    localStorage.setItem("adminActiveTab", "configuration");
                    window.location.href = "/admin";
                  }}>
                    System Configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    localStorage.setItem("adminActiveTab", "statistics");
                    window.location.href = "/admin";
                  }}>
                    Statistics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/admin/login">
              <span className="hidden md:block text-black font-semibold cursor-pointer">Admin</span>
            </Link>
          )}
          
          <button 
            className="md:hidden text-gray-700"
            onClick={toggleMobileMenu}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className={cn(
        "md:hidden bg-white px-4 py-1 shadow-lg transition-all duration-200 ease-in-out overflow-hidden",
        mobileMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
      )}>
        <nav className="flex flex-col space-y-2">
          <span 
            onClick={() => handleNavigation("/")}
            className="text-gray-700 hover:text-black font-medium py-1 cursor-pointer"
          >
            Home
          </span>
          
          {user ? (
            <>
              {/* Admin menu items */}
              <div className="text-sm text-gray-600 py-1">
                Welcome, <span className="font-medium">{user.username}</span>
              </div>
              
              {/* Admin menu options */}
              <span 
                onClick={() => {
                  setMobileMenuOpen(false);
                  localStorage.removeItem("adminActiveTab");
                  window.location.href = "/admin";
                }}
                className="text-gray-700 hover:text-black font-medium py-1 cursor-pointer"
              >
                Admin Dashboard
              </span>
              
              <span 
                onClick={() => {
                  setMobileMenuOpen(false);
                  localStorage.setItem("adminActiveTab", "bookings");
                  window.location.href = "/admin";
                }}
                className="text-gray-700 hover:text-black font-medium py-1 cursor-pointer pl-4"
              >
                - Bookings
              </span>
              
              <span 
                onClick={() => {
                  setMobileMenuOpen(false);
                  localStorage.setItem("adminActiveTab", "configuration");
                  window.location.href = "/admin";
                }}
                className="text-gray-700 hover:text-black font-medium py-1 cursor-pointer pl-4"
              >
                - System Configuration
              </span>
              
              <span 
                onClick={() => {
                  setMobileMenuOpen(false);
                  localStorage.setItem("adminActiveTab", "statistics");
                  window.location.href = "/admin";
                }}
                className="text-gray-700 hover:text-black font-medium py-1 cursor-pointer pl-4"
              >
                - Statistics
              </span>
              
              <button 
                onClick={handleLogout}
                className="text-left text-red-600 hover:text-red-700 font-medium py-1 cursor-pointer flex items-center gap-2 mt-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </>
          ) : (
            <span 
              onClick={() => handleNavigation("/admin/login")}
              className="text-black hover:text-black font-medium py-1 cursor-pointer"
            >
              Admin
            </span>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
