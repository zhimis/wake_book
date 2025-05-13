import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Star, Check, EyeOff, Eye, BookOpen, Archive } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Feedback } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

export default function AdminFeedbackPage() {
  const [activeTab, setActiveTab] = useState<string>('new');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all feedback
  const { data: allFeedback = [], isLoading, isError } = useQuery({
    queryKey: ['/api/admin/feedback'],
    queryFn: async () => {
      const response = await apiRequest('/api/admin/feedback', 'GET');
      if (Array.isArray(response)) {
        return response as Feedback[];
      }
      console.error("Unexpected response format:", response);
      throw new Error("Failed to fetch feedback data");
    },
  });

  // Update feedback status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: number, status: string, adminNotes?: string }) =>
      apiRequest(`/api/admin/feedback/${id}`, 'PATCH', { status, adminNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/feedback'] });
      setIsDialogOpen(false);
      toast({
        title: "Feedback updated",
        description: "The feedback status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update feedback status. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating feedback:", error);
    },
  });

  // Handle marking as reviewed
  const handleMarkAsReviewed = (feedback: Feedback) => {
    updateStatusMutation.mutate({
      id: feedback.id,
      status: 'reviewed',
      adminNotes: adminNotes || feedback.adminNotes || '',
    });
  };

  // Handle archiving feedback
  const handleArchive = (feedback: Feedback) => {
    updateStatusMutation.mutate({
      id: feedback.id,
      status: 'archived',
      adminNotes: adminNotes || feedback.adminNotes || '',
    });
  };

  // Handle feedback click for detailed view
  const handleFeedbackClick = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setAdminNotes(feedback.adminNotes || '');
    setIsDialogOpen(true);
  };

  // Filter feedback by status
  const filteredFeedback = allFeedback.filter((feedback: Feedback) => {
    switch (activeTab) {
      case 'new':
        return feedback.status === 'new';
      case 'reviewed':
        return feedback.status === 'reviewed';
      case 'archived':
        return feedback.status === 'archived';
      default:
        return true;
    }
  });

  // Render stars based on rating
  const renderStars = (rating: number) => {
    return Array(5).fill(0).map((_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
    ));
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default">New</Badge>;
      case 'reviewed':
        return <Badge variant="secondary">Reviewed</Badge>;
      case 'archived':
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Get category badge
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'general':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">General</Badge>;
      case 'booking':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Booking</Badge>;
      case 'interface':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Interface</Badge>;
      case 'suggestion':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Suggestion</Badge>;
      case 'bug':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Bug</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <AdminPageHeader 
          title="Feedback Management" 
          description="Review and manage customer feedback"
        />
        <div className="flex justify-center items-center h-64">
          <p>Loading feedback...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-6">
        <AdminPageHeader 
          title="Feedback Management" 
          description="Review and manage customer feedback"
        />
        <div className="flex justify-center items-center h-64">
          <p className="text-red-500">Error loading feedback. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <AdminPageHeader 
        title="Feedback Management" 
        description="Review and manage customer feedback"
      />
      
      <Tabs defaultValue="new" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="new" className="relative">
            New
            {allFeedback.filter((f: Feedback) => f.status === 'new').length > 0 && (
              <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-white">
                {allFeedback.filter((f: Feedback) => f.status === 'new').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-0">
          {filteredFeedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/10 rounded-lg border border-dashed">
              <p className="text-muted-foreground mb-2">No {activeTab} feedback found</p>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'new' 
                  ? 'All feedback has been reviewed.' 
                  : activeTab === 'reviewed' 
                    ? 'No feedback has been reviewed yet.' 
                    : 'No feedback has been archived yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFeedback.map((feedback: Feedback) => (
                <Card key={feedback.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleFeedbackClick(feedback)}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-1 mr-2">
                        {renderStars(feedback.rating)}
                      </div>
                      <div className="flex gap-2">
                        {getCategoryBadge(feedback.category || 'general')}
                        {getStatusBadge(feedback.status)}
                      </div>
                    </div>
                    <CardDescription className="flex justify-between items-center">
                      <span>{format(new Date(feedback.createdAt), 'MMM d, yyyy')}</span>
                      {feedback.email && <span className="text-xs truncate max-w-[150px]">{feedback.email}</span>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm">{feedback.comment}</p>
                  </CardContent>
                  <CardFooter className="bg-muted/10 pt-2 pb-2 flex justify-between">
                    <span className="text-xs text-muted-foreground">
                      ID: {feedback.id}
                    </span>
                    {feedback.adminNotes && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        Has notes
                      </span>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Feedback Detail Dialog */}
      {selectedFeedback && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Feedback Details</span>
                <div className="flex items-center gap-2">
                  {getCategoryBadge(selectedFeedback.category || 'general')}
                  {getStatusBadge(selectedFeedback.status)}
                </div>
              </DialogTitle>
              <DialogDescription>
                Submitted on {format(new Date(selectedFeedback.createdAt), 'MMMM d, yyyy h:mm a')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 my-2">
              <div>
                <div className="flex gap-1 mb-2">
                  {renderStars(selectedFeedback.rating)}
                  <span className="ml-2 text-sm">{selectedFeedback.rating}/5</span>
                </div>
                
                <div className="bg-muted p-3 rounded-md">
                  <p>{selectedFeedback.comment}</p>
                </div>
              </div>
              
              {selectedFeedback.email && (
                <div className="text-sm">
                  <span className="font-medium">Contact:</span> {selectedFeedback.email}
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes</label>
                <Textarea 
                  value={adminNotes} 
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add your notes here..."
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter className="sm:justify-between">
              {selectedFeedback.status === 'new' && (
                <Button
                  className="gap-1"
                  onClick={() => handleMarkAsReviewed(selectedFeedback)}
                  disabled={updateStatusMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                  Mark as Reviewed
                </Button>
              )}
              
              {selectedFeedback.status !== 'archived' && (
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={() => handleArchive(selectedFeedback)}
                  disabled={updateStatusMutation.isPending}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              )}
              
              {selectedFeedback.status === 'archived' && (
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={() => handleMarkAsReviewed(selectedFeedback)}
                  disabled={updateStatusMutation.isPending}
                >
                  <Eye className="h-4 w-4" />
                  Restore
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}