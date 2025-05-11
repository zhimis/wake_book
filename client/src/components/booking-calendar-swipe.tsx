import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Euro,
  Loader2,
} from "lucide-react";
import {
  cn,
  getLatvianDayIndex,
  getStandardDayIndex,
  getLatvianDayName,
  getLatvianDayIndexFromDate,
  toLatviaTime,
  fromLatviaTime,
  formatInLatviaTime,
  formatTime,
  formatTimeSlot,
  formatWithTimezone,
  LATVIA_TIMEZONE,
} from "@/lib/utils";
import { useBooking } from "@/context/booking-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { TimeSlot as SchemaTimeSlot, generateTimeSlotId } from "@shared/schema";
import CalendarDay from "@/components/calendar-day";
import AdminTimeSlot from "@/components/admin/admin-time-slot";
import useEmblaCarousel from 'embla-carousel-react';
import { BookingCalendar, BookingCalendarProps } from "./booking-calendar";

/**
 * BookingCalendarSwipe - Extends BookingCalendar with swipe functionality
 * This component wraps the original BookingCalendar and adds swipe gestures
 * for better mobile navigation.
 */
export function BookingCalendarSwipe(props: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(toLatviaTime(new Date()));
  
  // Set up Embla carousel for swipe navigation
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    draggable: true,
    align: 'start',
    containScroll: false
  });

  // Custom navigation functions that will be passed to the BookingCalendar
  const goToPreviousWeek = useCallback(() => {
    setCurrentDate(prev => {
      // Move to the previous week (7 days back)
      const newDate = subDays(prev, 7);
      return newDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentDate(prev => {
      // Move to the next week (7 days forward)
      const newDate = addDays(prev, 7);
      return newDate;
    });
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(toLatviaTime(new Date()));
  }, []);

  // Handle Embla carousel events
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const index = emblaApi.selectedScrollSnap();
      if (index === 0) {
        // Scrolled left - go to previous week
        goToPreviousWeek();
        // Reset carousel position to center
        setTimeout(() => {
          emblaApi.scrollTo(1);
        }, 10);
      } else if (index === 2) {
        // Scrolled right - go to next week
        goToNextWeek();
        // Reset carousel position to center
        setTimeout(() => {
          emblaApi.scrollTo(1);
        }, 10);
      }
    };

    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, goToNextWeek, goToPreviousWeek]);

  // When we change the week, we need to reset the carousel to the center
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(1);
    }
  }, [currentDate, emblaApi]);

  // Custom navigation props to pass to BookingCalendar
  const customNavigation = {
    goToPrevious: goToPreviousWeek,
    goToNext: goToNextWeek,
    goToToday: goToToday
  };

  return (
    <div>
      {/* Swipeable carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {/* Previous week slide (for swiping) */}
          <div className="min-w-0 flex-shrink-0" style={{width: '100%'}}>
            <BookingCalendar 
              {...props}
              customNavigation={customNavigation}
              initialDate={subDays(currentDate, 7)}
            />
          </div>

          {/* Current week slide */}
          <div className="min-w-0 flex-shrink-0" style={{width: '100%'}}>
            <BookingCalendar 
              {...props}
              customNavigation={customNavigation}
              initialDate={currentDate}
            />
          </div>

          {/* Next week slide (for swiping) */}
          <div className="min-w-0 flex-shrink-0" style={{width: '100%'}}>
            <BookingCalendar 
              {...props}
              customNavigation={customNavigation}
              initialDate={addDays(currentDate, 7)}
            />
          </div>
        </div>
      </div>

      {/* Mobile hint */}
      <div className="mt-2 text-xs text-center text-muted-foreground sm:hidden">
        Swipe left or right to change weeks
      </div>
    </div>
  );
}