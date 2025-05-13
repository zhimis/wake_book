import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Feedback } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageSquare } from "lucide-react";

export default function AdminFeedbackPage() {
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");

  // Fetch all feedback
  const { data: feedbackItems, isLoading, refetch } = useQuery<Feedback[]>({
    queryKey: ["/api/admin/feedback"],
    refetchOnWindowFocus: false,
  });

  // Mutation to update feedback status
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status?: string; adminNotes?: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/feedback/${id}`, {
        ...(status && { status }),
        ...(adminNotes && { adminNotes }),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback updated",
        description: "The feedback has been successfully updated.",
      });
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error("Error updating feedback:", error);
      toast({
        title: "Failed to update feedback",
        description: "There was a problem updating the feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFeedbackClick = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setNewStatus(feedback.status || "new");
    setAdminNotes(feedback.adminNotes || "");
    setIsDialogOpen(true);
  };

  const handleUpdateFeedback = () => {
    if (!selectedFeedback) return;

    updateFeedbackMutation.mutate({
      id: selectedFeedback.id,
      status: newStatus !== selectedFeedback.status ? newStatus : undefined,
      adminNotes: adminNotes !== selectedFeedback.adminNotes ? adminNotes : undefined,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "reviewed":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="container mx-auto py-8">
      <AdminPageHeader title="User Feedback" description="Review and manage user feedback and suggestions" />

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {feedbackItems && feedbackItems.length > 0 ? (
            feedbackItems.map((feedback) => (
              <Card 
                key={feedback.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleFeedbackClick(feedback)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm text-gray-500">Feedback #{feedback.id}</CardTitle>
                      <CardDescription>
                        {feedback.createdAt && format(new Date(feedback.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </CardDescription>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feedback.status)}`}>
                      {feedback.status || "new"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm line-clamp-4">{feedback.content}</p>
                </CardContent>
                <CardFooter className="pt-0 text-xs text-gray-500">
                  <div className="flex items-center">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {feedback.adminNotes ? "Has admin notes" : "No admin notes"}
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-3 text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No feedback yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't received any feedback from users yet.
              </p>
            </div>
          )}
        </div>
      )}

      {selectedFeedback && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Feedback Details</DialogTitle>
              <DialogDescription>
                Submitted on {selectedFeedback.createdAt && format(new Date(selectedFeedback.createdAt), "MMMM d, yyyy 'at' h:mm a")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium mb-2">User Feedback</h4>
                <div className="bg-gray-50 p-3 rounded-md text-sm">
                  {selectedFeedback.content}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Status</h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Admin Notes</h4>
                <Textarea 
                  value={adminNotes} 
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes or follow-up actions..."
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateFeedback}
                disabled={updateFeedbackMutation.isPending}
              >
                {updateFeedbackMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}