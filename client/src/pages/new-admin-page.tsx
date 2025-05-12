import { useEffect } from "react";
import { useLocation } from "wouter";

// This page is being removed, redirecting to the main admin page
const NewAdminPage = () => {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Redirect to the main admin page
    navigate("/admin/bookings");
  }, [navigate]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-xl font-bold">Redirecting...</h2>
      <p>This page has been moved to the main admin dashboard.</p>
    </div>
  );
};

export default NewAdminPage;