import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <span className="text-primary font-heading font-bold text-2xl cursor-pointer">Hi Wake 2.0</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-4">
          <Link href="/admin/login">
            <span className="hidden md:block text-primary font-semibold cursor-pointer">Admin Login</span>
          </Link>
          
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
        "md:hidden bg-white px-4 py-2 shadow-lg transition-all duration-200 ease-in-out overflow-hidden",
        mobileMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
      )}>
        <nav className="flex flex-col space-y-3 py-2">
          <Link href="/">
            <span className="text-gray-700 hover:text-primary font-medium py-1 cursor-pointer">Home</span>
          </Link>
          <Link href="/admin/login">
            <span className="text-gray-700 hover:text-primary font-medium py-1 cursor-pointer">Admin Login</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;
