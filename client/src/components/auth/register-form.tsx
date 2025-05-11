import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { insertUserSchema } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";

// Extend the user schema with additional validation
const registerSchema = insertUserSchema
  .omit({ 
    id: true, 
    lastLogin: true, 
    createdAt: true, 
    role: true, 
    isActive: true,
    phoneNumber: true,
  })
  .extend({
    password: z.string()
      .min(8, "Password must be at least 8 characters")
      .max(100),
    confirmPassword: z.string()
      .min(1, "Please confirm your password"),
    firstName: z.string()
      .min(1, "First name is required"),
    lastName: z.string()
      .min(1, "Last name is required"),
    email: z.string()
      .email("Invalid email address")
      .min(1, "Email is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
}

const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const { registerMutation } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Initialize form
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    
    try {
      const { confirmPassword, ...userData } = data;
      
      registerMutation.mutate(
        {
          ...userData,
          role: "athlete", // Default role for regular registrations
          isActive: true,
        },
        {
          onSuccess: () => {
            toast({
              title: "Registration successful",
              description: "Your account has been created. You can now log in.",
              variant: "default",
            });
            if (onSuccess) onSuccess();
          },
          onError: (err) => {
            console.error("Registration error:", err);
            if (err.message.includes("Email already in use")) {
              setError("This email is already registered. Please log in instead.");
            } else {
              setError("Registration failed. Please try again.");
            }
          },
        }
      );
    } catch (err) {
      console.error("Registration form error:", err);
      setError("Registration failed. Please try again.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your first name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="Enter your email" 
                  {...field} 
                  onChange={(e) => {
                    field.onChange(e);
                    // Auto-generate username from email if username is empty
                    if (!form.getValues().username) {
                      const emailParts = e.target.value.split('@');
                      if (emailParts[0]) {
                        form.setValue('username', emailParts[0]);
                      }
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Choose a username" {...field} />
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
                  placeholder="Create a password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Confirm your password"
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
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            "Create Account"
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

export default RegisterForm;