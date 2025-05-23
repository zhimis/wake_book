import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Form schema
const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm = () => {
  const [, navigate] = useLocation();
  const { loginMutation } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Initialize form
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    console.log("Login form submitted with:", data.email);

    try {
      loginMutation.mutate(
        { email: data.email, password: data.password },
        {
          onSuccess: (user) => {
            console.log("Login mutation success, user:", user);

            // Force a cache invalidation to ensure we have the latest user data
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });

            // Set the default tab
            localStorage.setItem("adminActiveTab", "bookings");

            // Use direct window location change for more reliable navigation
            window.location.href = "/admin";
          },
          onError: (err) => {
            console.error("Login mutation error:", err);
            setError(
              "Login failed. Please check your credentials and try again.",
            );
          },
        },
      );
    } catch (err) {
      console.error("Login form submission error:", err);
      setError("Login failed. Please check your credentials and try again.");
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Admin Login</CardTitle>
        <CardDescription>
          Access the wakeboarding park administration panel
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </Button>
          </form>
        </Form>

        {error && (
          <div className="mt-4 p-2 bg-destructive/10 text-destructive rounded text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground"></div>
      </CardContent>
    </Card>
  );
};

export default LoginForm;
