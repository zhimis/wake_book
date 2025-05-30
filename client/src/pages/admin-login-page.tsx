import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import LoginForm from "@/components/admin/login-form";

const AdminLoginPage = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // Redirect to admin dashboard if already logged in
  useEffect(() => {
    if (user) {
      navigate("/admin");
    }
  }, [user, navigate]);
  
  return (
    <main className="container mx-auto px-0.5 py-2 flex items-center justify-center">
      <LoginForm />
    </main>
  );
};

export default AdminLoginPage;
