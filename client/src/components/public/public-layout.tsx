import { ReactNode } from "react";

interface PublicLayoutProps {
  children: ReactNode;
}

function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content */}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
}

export default PublicLayout;