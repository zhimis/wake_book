import React, { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Link } from "wouter";

interface AdminLayoutProps {
  children: ReactNode;
  pageTitle?: string; // Optional page title
}

export function AdminLayout({ children, pageTitle }: AdminLayoutProps) {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = React.useState(false);

  if (!user) {
    return null;
  }

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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 flex">
        {/* Desktop sidebar */}
        <nav className="hidden md:flex w-64 flex-col border-r p-4 bg-white dark:bg-gray-800">
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2 text-gray-500">Admin</div>
            <ul className="space-y-1">
              <li>
                <Link href="/admin" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/admin/calendar" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  Calendar
                </Link>
              </li>
              <li>
                <Link href="/admin/system-config" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  System Config
                </Link>
              </li>
              <li>
                <Link href="/admin/users" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  User Management
                </Link>
              </li>

            </ul>
          </div>
          
          <button 
            onClick={handleLogout}
            className="mt-auto px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-md"
          >
            Logout
          </button>
        </nav>
        
        {/* Mobile navigation */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="md:hidden fixed bottom-4 right-4 z-50 rounded-full shadow-lg"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0">
            <nav className="flex flex-col h-full">
              <div className="p-4 border-b">
                <p className="font-medium">Admin Menu</p>
              </div>
              <div className="flex-1 overflow-auto">
                <ul className="p-4 space-y-2">
                  <li>
                    <Link 
                      href="/admin" 
                      className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setOpen(false)}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/admin/calendar" 
                      className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setOpen(false)}
                    >
                      Calendar
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/admin/system-config" 
                      className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setOpen(false)}
                    >
                      System Config
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/admin/users" 
                      className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setOpen(false)}
                    >
                      User Management
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="p-4 border-t mt-auto">
                <Button 
                  variant="destructive" 
                  className="w-full" 
                  onClick={() => {
                    handleLogout();
                    setOpen(false);
                  }}
                >
                  Logout
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
        
        {/* Main content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}