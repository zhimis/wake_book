import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import LoginForm from "@/components/admin/login-form";

const AdminLoginPage = () => {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  // Redirect to admin dashboard if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate("/admin");
    }
  }, [user, isLoading, navigate]);
  
  return (
    <main className="container mx-auto px-4 py-12 flex items-center justify-center">
      <LoginForm />
    </main>
  );
};

export default AdminLoginPage;
