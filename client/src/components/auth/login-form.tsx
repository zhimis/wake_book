import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
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
import { Loader2 } from "lucide-react";

// Form schema
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm = () => {
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
    
    try {
      loginMutation.mutate(
        { email: data.email, password: data.password },
        {
          onSuccess: () => {
            // The auth context will handle redirection and data storage
            console.log("Login successful");
          },
          onError: (err) => {
            console.error("Login mutation error:", err);
            setError(
              "Login failed. Please check your credentials and try again."
            );
          },
        }
      );
    } catch (err) {
      console.error("Login form submission error:", err);
      setError("Login failed. Please check your credentials and try again.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
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

      {error && (
        <div className="mt-4 p-2 bg-destructive/10 text-destructive rounded text-sm">
          {error}
        </div>
      )}
    </Form>
  );
};

export default LoginForm;