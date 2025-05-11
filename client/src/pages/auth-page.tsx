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
              {/* Email/Password Login Is Primary */}
              <div className="mb-4 text-sm text-muted-foreground">
                Sign in with your email address and password:
              </div>
              
              {/* Note about Google authentication */}
              <div className="mb-4 p-3 border rounded border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
                <p className="font-medium mb-1">Note:</p>
                <p>Google Sign-in is currently being configured. For now, please use email and password authentication.</p>
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