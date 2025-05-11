import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LoginForm from "@/components/auth/login-form";
import RegisterForm from "@/components/auth/register-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaGoogle } from "react-icons/fa";
import { Separator } from "@/components/ui/separator";

const AuthPage = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");

  useEffect(() => {
    // Set page title
    document.title = "Sign In | Hi Wake 2.0";
  }, []);

  // If already authenticated, redirect to home
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="container py-8 min-h-[85vh]">
      <div className="flex flex-col md:flex-row justify-between gap-8 max-w-6xl mx-auto">
        {/* Auth Forms */}
        <div className="w-full md:w-1/2">
          <Card className="shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Google Sign In */}
              <div className="mb-4">
                <Button variant="outline" className="w-full" asChild>
                  <a href="/api/auth/google" className="flex items-center justify-center gap-2">
                    <FaGoogle className="h-4 w-4" />
                    <span>Sign in with Google</span>
                  </a>
                </Button>
              </div>
              
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Tabs for Login/Register */}
              <Tabs 
                defaultValue="login"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="mt-6">
                  <LoginForm />
                </TabsContent>
                <TabsContent value="register" className="mt-6">
                  <RegisterForm setActiveTab={setActiveTab} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Hero Banner */}
        <div className="w-full md:w-1/2 bg-primary text-primary-foreground rounded-lg shadow-md p-8 flex flex-col justify-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">
            Hi Wake 2.0
          </h1>
          <p className="text-lg mb-6">
            Join our community of wake enthusiasts and book your sessions with ease!
          </p>
          <div className="space-y-4 text-primary-foreground/90">
            <div className="flex items-start">
              <div className="h-5 w-5 mr-2 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
              <p>Easy booking process with real-time availability</p>
            </div>
            <div className="flex items-start">
              <div className="h-5 w-5 mr-2 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
              <p>Manage your bookings and preferences in one place</p>
            </div>
            <div className="flex items-start">
              <div className="h-5 w-5 mr-2 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
              <p>Get access to exclusive member-only promotions</p>
            </div>
            <div className="flex items-start">
              <div className="h-5 w-5 mr-2 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
              <p>Equipment rental and professional instructions available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;