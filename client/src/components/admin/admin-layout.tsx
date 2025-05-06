import { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content */}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
}

export default AdminLayout;