import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useState, useEffect } from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simple loading effect to allow auth state to be determined
    const timer = setTimeout(() => {
      setIsLoading(false);
      console.log("Protected route loading finished, user:", user);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [user]);

  // Add debugging for authentication state
  useEffect(() => {
    console.log("Auth state in protected route:", { user, authLoading, path });
  }, [user, authLoading, path]);

  if (isLoading || authLoading) {
    console.log("ProtectedRoute: Still loading...");
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    console.log("ProtectedRoute: No user, redirecting to login");
    return (
      <Route path={path}>
        <Redirect to="/admin/login" />
      </Route>
    );
  }

  console.log("ProtectedRoute: User authenticated, rendering component");
  return <Route path={path} component={Component} />;
}
