import React, { useState } from 'react';
import { 
  ThumbsUp,
  X,
  Star,
  MessageCircle,
  HeartHandshake
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
          className="fixed bottom-6 right-6 rounded-lg shadow-lg py-3 px-5 bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 transition-all hover:scale-105"
          aria-label="Give Feedback"
        >
          <HeartHandshake className="size-5" />
          <span className="font-medium">Your Feedback</span>
          <Star className="size-4 ml-1 fill-yellow-200 text-yellow-200" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ThumbsUp className="text-amber-500 size-6" />
            <DialogTitle className="text-xl">Help Us Improve</DialogTitle>
          </div>
          <DialogDescription className="mt-2">
            Your feedback helps us make HiWake better! Share your thoughts and suggestions to help enhance your wakeboarding experience.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Rating */}
          <div className="space-y-2">
            <Label htmlFor="rating" className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              How would you rate your experience?
            </Label>
            <div className="flex gap-3 pt-2 justify-center bg-muted/20 py-4 rounded-md">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`flex flex-col items-center gap-1 transition-all ${
                    rating === value 
                      ? 'scale-110 text-amber-500' 
                      : 'text-gray-400 hover:text-amber-400'
                  }`}
                  onClick={() => setRating(value)}
                >
                  <Star className={`h-8 w-8 ${rating >= value ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span className="text-xs">
                    {value === 1 ? 'Poor' : 
                     value === 2 ? 'Fair' : 
                     value === 3 ? 'Good' : 
                     value === 4 ? 'Great' : 'Excellent'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Feedback text */}
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-amber-500" />
              Your thoughts
            </Label>
            <Textarea
              id="comment"
              placeholder="We'd love to hear what you think! Share your experience, ideas, or suggestions for improvement..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="resize-none border-muted-foreground/20 focus-visible:ring-amber-500"
              required
            />
          </div>
          
          {/* Email (optional) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Email (optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-muted-foreground/20 focus-visible:ring-amber-500"
            />
            <p className="text-xs text-muted-foreground">We'll only use this to follow up if needed</p>
          </div>
          
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              What's this about?
            </Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-muted-foreground/20 bg-background px-3 py-2.5 text-sm ring-offset-background focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              <option value="general">General Feedback</option>
              <option value="booking">Booking Experience</option>
              <option value="interface">Website Experience</option>
              <option value="suggestion">Feature Suggestion</option>
              <option value="bug">Something's Not Working</option>
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
              className="border-muted-foreground/20 hover:bg-muted/30"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!rating || !comment || feedbackMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 transition-all"
            >
              {feedbackMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Send Feedback</span>
                  <ThumbsUp className="h-4 w-4" />
                </div>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}