import React, { useState } from 'react';
import { 
  MessageSquare, 
  X,
  Smile,
  Frown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { feedbackFormSchema } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('general');
  const { toast } = useToast();

  const feedbackMutation = useMutation({
    mutationFn: (data: { rating: number; comment: string; email?: string; category: string }) => 
      apiRequest('/api/feedback', 'POST', data),
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
      resetForm();
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
      console.error("Feedback submission error:", error);
    }
  });

  const resetForm = () => {
    setRating(0);
    setComment('');
    setEmail('');
    setCategory('general');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate the data using zod schema
      feedbackFormSchema.parse({
        rating,
        comment,
        email: email || undefined,
        category
      });
      
      // Submit the feedback
      feedbackMutation.mutate({
        rating,
        comment,
        email: email || undefined,
        category
      });
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Please check your feedback form and try again.",
        variant: "destructive",
      });
      console.error("Validation error:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="fixed bottom-6 right-6 rounded-full shadow-lg p-3 size-14 bg-primary hover:bg-primary/90 text-white"
          aria-label="Give Feedback"
        >
          <MessageSquare className="size-8" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            We value your opinion. Let us know how we can improve your experience.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Rating */}
          <div className="space-y-2">
            <Label htmlFor="rating">How would you rate your experience?</Label>
            <div className="flex gap-2 pt-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={rating === value ? "default" : "outline"} 
                  className={`h-12 w-12 rounded-full ${rating === value ? 'bg-primary text-white' : ''}`}
                  onClick={() => setRating(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Feedback text */}
          <div className="space-y-2">
            <Label htmlFor="comment">Your feedback</Label>
            <Textarea
              id="comment"
              placeholder="Tell us what you think..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none"
              required
            />
          </div>
          
          {/* Email (optional) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="general">General</option>
              <option value="booking">Booking Process</option>
              <option value="interface">User Interface</option>
              <option value="suggestion">Suggestion</option>
              <option value="bug">Bug Report</option>
            </select>
          </div>
          
          <DialogFooter className="sm:justify-between mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                resetForm();
                setIsOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!rating || !comment || feedbackMutation.isPending}
            >
              {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}