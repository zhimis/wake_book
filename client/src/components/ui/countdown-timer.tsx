import { useEffect, useState } from "react";
import { formatTimeFromMinutes } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  initialSeconds: number;
  onExpire?: () => void;
  showWarning?: boolean;
  warningThreshold?: number;
  className?: string;
}

const CountdownTimer = ({
  initialSeconds,
  onExpire,
  showWarning = true,
  warningThreshold = 120, // 2 minutes by default
  className
}: CountdownTimerProps) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const { toast } = useToast();
  
  useEffect(() => {
    if (seconds <= 0) {
      if (onExpire) {
        onExpire();
      }
      return;
    }
    
    // Show warning when 2 minutes remain
    if (showWarning && seconds === warningThreshold) {
      toast({
        title: "Selection Expiring Soon",
        description: "Your time slot selection will expire in 2 minutes. Please complete your booking.",
        variant: "default",
        duration: 5000,
      });
    }
    
    const timer = setTimeout(() => {
      setSeconds(seconds - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [seconds, onExpire, showWarning, warningThreshold, toast]);
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  const formattedTime = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  
  const progressPercentage = (seconds / initialSeconds) * 100;
  
  return (
    <div className={cn("flex flex-col w-full", className)}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Your selection is held for:</span>
        </div>
        <span id="timerCountdown" className="font-bold">{formattedTime}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-warning h-2 rounded-full transition-all duration-1000 ease-linear" 
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default CountdownTimer;
