import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TimeSlot } from '@shared/schema';
import { formatInLatviaTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface AdminDayViewDialogProps {
  date: Date;
  timeSlots: TimeSlot[];
  children: React.ReactNode;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'booked':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'reserved':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'available':
      return 'bg-green-100 text-green-800 border-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const AdminDayViewDialog: React.FC<AdminDayViewDialogProps> = ({ date, timeSlots, children }) => {
  // Sort time slots by start time
  const sortedTimeSlots = [...timeSlots].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  
  // Count bookings by status
  const bookedCount = timeSlots.filter(slot => slot.status === 'booked').length;
  const reservedCount = timeSlots.filter(slot => slot.status === 'reserved').length;
  const availableCount = timeSlots.filter(slot => slot.status === 'available').length;
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bookings for {formatInLatviaTime(date, 'EEEE, MMMM d, yyyy')}
          </DialogTitle>
          <DialogDescription>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                Booked: {bookedCount}
              </Badge>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                Reserved: {reservedCount}
              </Badge>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                Available: {availableCount}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="space-y-2 py-2">
            {sortedTimeSlots.map((slot) => (
              <div 
                key={slot.id} 
                className={`px-3 py-2 rounded-md border ${getStatusColor(slot.status)} flex justify-between`}
              >
                <div>
                  {formatInLatviaTime(new Date(slot.startTime), 'HH:mm')} - {formatInLatviaTime(new Date(slot.endTime), 'HH:mm')}
                </div>
                <div className="font-medium capitalize">
                  {slot.status}
                </div>
              </div>
            ))}
            
            {timeSlots.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No time slots available for this date
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AdminDayViewDialog;