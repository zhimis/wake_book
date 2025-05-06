import { ReactNode } from "react";
import NavigationMenu from "@/components/navigation/navigation-menu";

interface PublicLayoutProps {
  children: ReactNode;
}

function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navigation bar */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {/* Logo */}
          <div className="text-xl font-bold">Hi Wake</div>
          
          {/* Navigation menu - not admin */}
          <NavigationMenu isAdmin={false} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
}

export default PublicLayout;