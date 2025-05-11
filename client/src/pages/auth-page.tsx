import { useState, useEffect } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import LoginForm from "@/components/auth/login-form";
import RegisterForm from "@/components/auth/register-form";
import { FaGoogle } from "react-icons/fa";

const AuthPage = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("login");

  // If user is already authenticated, redirect to home
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="grid md:grid-cols-2 gap-6 w-full max-w-5xl">
        {/* Left side: Auth forms */}
        <div className="flex flex-col justify-center">
          <Tabs 
            defaultValue="login" 
            value={activeTab} 
            onValueChange={setActiveTab} 
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Log In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>
                    Sign in to access your account and bookings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <LoginForm />
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full" asChild>
                    <a href="/api/auth/google" className="flex items-center justify-center gap-2">
                      <FaGoogle className="h-4 w-4" />
                      <span>Sign in with Google</span>
                    </a>
                  </Button>
                  
                  <div className="text-center text-sm">
                    <p className="text-muted-foreground">
                      Don't have an account?{" "}
                      <button 
                        onClick={() => setActiveTab("register")}
                        className="text-primary underline underline-offset-4 hover:text-primary/80"
                      >
                        Register
                      </button>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl">Create an account</CardTitle>
                  <CardDescription>
                    Register to start booking wakeboarding sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RegisterForm onSuccess={() => setActiveTab("login")} />
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full" asChild>
                    <a href="/api/auth/google" className="flex items-center justify-center gap-2">
                      <FaGoogle className="h-4 w-4" />
                      <span>Sign up with Google</span>
                    </a>
                  </Button>
                  
                  <div className="text-center text-sm">
                    <p className="text-muted-foreground">
                      Already have an account?{" "}
                      <button 
                        onClick={() => setActiveTab("login")}
                        className="text-primary underline underline-offset-4 hover:text-primary/80"
                      >
                        Log in
                      </button>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Right side: Hero section */}
        <div className="hidden md:flex flex-col justify-center p-6 bg-gradient-to-b from-primary to-primary/80 text-primary-foreground rounded-lg">
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-3">
                Hi Wake 2.0 Booking
              </h1>
              <p className="text-xl">
                Latvia's premier wakeboarding park
              </p>
            </div>
            
            <ul className="space-y-3 text-lg">
              <li className="flex items-center">
                <span className="bg-primary-foreground text-primary rounded-full w-6 h-6 flex items-center justify-center mr-2">✓</span>
                Book wakeboarding sessions in one click
              </li>
              <li className="flex items-center">
                <span className="bg-primary-foreground text-primary rounded-full w-6 h-6 flex items-center justify-center mr-2">✓</span>
                Manage your bookings in one place
              </li>
              <li className="flex items-center">
                <span className="bg-primary-foreground text-primary rounded-full w-6 h-6 flex items-center justify-center mr-2">✓</span>
                Access exclusive athlete features
              </li>
              <li className="flex items-center">
                <span className="bg-primary-foreground text-primary rounded-full w-6 h-6 flex items-center justify-center mr-2">✓</span>
                View availability in real-time
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;