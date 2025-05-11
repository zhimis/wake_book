import React from 'react';

// Interface for the component props
interface SwipeHandlerProps {
  children: React.ReactNode;
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
class SwipeHandler extends React.Component<SwipeHandlerProps> {
  // Default props
  static defaultProps = {
    threshold: 50
  };

  // Instance variables
  private touchStartX: number | null = null;
  
  // Event handlers
  private handleTouchStart = (e: React.TouchEvent) => {
    this.touchStartX = e.touches[0]?.clientX || null;
  };
  
  private handleTouchEnd = (e: React.TouchEvent) => {
    if (this.touchStartX === null) return;
    
    const touchEndX = e.changedTouches[0]?.clientX;
    if (touchEndX === undefined) return;
    
    const diffX = this.touchStartX - touchEndX;
    
    // Only trigger if swipe distance exceeds threshold
    if (Math.abs(diffX) >= (this.props.threshold || 50)) {
      if (diffX > 0 && this.props.onSwipeLeft) {
        // Swipe from right to left
        this.props.onSwipeLeft();
      } else if (diffX < 0 && this.props.onSwipeRight) {
        // Swipe from left to right
        this.props.onSwipeRight();
      }
    }
    
    // Reset touch tracking
    this.touchStartX = null;
  };

  // Render method
  render() {
    return (
      <div 
        onTouchStart={this.handleTouchStart}
        onTouchEnd={this.handleTouchEnd}
      >
        {this.props.children}
      </div>
    );
  }
}

export default SwipeHandler;