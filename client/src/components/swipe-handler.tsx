import React, { useRef, ReactNode } from 'react';

// Interface for the component props
interface SwipeHandlerProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

/**
 * SwipeHandler - Component that adds swipe gesture detection to its children
 * 
 * This is a simple touch event handler that detects horizontal swipe gestures
 * and invokes callbacks for left and right swipes.
 */
const SwipeHandler: React.FC<SwipeHandlerProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50
}) => {
  // Use a ref to track touch start position
  const touchStartX = useRef<number | null>(null);
  
  // Simple event handlers that don't rely on hooks or state
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX || null;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0]?.clientX;
    if (touchEndX === undefined) return;
    
    const diffX = touchStartX.current - touchEndX;
    
    // Only trigger if swipe distance exceeds threshold
    if (Math.abs(diffX) >= threshold) {
      if (diffX > 0 && onSwipeLeft) {
        // Swipe from right to left
        onSwipeLeft();
      } else if (diffX < 0 && onSwipeRight) {
        // Swipe from left to right
        onSwipeRight();
      }
    }
    
    // Reset touch tracking
    touchStartX.current = null;
  };

  // Wrap children with touch event handlers
  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
};

export default SwipeHandler;