import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const AdminEmailConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  // Fetch current admin email
  const { data, isLoading } = useQuery({
    queryKey: ['/api/config/admin-email'],
    queryFn: async () => {
      const res = await fetch('/api/config/admin-email');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch admin email');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.email) {
        setEmail(data.email);
      }
    },
    onError: (error) => {
      console.error("Failed to fetch admin email:", error);
      toast({
        title: "Error",
        description: "Failed to load admin email configuration.",
        variant: "destructive",
      });
    }
  });

  // Update admin email mutation
  const updateEmailMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const res = await fetch('/api/config/admin-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update admin email');
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Admin email updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/config/admin-email'] });
    },
    onError: (error) => {
      console.error("Failed to update admin email:", error);
      toast({
        title: "Error",
        description: "Failed to update admin email configuration.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Email cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    updateEmailMutation.mutate(email);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Configure the email address that will receive booking notifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Admin Email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || updateEmailMutation.isPending}
            />
            <p className="text-sm text-muted-foreground">
              Booking notifications will be sent to this email address
            </p>
          </div>
          <Button
            type="submit"
            disabled={isLoading || updateEmailMutation.isPending}
          >
            {updateEmailMutation.isPending ? "Saving..." : "Save Email"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdminEmailConfig;